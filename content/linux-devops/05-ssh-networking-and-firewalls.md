---
title: "SSH, Networking & Firewalls"
summary: "Log in with SSH keys instead of passwords, harden the SSH server, understand IPs, ports and DNS, test connections with curl and ss, and lock the server down with ufw and fail2ban."
level: Beginner
tags: [linux, ssh, networking, firewall, ufw, security]
---

## The big idea

A server on the internet is like a **house on a busy street**. Within minutes of going online, bots start trying the door handles: thousands of password guesses per hour on SSH.

You protect it in three layers:

1. **A key instead of a password:** SSH keys are practically impossible to guess.
2. **Locks on every door you don't use:** a firewall closes all ports except the few you need.
3. **A guard at the door:** fail2ban bans IPs that keep failing to log in.

## SSH keys: how they work

SSH keys come in a **pair**:

- the **private key** stays on your laptop and **never** leaves it (like your house key),
- the **public key** is copied to the server (like the lock).

![The server holds the public key and sends a challenge; only the laptop's private key can answer it, so no password crosses the network](/img/linux-devops/ssh-keys.svg)

### Create a key and copy it to the server

```bash
# On your laptop
ssh-keygen -t ed25519 -C "ana@laptop"      # press Enter for the default path, set a passphrase
#  → ~/.ssh/id_ed25519      (private: never share)
#  → ~/.ssh/id_ed25519.pub  (public: safe to share)

ssh-copy-id deploy@203.0.113.10            # adds your public key to the server
ssh deploy@203.0.113.10                    # log in, no password needed
```

On the server, public keys live in `~/.ssh/authorized_keys`, one per line. Permissions matter: SSH refuses to use keys that others can read.

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Save typing with `~/.ssh/config`

```ini
# ~/.ssh/config on your laptop
Host myserver
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    Port 22
```

Now `ssh myserver`, `scp file myserver:/tmp/` and `rsync -av dist/ myserver:/var/www/myapp/` all just work.

### Copying files

```bash
scp backup.sql myserver:/tmp/                      # copy one file up
scp myserver:/var/log/nginx/error.log .            # copy one file down
rsync -avz --delete build/ myserver:/var/www/site/ # sync a folder (only changed files)
```

## Hardening the SSH server

Edit `/etc/ssh/sshd_config` (or add a file in `/etc/ssh/sshd_config.d/`):

```ini
PermitRootLogin no              # nobody logs in as root directly
PasswordAuthentication no       # keys only: password guessing becomes useless
PubkeyAuthentication yes
KbdInteractiveAuthentication no
MaxAuthTries 3
AllowUsers deploy ana           # only these accounts may log in
```

```bash
sudo sshd -t                    # test the config for typos FIRST
sudo systemctl reload ssh       # (the service is "sshd" on some distributions)
```

> ⚠️ **Don't lock yourself out.** Before disabling passwords, confirm key login works. Keep your current SSH session open, and test the new settings from a **second** terminal. Most VPS providers also offer a web console as a last resort.

## Networking basics you'll actually use

| Concept | Meaning | Example |
| --- | --- | --- |
| **IP address** | The server's address on the network | `203.0.113.10` (public), `10.0.0.5` (private) |
| **Port** | Which program on that server | 22 = SSH, 80 = HTTP, 443 = HTTPS, 5432 = PostgreSQL |
| **localhost / 127.0.0.1** | "This same machine". Not reachable from outside | Your app on `127.0.0.1:3000` behind Nginx |
| **0.0.0.0** | "Listen on every network interface", which is reachable from outside if the firewall allows | Often a mistake for databases |
| **DNS** | Turns a name into an IP | `example.com` → `203.0.113.10` |
| **TCP** | Reliable connection used by HTTP, SSH and databases | |

> 💡 **Bind internal services to `127.0.0.1`**, not `0.0.0.0`. Your Node app and database don't need to be reachable from the internet. Only Nginx does.

### DNS records

| Record | Points | Example |
| --- | --- | --- |
| `A` | Name → IPv4 | `example.com → 203.0.113.10` |
| `AAAA` | Name → IPv6 | `example.com → 2001:db8::10` |
| `CNAME` | Name → another name | `www.example.com → example.com` |
| `MX` | Mail server | `example.com → mail.provider.com` |
| `TXT` | Text (verification, SPF) | `"v=spf1 include:…"` |

```bash
dig +short example.com          # what IP does the name point to?
dig +short www.example.com CNAME
nslookup example.com            # alternative
```

DNS changes can take minutes to hours to reach everyone, depending on the record's **TTL**.

## Testing connections

```bash
ping -c 4 example.com                    # is the host reachable? (some block ping)
curl -I https://example.com              # just the response headers ⭐
curl -v http://127.0.0.1:3000/health     # full detail, from ON the server
curl -o /dev/null -s -w "%{http_code} %{time_total}s\n" https://example.com
sudo ss -ltnp                            # which ports are listening, by which process
nc -zv db.internal 5432                  # can I open a TCP connection to that port?
traceroute example.com                   # the path packets take
```

A classic debugging sequence when a site doesn't load:

1. `dig +short example.com` → does DNS point to the right IP?
2. `curl -I http://127.0.0.1:3000` **on the server** → is the app itself answering?
3. `curl -I http://localhost` on the server → is Nginx answering?
4. `curl -I https://example.com` from your laptop → is the firewall open?

## Firewall with `ufw`

**ufw** ("uncomplicated firewall") is the easy front end on Ubuntu. Default rule: **block everything incoming, allow everything outgoing**, then open only what you need.

![The firewall lets ports 22, 80 and 443 in; the app on 3000 and the database on 5432 stay reachable only from inside the server](/img/linux-devops/firewall-ports.svg)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH            # port 22: ALLOW THIS FIRST or you lock yourself out
sudo ufw allow 80/tcp             # HTTP (needed for Let's Encrypt + redirect to HTTPS)
sudo ufw allow 443/tcp            # HTTPS
sudo ufw enable
sudo ufw status verbose
```

More examples:

```bash
sudo ufw allow from 198.51.100.7 to any port 22    # SSH only from your office IP
sudo ufw deny 3000                                 # make sure the app port is closed
sudo ufw delete allow 80/tcp                       # remove a rule
```

> ⚠️ **Docker bypasses ufw.** Publishing a container port with `-p 5432:5432` opens it to the world even if ufw says deny. Publish to localhost instead: `-p 127.0.0.1:5432:5432`. Cloud providers (AWS security groups, Hetzner firewall) add another firewall layer outside the server, which is a good second lock.

## fail2ban: ban repeat offenders

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd      # see banned IPs
```

## Security checklist for a new server

- [ ] Create a normal user, add it to `sudo`, log in with an **SSH key**
- [ ] `PermitRootLogin no`, `PasswordAuthentication no`
- [ ] `ufw`: allow only 22, 80, 443
- [ ] App and database listen on **127.0.0.1** only
- [ ] `fail2ban` for SSH
- [ ] Automatic security updates: `sudo apt install unattended-upgrades`
- [ ] Provider-level firewall or security group as a second layer

## Key takeaways

- Use **SSH keys** (ed25519): the private key never leaves your laptop.
- Disable root login and passwords, but test key login in a second session first.
- Ports: 22 SSH, 80 HTTP, 443 HTTPS. Bind apps and databases to **127.0.0.1**.
- Debug outside-in or inside-out with `dig`, `curl -I` and `ss -ltnp`.
- `ufw`: deny incoming by default, then allow only what you need. Watch out for Docker's published ports.

## Try it yourself

On a fresh VM: create a key, copy it with `ssh-copy-id`, disable password login, enable ufw with only SSH/HTTP/HTTPS, and run `sudo ss -ltnp` to confirm nothing else is listening on `0.0.0.0`.
