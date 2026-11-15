---
title: "Processes, Services & systemd"
summary: "See what's running with ps and top, stop stuck programs, and turn your app into a systemd service that starts on boot, restarts after a crash, and logs to journald."
level: Beginner
tags: [linux, systemd, processes, journalctl, services]
---

## The big idea

If you start your app with `npm start` in an SSH window, it dies the moment you close that window. If it crashes at 3 a.m., it stays dead until you wake up. If the server reboots, nothing starts again.

**systemd** is Linux's **building manager**. You tell it once *"keep this app running"*, and it:

- starts the app when the server boots,
- restarts it if it crashes,
- collects its logs,
- lets you start, stop and check it with one command.

## Processes: what's running?

A **process** is a running program. Each one has a **PID** (process ID).

```bash
ps aux                        # every process
ps aux | grep node            # find Node processes
pgrep -a node                 # same, shorter
top                           # live view, sorted by CPU (q to quit)
htop                          # nicer live view (sudo apt install htop)
```

| Column in `top` / `ps` | Meaning |
| --- | --- |
| `PID` | Process ID |
| `USER` | Who runs it (should not be `root` for your app) |
| `%CPU` / `%MEM` | Resource use |
| `RES` | Real memory used |
| `COMMAND` | What it is |

**Load average** (`uptime`, top right of `top`): average number of processes waiting for CPU over 1, 5 and 15 minutes. On a 4-core server, a load above 4 means work is queuing.

## Stopping processes: signals

```bash
kill 12345          # politely ask PID 12345 to stop (SIGTERM, signal 15)
kill -9 12345       # force kill (SIGKILL): last resort, no cleanup
pkill -f "node server.js"
```

| Signal | Number | What it does |
| --- | --- | --- |
| `SIGTERM` | 15 | "Please stop": the app can finish requests and close connections |
| `SIGINT` | 2 | Same as pressing Ctrl+C |
| `SIGKILL` | 9 | Instant death: no cleanup, possible data loss |
| `SIGHUP` | 1 | Often means "reload your config" (Nginx) |

> 💡 Your app should handle `SIGTERM` gracefully: stop accepting requests, finish the ones in progress, close database connections, then exit. systemd, Docker and Kubernetes all send `SIGTERM` first.

## Which process is using a port?

```bash
sudo ss -ltnp                 # every listening TCP port and its process ⭐
sudo ss -ltnp | grep ':3000'  # who is on port 3000?
sudo lsof -i :3000            # alternative
```

`Error: listen EADDRINUSE :::3000` means another process already has that port. Find it with `ss`, then decide whether to stop it or use another port.

## systemd: turning your app into a service

![systemd starts the app on boot, restarts it after a crash, sends SIGTERM on stop, and sends its output to journald](/img/linux-devops/systemd-lifecycle.svg)

### Step 1: write a unit file

Create `/etc/systemd/system/myapp.service`:

