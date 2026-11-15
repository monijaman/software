---
title: Deploy a Node.js App to a VPS, Step by Step
summary: "The full journey on a fresh Ubuntu server: secure it, install Node, clone and build a Next.js or Express app, run it with systemd, put Nginx and HTTPS in front, and repeat deploys safely."
level: Intermediate
tags: [deployment, vps, nodejs, nextjs, systemd, nginx, ubuntu]
---

## The big idea

This lesson ties everything together. You'll go from a **brand-new server with only a root password** to **`https://example.com` serving your app**, restarted automatically after crashes and reboots.

![Ten steps from a fresh server to a live HTTPS site: secure, install, clone, configure, build, run, proxy, encrypt, verify, update](/img/linux-devops/vps-deployment.svg)

The example uses **Ubuntu 24.04**, a **Next.js** app (Express works the same way), the domain `example.com`, the user `deploy`, and the folder `/var/www/myapp`.

## Step 1: First login and a non-root user

```bash
# From your laptop: the provider gave you a root password or key
ssh root@203.0.113.10

apt update && apt upgrade -y
adduser deploy                          # set a strong password
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
```

From your laptop: `ssh-copy-id deploy@203.0.113.10`, then open a **new** terminal and confirm `ssh deploy@203.0.113.10` works **before** going on.

## Step 2: Lock the doors

```bash
# As deploy, using sudo
sudo tee /etc/ssh/sshd_config.d/hardening.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
EOF
sudo sshd -t && sudo systemctl reload ssh

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

sudo apt install -y fail2ban unattended-upgrades
sudo timedatectl set-timezone UTC
```

## Step 3: Install Node.js, Git and Nginx

Install Node **system-wide** from NodeSource, so the path (`/usr/bin/node`) is the same for you, systemd and cron:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx build-essential
node -v      # v22.x
npm -v
```

> 💡 `build-essential` is needed for packages with native code, such as `better-sqlite3`, `bcrypt` or `sharp`. If `npm ci` fails with `gyp ERR!`, this is usually what's missing.

## Step 4: Get the code onto the server

Create a **deploy key**: an SSH key that can only **read** this one repository.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "deploy@myserver"
cat ~/.ssh/github_deploy.pub
# GitHub → repo → Settings → Deploy keys → Add (read-only)

cat >> ~/.ssh/config <<'EOF'
Host github.com
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
EOF

sudo mkdir -p /var/www/myapp
sudo chown deploy:deploy /var/www/myapp
git clone git@github.com:your-org/myapp.git /var/www/myapp
```

## Step 5: Configure secrets

Never commit secrets to Git. Create the env file on the server, readable only by `deploy`:

```bash
cd /var/www/myapp
cat > .env <<'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://myapp:CHANGE_ME@127.0.0.1:5432/myapp
SESSION_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING
EOF
chmod 600 .env
```

Generate random secrets with `openssl rand -hex 32`. Make sure `.env` is in `.gitignore`.

## Step 6: Install and build

```bash
cd /var/www/myapp
npm ci                  # exact versions from package-lock.json
npm run build           # Next.js: creates .next/ (can take a few minutes)
```

Test it by hand first:

```bash
PORT=3000 npm start &
curl -I http://127.0.0.1:3000      # expect HTTP/1.1 200 OK
kill %1                            # stop the test process
```

> ⚠️ **Small servers and builds:** `next build` can use more than 1 GB of RAM. On a 1–2 GB VPS it may be killed (`Killed` or exit code 137). Add swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`), or build in CI and copy the result to the server (lesson 9).

## Step 7: Run it with systemd

```bash
sudo tee /etc/systemd/system/myapp.service > /dev/null <<'EOF'
[Unit]
Description=myapp (Next.js)
After=network.target

[Service]
User=deploy
WorkingDirectory=/var/www/myapp
EnvironmentFile=/var/www/myapp/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now myapp
systemctl status myapp
sudo ss -ltnp | grep ':3000'       # confirm it's listening on the expected port
```

Make sure your `package.json` start script respects `PORT` (`next start` does; for Express use `process.env.PORT`). Binding to `127.0.0.1` is best: `next start -H 127.0.0.1`.

## Step 8: Nginx in front

```bash
sudo tee /etc/nginx/sites-available/myapp > /dev/null <<'EOF'
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/myapp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## Step 9: DNS and HTTPS

1. At your domain registrar, create an **`A` record** `example.com → 203.0.113.10` (and `www` as an `A` or `CNAME`).
2. Wait until `dig +short example.com` shows your server IP.
3. Get the certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com --redirect
```

## Step 10: Verify like a pro

```bash
systemctl is-active myapp                       # active
curl -I http://127.0.0.1:3000                   # app answers directly
curl -I https://example.com                     # 200 through Nginx + TLS
curl -I http://example.com                      # 301 → https
journalctl -u myapp -n 20 --no-pager            # no errors on start
sudo reboot                                     # the real test: does it come back?
```

After the reboot, `curl -I https://example.com` should work **without you doing anything**.

## Deploying updates

Every later release is the same four steps. Put them in `~/bin/deploy.sh` (the script from lesson 6):

```bash
cd /var/www/myapp
git pull --ff-only
npm ci
npm run build
sudo systemctl restart myapp
curl -fsS -o /dev/null http://127.0.0.1:3000 && echo "✅ healthy"
```

Two problems with this simple version, both solved in lesson 11:

- During `npm run build`, the **old** `.next` folder is being overwritten, so the running app can serve errors.
- If the build fails halfway, the site stays broken until you fix it.

## Running more than one app on the same server

Give each app **its own folder, user (optional), port, systemd unit and Nginx server block**:

| App | Folder | Port | Unit | Domain |
| --- | --- | --- | --- | --- |
| Shop | `/var/www/shop` | 3000 | `shop.service` | `shop.example.com` |
| Academy | `/var/www/academy` | 3001 | `academy.service` | `academy.example.com` |

Write the port in **one place** per app (the `.env` file read by systemd) and use the same number in Nginx. Before a new deploy, `sudo ss -ltnp` shows exactly which process owns each port, so you never stop or proxy to the wrong app.

## Troubleshooting the first deploy

| Problem | Fix |
| --- | --- |
| `npm ci` fails with `gyp ERR!` | `sudo apt install build-essential python3` |
| Build `Killed` | Add swap or build in CI |
| `status=203/EXEC` in systemd | Wrong path in `ExecStart`: check `which npm` |
| 502 Bad Gateway | App not running or on a different port: `systemctl status`, `ss -ltnp` |
| Certbot fails | DNS not pointing to the server yet, or port 80 closed |
| Works on `curl 127.0.0.1` but not from outside | Firewall or provider security group |
| `EACCES` writing files | Folder owned by root: `sudo chown -R deploy:deploy /var/www/myapp` |

## Key takeaways

- Order matters: **secure the server → install → clone → secrets → build → systemd → Nginx → HTTPS → verify**.
- Run the app as a **normal user** on **127.0.0.1**, with secrets in a `chmod 600` env file.
- Test each layer separately: the app on its port, then Nginx, then HTTPS, then a reboot.
- One app = one folder, one port, one systemd unit, one Nginx server block.

## Try it yourself

Rent the cheapest VPS you can find (or use a local VM with Multipass), and deploy any small Express or Next.js app through all ten steps. Finish with `sudo reboot` and confirm the site comes back by itself.
