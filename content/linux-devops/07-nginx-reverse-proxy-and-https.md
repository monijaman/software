---
title: "Nginx Reverse Proxy & HTTPS"
summary: "Put Nginx in front of your app: route domains to the right port, host several apps on one server, get a free Let's Encrypt certificate, and add compression, caching and security headers."
level: Intermediate
tags: [nginx, reverse-proxy, https, letsencrypt, certbot, tls]
---

## The big idea

A hotel **receptionist** greets every guest at the front door, checks who they are, and sends them to the right room. Guests never wander the corridors looking for rooms themselves.

**Nginx** is your server's receptionist. It listens on the public ports **80 (HTTP)** and **443 (HTTPS)**, handles the encryption, and forwards each request to the right app running privately on `127.0.0.1`.

![Nginx receives HTTPS traffic for several domains and forwards each one to a different app port on localhost](/img/linux-devops/nginx-reverse-proxy.svg)

## Why not expose the app directly?

| Nginx does… | So your app doesn't have to |
| --- | --- |
| **HTTPS / TLS** with automatic certificate renewal | Handle certificates in Node |
| **Several domains on one server** (one IP, many sites) | Fight over port 443 |
| **Serve static files** (images, CSS, JS) very fast | Spend Node's single thread on files |
| **Gzip/Brotli compression** | Compress responses |
| **Buffer slow clients** | Hold connections open for slow phones |
| **Rate limiting, security headers, request size limits** | Implement them all |
| **Keep the site up during restarts** with a friendly error page | Show browser errors |

## Install and the basic layout

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
curl -I http://localhost        # should return "Server: nginx"
```

| Path | Purpose |
| --- | --- |
| `/etc/nginx/nginx.conf` | Main config (rarely edited) |
| `/etc/nginx/sites-available/` | One file per site (Debian/Ubuntu style) |
| `/etc/nginx/sites-enabled/` | Symlinks to the sites that are switched on |
| `/etc/nginx/conf.d/*.conf` | Alternative location (RHEL style, Docker images) |
| `/var/log/nginx/access.log`, `error.log` | Request and error logs |

## A reverse proxy for one app

`/etc/nginx/sites-available/example.com`:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;

        # Pass the real visitor details to the app
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets (Next.js dev, Socket.IO, live updates)
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default     # remove the welcome page
sudo nginx -t                                   # ALWAYS test before reloading ⭐
sudo systemctl reload nginx                     # apply without dropping connections
```

> 💡 Without the `X-Forwarded-*` headers, your app sees every visitor as `127.0.0.1` and thinks every request is plain HTTP. In Express, also set `app.set("trust proxy", 1)`.

## Several apps on one server

Each app gets **its own port** and **its own `server` block**. Nginx picks the block whose `server_name` matches the requested domain:

```nginx
# /etc/nginx/sites-available/shop.example.com
server {
    listen 80;
    server_name shop.example.com;
    location / { proxy_pass http://127.0.0.1:3000; include /etc/nginx/proxy_params; }
}

# /etc/nginx/sites-available/academy.example.com
server {
    listen 80;
    server_name academy.example.com;
    location / { proxy_pass http://127.0.0.1:3001; include /etc/nginx/proxy_params; }
}
```

> ⚠️ The most common multi-app mistake is a **port mix-up**: the systemd unit starts the app on one port, but Nginx proxies to another (or to a *different* app's port). Check both sides: `sudo ss -ltnp` shows which process really owns each port, and `grep -r proxy_pass /etc/nginx/sites-enabled/` shows where Nginx sends traffic.

## Free HTTPS with Let's Encrypt

**Certbot** gets a free certificate, edits your Nginx config, and sets up automatic renewal.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
#  → proves you own the domain over port 80
#  → installs the certificate and adds "listen 443 ssl"
#  → optionally redirects HTTP to HTTPS (say yes)

sudo certbot renew --dry-run      # test auto-renewal
systemctl list-timers | grep certbot
```

Requirements: the domain's **DNS `A` record** must already point to the server, and **ports 80 and 443** must be open in the firewall.

After Certbot, the config looks roughly like this:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://example.com$request_uri;      # everything → HTTPS
}

server {
    listen 443 ssl;
    http2 on;
    server_name example.com www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    location / {
        proxy_pass http://127.0.0.1:3000;
        include /etc/nginx/proxy_params;
    }
}
```

Certificates last **90 days**; the certbot timer renews them automatically around day 60.

## Performance: compression and caching static files

```nginx
# Inside the server block
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;

# Next.js build assets have a hash in the name, so they can be cached "forever"
location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Or serve a folder straight from disk, without touching Node
location /uploads/ {
    alias /var/www/myapp/uploads/;
    expires 7d;
}

client_max_body_size 10m;     # allow uploads up to 10 MB (default is 1 MB)
```

## Security headers and rate limiting

```nginx
# In the http {} block (nginx.conf) — define the zone once
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

# In the server {} block
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
server_tokens off;            # hide the nginx version

location /api/login {
    limit_req zone=login burst=5 nodelay;
    proxy_pass http://127.0.0.1:3000;
    include /etc/nginx/proxy_params;
}
```

## Reading Nginx errors

| You see | Meaning | Check |
| --- | --- | --- |
| **502 Bad Gateway** | Nginx can't reach the app: it's down, or on a different port | `systemctl status myapp`, `ss -ltnp`, `proxy_pass` port |
| **504 Gateway Timeout** | The app is too slow to answer | App logs, slow queries, `proxy_read_timeout` |
| **413 Request Entity Too Large** | Upload bigger than `client_max_body_size` | Raise the limit |
| **404** from Nginx (not your app) | No `server_name` matched, or wrong `root` | `nginx -T \| grep server_name` |
| Welcome to nginx! | The default site is still enabled | Remove `sites-enabled/default` |
| Certificate warning | Wrong domain on the cert, or expired | `sudo certbot certificates` |

```bash
sudo tail -f /var/log/nginx/error.log      # the first place to look for 502/504
sudo nginx -T                              # print the full active config
```

## What about Apache, Caddy or OpenLiteSpeed?

| Server | Notes |
| --- | --- |
| **Nginx** | Most common reverse proxy, huge community, the examples above |
| **Caddy** | Automatic HTTPS with zero config, a very short config file. Great for small servers |
| **Apache** | Older, `.htaccess` per folder, common with PHP |
| **OpenLiteSpeed** | Fast, often bundled with WordPress hosting panels; has its own proxy settings in a web UI |
| **Traefik** | Popular with Docker, configures itself from container labels |

The concepts (listen on 443, match the domain, forward to `127.0.0.1:PORT`, add headers) are the same in all of them.

## Key takeaways

- Nginx listens on 80/443 and **proxies** each domain to an app on `127.0.0.1:PORT`.
- Always send `Host` and `X-Forwarded-*` headers so the app knows the real visitor and scheme.
- One `server` block per domain; check app ports with `ss -ltnp` to avoid mix-ups.
- `certbot --nginx` gives free HTTPS with automatic renewal.
- `nginx -t` before every `reload`; 502 means "app unreachable", 504 means "app too slow".

## Try it yourself

Run two tiny Node apps on ports 3000 and 3001. Configure Nginx so `a.localhost` goes to the first and `b.localhost` to the second, and check with `curl -H "Host: a.localhost" http://127.0.0.1`.
