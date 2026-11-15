---
title: Linux Troubleshooting Playbook & Interview Questions
summary: "A calm, layer-by-layer method for 'the site is down', fixes for the most common production problems (502, disk full, OOM, port in use, permission denied), and clear answers to Linux and DevOps interview questions."
level: Advanced
tags: [linux, troubleshooting, devops, interview, incident-response]
---

## The big idea

When the site goes down, the worst thing to do is **guess**: restart random services, edit config in a panic, redeploy. A doctor doesn't operate before checking the pulse.

Instead, **follow the request**, layer by layer, from the user to the database. At each layer, run one quick check. The first layer that fails is where the problem lives.

![Follow the request from DNS to firewall, Nginx, the app, and the database or disk; the first failing check shows where to look](/img/linux-devops/troubleshooting-flow.svg)

## The playbook: "the site is down"

| # | Layer | Check | If it fails |
| --- | --- | --- | --- |
| 0 | **What changed?** | Last deploy, config edit, certificate renewal, traffic spike | Roll back the last change first, then investigate |
| 1 | **DNS** | `dig +short example.com` | Wrong or missing record, expired domain |
| 2 | **Server reachable** | `ssh myserver`, `ping` | Server down, provider outage, firewall, out of memory (SSH hangs) |
| 3 | **Firewall / ports** | `sudo ufw status`, `sudo ss -ltnp` | Port 443 not open or not listening |
| 4 | **Nginx** | `systemctl status nginx`, `sudo nginx -t`, `tail /var/log/nginx/error.log` | Bad config, certificate problem, 502/504 |
| 5 | **App** | `systemctl status myapp`, `curl -I http://127.0.0.1:3000`, `journalctl -u myapp -n 100` | Crashed, crash loop, wrong port, missing env var |
| 6 | **Dependencies** | Database, Redis, external APIs | Connection refused, too many connections, slow queries |
| 7 | **Resources** | `df -h`, `free -h`, `uptime`, `dmesg -T \| tail` | Disk full, OOM kills, CPU saturated |

> 💡 **Mitigate first, then find the root cause.** If the last deploy broke production, roll it back in seconds (lesson 11), and *then* debug calmly with the site back up.

## The most common problems and fixes

### 502 Bad Gateway

Nginx is up, but **can't reach your app**.

```bash
systemctl status myapp                           # is it running at all?
sudo ss -ltnp | grep -E ':3000|:3001'            # which port is it REALLY on?
grep -r proxy_pass /etc/nginx/sites-enabled/     # which port is Nginx sending to?
sudo tail -n 20 /var/log/nginx/error.log         # "connect() failed (111: Connection refused)"
```

Typical causes: app crashed; app restarting after a deploy; the app listens on a **different port** than `proxy_pass`; the app listens only on IPv6 (`::1`) while Nginx uses `127.0.0.1`.

### 504 Gateway Timeout

The app is reachable but **too slow** (default 60 s). Look for slow database queries, a stuck external API, or the event loop blocked by heavy CPU work. Raising `proxy_read_timeout` hides the symptom; fix the slow work.

### Disk full

Symptoms: `No space left on device`, the database refuses writes, deploys fail, logs stop.

```bash
df -h                                     # which filesystem is full?
sudo du -xh / --max-depth=2 2>/dev/null | sort -h | tail -20   # where is the space?
sudo journalctl --vacuum-size=200M        # trim system logs
docker system df && docker image prune -a # old Docker images
ls -1dt /var/www/myapp/releases/* | tail -n +6   # old releases you can delete
sudo find /var/log -name "*.gz" -mtime +14 -delete
```

> ⚠️ A deleted file still uses space while a process holds it open. `sudo lsof +L1` lists them; restart that process to free the space.

### Out of memory (OOM killer)

The app disappears without an error in its own logs.

```bash
dmesg -T | grep -i -E "killed process|out of memory"
journalctl -k --since "1 hour ago" | grep -i oom
free -h
systemctl status myapp        # "Main process exited, code=killed, status=9/KILL"
```

Fixes: find the memory leak (heap snapshots), cap Node's heap (`node --max-old-space-size=768`), add swap as a safety net, set `MemoryMax=` in the systemd unit so one app can't take the whole server, or use a bigger server.

### "Address already in use" (EADDRINUSE)

```bash
sudo ss -ltnp | grep ':3000'      # users:(("node",pid=48211,...))
ps -fp 48211                      # what is it?
```

Often a **second copy** of the app started by hand (`npm start` in an old SSH session) while systemd also runs it. Stop the stray process, and only ever run the app through systemd.

