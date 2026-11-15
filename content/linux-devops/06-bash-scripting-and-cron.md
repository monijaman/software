---
title: "Bash Scripting & Scheduled Jobs"
summary: "Write safe Bash scripts with variables, conditions, loops and functions, make them fail loudly with set -euo pipefail, build a real deploy script, and schedule jobs with cron."
level: Intermediate
tags: [linux, bash, scripting, cron, automation]
---

## The big idea

A **recipe card** lets anyone in the kitchen make the same dish, the same way, every time. A **Bash script** is a recipe card for your server: the exact commands, in the exact order, with checks so that a missing ingredient stops the cooking instead of ruining the meal.

If you've typed the same five commands to deploy twice, they belong in a script.

![A safe Bash script: shebang, strict mode, variables, checks, the main steps, and a clear exit code](/img/linux-devops/bash-script-anatomy.svg)

## Your first script

```bash
#!/usr/bin/env bash
# hello.sh: greet someone
set -euo pipefail

name="${1:-world}"          # first argument, or "world" if none was given
echo "Hello, ${name}!"
```

```bash
chmod +x hello.sh
./hello.sh            # Hello, world!
./hello.sh Ana        # Hello, Ana!
```

The first line (the **shebang**) says which program runs the file.

## Strict mode: `set -euo pipefail` ⭐

By default, Bash **keeps going after errors**. That's how a deploy script runs `npm run build`, which fails, and then happily restarts the app with a broken build.

| Option | Effect |
| --- | --- |
| `-e` | Exit immediately if any command fails |
| `-u` | Treat unset variables as errors (catches typos like `$DIRR`) |
| `-o pipefail` | A pipeline fails if **any** part fails, not just the last |

Start every script with `set -euo pipefail`.

## Variables and quoting

```bash
app_dir="/var/www/myapp"          # no spaces around =
today=$(date +%F)                 # command output → variable  (2026-11-15)
echo "Deploying to ${app_dir}"    # double quotes: variables expand
echo 'Cost: $5'                   # single quotes: everything literal
```

> ⚠️ **Always quote variables:** `"$file"`, not `$file`. A file name with a space ("my file.txt") would otherwise become two arguments, and an empty variable in `rm -rf $dir/` becomes `rm -rf /`.

**Special variables:**

| Variable | Meaning |
| --- | --- |
| `$1`, `$2`… | Script arguments |
| `$#` | Number of arguments |
| `$@` | All arguments (use as `"$@"`) |
| `$?` | Exit code of the last command (0 = success) |
| `$$` | This script's PID |
| `${VAR:-default}` | Value of `VAR`, or `default` if it's empty |

## Conditions

```bash
if [[ -f ".env" ]]; then
  echo ".env found"
elif [[ -f ".env.example" ]]; then
  echo "Copy .env.example to .env first" >&2
  exit 1
else
  echo "No env file at all" >&2
  exit 1
fi
```

| Test | True when |
| --- | --- |
| `-f file` | File exists |
| `-d dir` | Folder exists |
| `-z "$var"` | Variable is empty |
| `-n "$var"` | Variable is not empty |
| `"$a" == "$b"` | Strings are equal |
| `$n -gt 5` | Number greater than (also `-lt`, `-eq`, `-ge`) |

```bash
# Short form: run the right side only if the left side succeeds / fails
command -v node >/dev/null || { echo "node is not installed" >&2; exit 1; }
```

## Loops

```bash
for host in web1 web2 web3; do
  ssh "$host" "sudo systemctl restart myapp"
done

for file in /var/log/myapp/*.log; do
  gzip "$file"
done

# Retry until the app answers, up to 10 times
for i in {1..10}; do
  curl -fsS http://127.0.0.1:3000/health && break
  echo "Not ready yet ($i/10)…"; sleep 2
done
```

## Functions

```bash
log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

require() {
  command -v "$1" >/dev/null || { log "Missing: $1"; exit 1; }
}

require git
require npm
log "All tools present"
```