```ini
[Unit]
Description=My Next.js app
After=network.target
# Wait for the database if it runs on the same server:
# After=network.target postgresql.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/myapp
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/var/www/myapp/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
# Give the app time to finish requests on stop
TimeoutStopSec=20
# Basic hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

| Line | Meaning |
| --- | --- |
| `After=network.target` | Start once networking is up |
| `User=deploy` | Run as a normal user, **not root** |
| `WorkingDirectory` | Like `cd` before starting |
| `EnvironmentFile` | Load `KEY=value` lines (secrets) from a file with `chmod 600` |
| `ExecStart` | The command to run. Use **full paths** (`which npm` shows them) |
| `Restart=always` + `RestartSec=5` | Restart 5 s after any exit or crash |
| `WantedBy=multi-user.target` | Start automatically on boot (after `enable`) |

> ⚠️ If you installed Node with **nvm**, `/usr/bin/npm` doesn't exist. Use the full path from `which npm` (for example `/home/deploy/.nvm/versions/node/v22.11.0/bin/npm`), or install Node system-wide from NodeSource so the path stays stable across upgrades.

### Step 2: load, start and enable

```bash
sudo systemctl daemon-reload          # re-read unit files after any change ⭐
sudo systemctl start myapp            # start now
sudo systemctl enable myapp           # start on every boot
sudo systemctl enable --now myapp     # both at once
sudo systemctl status myapp           # is it running? last log lines
```

### Everyday commands

| Command | What it does |
| --- | --- |
| `systemctl status myapp` | Running? Since when? Recent logs |
| `systemctl restart myapp` | Stop + start (after a deploy) |
| `systemctl reload nginx` | Re-read config without dropping connections (if supported) |
| `systemctl stop myapp` | Stop it |
| `systemctl disable myapp` | Don't start on boot |
| `systemctl is-active myapp` | Prints `active` / `failed`, handy in scripts |
| `systemctl list-units --type=service --state=failed` | Everything that's broken |

Reading `status`:

```text
● myapp.service - My Next.js app
     Loaded: loaded (/etc/systemd/system/myapp.service; enabled)
     Active: active (running) since Sat 2026-11-15 10:04:12 UTC; 2h ago
   Main PID: 48211 (npm start)
     Memory: 182.4M
```

`enabled` = starts on boot. `active (running)` = alive now. If you see `failed` or `activating (auto-restart)`, check the logs.

## Logs with `journalctl`

systemd captures everything your app prints to stdout and stderr (`console.log`, `console.error`).

```bash
journalctl -u myapp                 # all logs for the service
journalctl -u myapp -f              # follow live ⭐
journalctl -u myapp -n 100          # last 100 lines
journalctl -u myapp --since "1 hour ago"
journalctl -u myapp --since today -p err   # only errors
journalctl -b                       # everything since the last boot
journalctl --disk-usage             # how much space logs use
```

## Scheduled jobs with systemd timers

Timers are systemd's modern alternative to cron (the next lesson covers cron too):

```ini
# /etc/systemd/system/backup.service
[Service]
Type=oneshot
User=deploy
ExecStart=/home/deploy/bin/backup.sh

# /etc/systemd/system/backup.timer
[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now backup.timer
systemctl list-timers
```

Timers get logs in `journalctl -u backup` and run a missed job after downtime (`Persistent=true`).

## What about PM2?

**PM2** is a popular Node.js process manager with similar features (restart, logs, cluster mode). It's fine, but on a Linux server **systemd is already there**, is used for every other service, and integrates with the system logs. Pick one; don't run PM2 *inside* systemd *and* have systemd restart it too, unless you know why.

## Common problems

| Symptom | Likely cause | Check |
| --- | --- | --- |
| `status=203/EXEC` | `ExecStart` path is wrong | `which npm`, use the full path |
| `status=200/CHDIR` | `WorkingDirectory` doesn't exist | `ls -ld /var/www/myapp` |
| Keeps restarting | App crashes on start (missing env var, port in use) | `journalctl -u myapp -n 50` |
| Changes to the unit ignored | Forgot to reload | `sudo systemctl daemon-reload` |
| Works by hand, fails in systemd | Different user, PATH or env vars | Compare `env` with the unit's `Environment=` |
| `EADDRINUSE` | Port already taken | `sudo ss -ltnp \| grep :3000` |

## Key takeaways

- `ps`, `top`/`htop` and `ss -ltnp` show what's running and on which port.
- Stop with `kill` (SIGTERM) first; `kill -9` only as a last resort.
- A **systemd unit** keeps your app running, restarts it on crash, and starts it on boot.
- After editing a unit: `daemon-reload`, then `restart`. Check with `status`.
- Read logs with `journalctl -u myapp -f`.

## Try it yourself

Write a tiny Node server, create a systemd unit for it with `Restart=always`, enable it, then run `sudo kill -9 <PID>` and watch `systemctl status` bring it back within 5 seconds.