### Crash loop after a deploy

```bash
systemctl status myapp           # "activating (auto-restart)"
journalctl -u myapp -n 50 --no-pager
```

Usual suspects: a new environment variable that isn't in the server's `.env`, a failed or partial build, a database migration that wasn't run, or a dependency that needs `build-essential`.

### Permission denied

```bash
whoami
ls -l /path/to/file
namei -l /path/to/file           # every folder on the way needs x permission
```

Fix the owner (`chown`) or group, not `chmod 777`.

### SSH: "Permission denied (publickey)"

```bash
ssh -v deploy@203.0.113.10       # verbose: which keys are offered?
# On the server (via the provider's web console):
ls -la ~deploy/.ssh               # .ssh must be 700, authorized_keys 600, owned by deploy
sudo tail /var/log/auth.log
```

### HTTPS certificate expired

```bash
sudo certbot certificates
sudo certbot renew --dry-run      # why doesn't renewal work? (port 80 blocked? DNS moved?)
systemctl list-timers | grep certbot
```

### "It works on my machine"

Compare the environments: `node -v`, `npm -v`, OS, environment variables, time zone, file name case (`Image.png` and `image.png` are **different** files on Linux), and whether the lock file was committed. Docker removes most of these differences.

## Useful one-liners

| Need | Command |
| --- | --- |
| Top memory users | `ps aux --sort=-%mem \| head` |
| Top CPU users | `ps aux --sort=-%cpu \| head` |
| Error count by status in Nginx | `awk '{print $9}' /var/log/nginx/access.log \| sort \| uniq -c \| sort -rn` |
| Slowest requests (with `$request_time` in the log format) | `awk '{print $NF, $7}' access.log \| sort -rn \| head` |
| What changed in /etc recently | `sudo find /etc -mmin -60 -type f` |
| Who logged in | `last -n 20` |
| Kernel messages | `dmesg -T \| tail -50` |
| Everything that failed since boot | `systemctl --failed`, `journalctl -b -p err` |

## After the incident: a blameless postmortem

Write down, briefly:

1. **What happened** and when (timeline).
2. **Impact:** how many users, for how long.
3. **Root cause:** keep asking "why?" until you reach something you can fix.
4. **What went well / badly** in detecting and fixing it.
5. **Action items** with owners: an alert that would have caught it earlier, a check in the deploy script, a runbook.

Blame the process, not the person. The goal is that the same problem can't happen the same way twice.

## Interview questions

<details>
<summary><strong>1. A user says the website is down. How do you troubleshoot?</strong></summary>

"First I confirm it and check what changed recently, such as a deploy or config change, and roll back if that's the likely cause. Then I follow the request layer by layer: DNS with `dig`, whether the server is reachable, whether ports 80/443 are open and listening with `ss -ltnp`, Nginx status and its error log, then the app itself with `systemctl status`, `curl` to its local port and `journalctl`. Finally I check dependencies like the database, and resources: disk with `df -h`, memory with `free -h`, and OOM kills in `dmesg`. The first failing layer tells me where to focus. Afterwards I write a short postmortem and add an alert for that failure."
</details>

<details>
<summary><strong>2. What does a 502 Bad Gateway mean, and how do you fix it?</strong></summary>

The reverse proxy is working but can't get a valid response from the upstream app. Check whether the app is running, which port it actually listens on (`ss -ltnp`) versus the `proxy_pass` port, and the Nginx error log (`connection refused` vs `upstream timed out`). A 504 means the app was reachable but too slow.
</details>

<details>
<summary><strong>3. Explain Linux file permissions. What does chmod 755 mean?</strong></summary>

Each file has an owner, a group, and read/write/execute bits for owner, group and others. In octal, r=4, w=2, x=1, so 755 = `rwxr-xr-x`: the owner can do everything, the group and others can read and execute. Secrets should be 600; 777 should never be used.
</details>

<details>
<summary><strong>4. What is systemd, and how do you keep a Node.js app running?</strong></summary>

systemd is the init system and service manager on most Linux distributions. I write a unit file with `User=`, `WorkingDirectory=`, `EnvironmentFile=`, `ExecStart=` and `Restart=always`, then `daemon-reload` and `enable --now`. It starts the app on boot, restarts it after crashes, sends `SIGTERM` on stop, and collects logs in journald (`journalctl -u myapp`).
</details>

<details>
<summary><strong>5. What is the difference between a process and a thread? What are signals?</strong></summary>