## A real deploy script

This is the manual deploy most small projects start with (`git pull`, `npm ci`, build, restart), written so it **stops on any error** and **checks the result**:

```bash
#!/usr/bin/env bash
# deploy.sh: update and restart the app on this server
set -euo pipefail

APP_DIR="/var/www/myapp"
SERVICE="myapp.service"
HEALTH_URL="http://127.0.0.1:3000/"

log() { echo "[$(date '+%F %T')] $*"; }

cd "$APP_DIR"

log "Pulling latest code"
git fetch --quiet origin
git reset --hard origin/main      # exactly what's on main, no local leftovers

log "Installing dependencies"
npm ci --no-audit --no-fund

log "Building"
npm run build

log "Restarting ${SERVICE}"
sudo systemctl restart "$SERVICE"

log "Waiting for the app to answer"
for i in {1..15}; do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then
    log "✅ Deploy finished: $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done

log "❌ App did not become healthy. Recent logs:"
journalctl -u "$SERVICE" -n 30 --no-pager
exit 1
```

> 💡 `npm ci` (not `npm install`) installs exactly what's in `package-lock.json`, deletes `node_modules` first, and fails if the lock file is out of sync. It's the right command for servers and CI.

Lesson 11 improves this script so a failed build never takes the site down.

## Exit codes

Every command returns a number: **0 = success**, anything else = failure. CI systems, systemd and other scripts read it.

```bash
grep -q "ERROR" app.log
echo $?        # 0 if found, 1 if not

exit 1         # make your script report failure
```

## Scheduling jobs with cron

**cron** runs commands on a schedule. Edit your schedule with `crontab -e`:

```text
┌───────── minute (0-59)
│ ┌─────── hour (0-23)
│ │ ┌───── day of month (1-31)
│ │ │ ┌─── month (1-12)
│ │ │ │ ┌─ day of week (0-6, Sunday = 0)
│ │ │ │ │
* * * * *  command
```

| Schedule | Meaning |
| --- | --- |
| `*/5 * * * *` | Every 5 minutes |
| `0 3 * * *` | Every day at 03:00 |
| `30 2 * * 1` | Mondays at 02:30 |
| `0 0 1 * *` | First day of every month at midnight |
| `@reboot` | Once, when the server starts |

```bash
# crontab -e
0 3 * * *  /home/deploy/bin/backup-db.sh >> /home/deploy/logs/backup.log 2>&1
*/10 * * * * curl -fsS https://example.com/health > /dev/null || /home/deploy/bin/alert.sh
```

Cron gotchas:

- Cron runs with a **tiny `PATH`** and no `.bashrc`. Use **full paths** (`/usr/bin/node`) or set `PATH=` at the top of the crontab.
- Cron's output is lost (or emailed) unless you redirect it: `>> file.log 2>&1`.
- Times are in the **server's timezone**. Check with `timedatectl`.
- For important jobs, prefer **systemd timers** (lesson 4): logs in journald and catch-up after downtime.

Use [crontab.guru](https://crontab.guru) to check a schedule in plain English.

## Debugging scripts

```bash
bash -x deploy.sh        # print every command as it runs
shellcheck deploy.sh     # find bugs before running (sudo apt install shellcheck) ⭐
```

ShellCheck catches unquoted variables, typos, and most of the classic mistakes on this page.

## Key takeaways

- Start scripts with `#!/usr/bin/env bash` and **`set -euo pipefail`**.
- **Quote every variable**: `"$var"`.
- Use functions for logging and checks, and `exit 1` on failure so callers know.
- A deploy script should stop on errors and **verify health** after restarting.
- Schedule with cron (full paths, redirect output) or systemd timers.
- Run `shellcheck` on every script.

## Try it yourself

Write `disk-alert.sh` that prints a warning and exits with code 1 when the root disk is more than 80% full. Hint: `df --output=pcent / | tail -1 | tr -dc '0-9'`. Then schedule it every 15 minutes with cron.