A process is a running program with its own memory; threads run inside a process and share its memory. Signals are messages to a process: `SIGTERM` (15) asks it to stop gracefully, `SIGKILL` (9) kills it immediately with no cleanup, `SIGINT` is Ctrl+C, and `SIGHUP` often means "reload config".
</details>

<details>
<summary><strong>6. How do you secure a new Linux server?</strong></summary>

Create a normal user with sudo, use SSH keys, disable root login and password authentication, enable a firewall that only allows 22/80/443, bind internal services such as the app and database to localhost, install fail2ban and automatic security updates, run apps as low-privilege users, keep secrets in files with 600 permissions, and add a provider-level firewall as a second layer.
</details>

<details>
<summary><strong>7. What is a reverse proxy, and why put Nginx in front of Node?</strong></summary>

A reverse proxy receives client requests and forwards them to backend servers. Nginx terminates TLS, routes several domains to different apps on one server, serves static files efficiently, compresses responses, buffers slow clients, adds security headers and rate limits, and can balance between multiple app instances.
</details>

<details>
<summary><strong>8. What is CI/CD?</strong></summary>

Continuous integration automatically builds and tests every change, so problems are found before merging. Continuous delivery/deployment automatically releases changes that pass to staging or production. A typical pipeline is checkout → install → lint → test → build → deploy, with secrets stored in the CI system, approvals for production, and no overlapping deploys.
</details>

<details>
<summary><strong>9. How do you deploy without downtime, and how do you roll back?</strong></summary>

Build each release in its own folder and switch an atomic `current` symlink, so a failed build never touches the live site. To remove the restart gap, run two instances (blue-green) and switch the Nginx upstream with a reload. Database changes follow expand → migrate → contract, so old and new code both work during the switch. Rollback means pointing back to the previous release or slot, which takes seconds and involves no rebuild.
</details>

<details>
<summary><strong>10. The disk is full. What do you do?</strong></summary>

`df -h` to find the full filesystem, `du` to find what's using it. Usual culprits are logs (vacuum journald, check logrotate), Docker images and build cache (`docker system prune`), old releases, and temporary files. Check `lsof +L1` for deleted files still held open. Then prevent it from happening again with log limits and a disk alert at 80–85%.
</details>

<details>
<summary><strong>11. How would you find what's using a port or slowing down a server?</strong></summary>

`ss -ltnp` (or `lsof -i :PORT`) shows which process owns a port. For slowness: `uptime` for load average, `htop` for CPU and memory per process, `free -h` and `dmesg` for memory pressure and OOM kills, `iostat`/`iotop` for disk I/O, and the application's own metrics and logs for slow endpoints.
</details>

<details>
<summary><strong>12. Docker vs a virtual machine?</strong></summary>

A VM virtualizes hardware and runs a full guest OS with its own kernel: strong isolation, but heavy and slow to start. A container shares the host's kernel and isolates processes with namespaces and cgroups: lightweight, starts in milliseconds, and packages the app with its dependencies into a portable image.
</details>

<details>
<summary><strong>13. What is the difference between a hard link and a symbolic link?</strong></summary>

A symbolic link is a small file that points to a path. It can cross filesystems and point to folders, but breaks if the target moves. A hard link is another name for the same data on disk, and the data lives until every hard link is removed. Deploys use symlinks for `current → releases/…`.
</details>

<details>
<summary><strong>14. What is load average?</strong></summary>

The average number of processes running or waiting for CPU (and on Linux, uninterruptible I/O) over 1, 5 and 15 minutes. Compare it with the number of CPU cores (`nproc`): a load of 8 on a 4-core machine means work is queuing.
</details>

<details>
<summary><strong>15. How do you manage secrets in deployments?</strong></summary>

Never commit them. On a single server, keep them in an env file owned by the app user with `chmod 600`, loaded by systemd's `EnvironmentFile=` or Compose's `env_file:`. In CI, use encrypted secrets scoped to environments. At larger scale, use a secrets manager (AWS Secrets Manager, Vault, Doppler), and rotate secrets when people leave or a leak is suspected.
</details>

## Key takeaways

- **Check what changed** and roll back first; investigate with the site back up.
- Follow the request: **DNS → server → firewall → Nginx → app → dependencies → resources**.
- 502 = app unreachable (often a port mismatch); 504 = app too slow.
- Disk full, OOM kills and stray processes on a port cause a huge share of real outages.
- After an incident, write a blameless postmortem and add the alert that would have caught it.

## Try it yourself

On a test server, break things on purpose one at a time: stop the app, change the Nginx `proxy_pass` port, fill the disk with `fallocate -l 5G /tmp/big`, and remove a variable from `.env`. For each one, practise finding the cause using only the playbook table.
