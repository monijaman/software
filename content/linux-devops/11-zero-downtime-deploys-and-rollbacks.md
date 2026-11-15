---
title: Zero-Downtime Deploys & Rollbacks
summary: "Stop breaking the site while you deploy: build into separate release folders, switch with an atomic symlink, run two instances for blue-green releases, handle database migrations safely, and roll back in seconds."
level: Advanced
tags: [deployment, zero-downtime, blue-green, rollback, migrations, devops]
---

## The big idea

Changing a tyre while the car is moving is impossible. But **swapping to a second car that's already running** is easy: get it ready beside the first, step across, and drive off.

The simple deploy (`git pull && npm run build && systemctl restart`) changes the tyre **on the moving car**:

1. `git pull` changes the source files **while the old version is still running**.
2. `npm run build` overwrites `.next/` **under the running app**, so visitors may get errors or missing pages.
3. If the build fails, the site stays **half-broken** until someone fixes it.
4. `systemctl restart` leaves a gap of a few seconds where Nginx returns **502**.

Zero-downtime deployment means **prepare the new version completely beside the old one, then switch in an instant**, and keep the old one around so you can switch back.

![Each deploy goes into its own release folder; the current symlink is switched atomically, and rollback points it back to the previous release](/img/linux-devops/release-symlinks.svg)

## Level 1: Release folders + atomic symlink

```text
/var/www/myapp/
├── releases/
│   ├── 20261114-0930-a1b2c3d/
│   ├── 20261115-1012-e4f5a6b/
│   └── 20261115-1530-9c8d7e6/      ← newest
├── shared/
│   ├── .env                          ← one copy, linked into every release
│   └── uploads/
└── current -> releases/20261115-1530-9c8d7e6
```

- Each deploy builds in a **brand-new folder**. The running app is never touched.
- `current` is a **symlink**. systemd runs the app from `/var/www/myapp/current`.
- Switching versions = repointing one symlink, which is **atomic**: there is never a moment when `current` points nowhere.
- A failed build leaves `current` alone, so **the site keeps running the old version**.

The systemd unit points at the symlink:

```ini
[Service]
WorkingDirectory=/var/www/myapp/current
EnvironmentFile=/var/www/myapp/shared/.env
ExecStart=/usr/bin/npm start
```

### The deploy script

```bash
#!/usr/bin/env bash
# deploy.sh: build a new release beside the old one, then switch
set -euo pipefail

BASE="/var/www/myapp"
REPO="git@github.com:your-org/myapp.git"
REF="${1:-main}"
SERVICE="myapp.service"
HEALTH="http://127.0.0.1:3000/"
KEEP=5

RELEASE="$BASE/releases/$(date +%Y%m%d-%H%M%S)"
log() { echo "[$(date +%T)] $*"; }

log "Cloning $REF into $RELEASE"
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$RELEASE" 2>/dev/null \
  || { git clone --quiet "$REPO" "$RELEASE" && git -C "$RELEASE" checkout --quiet "$REF"; }

log "Linking shared files"
ln -s "$BASE/shared/.env" "$RELEASE/.env"
ln -s "$BASE/shared/uploads" "$RELEASE/uploads"

log "Installing and building (the live site is untouched)"
cd "$RELEASE"
npm ci --no-audit --no-fund
npm run build

PREVIOUS="$(readlink -f "$BASE/current" || true)"

log "Switching current → $RELEASE"
ln -sfn "$RELEASE" "$BASE/current.tmp"
mv -T "$BASE/current.tmp" "$BASE/current"      # atomic rename

sudo systemctl restart "$SERVICE"

log "Health check"
for i in {1..20}; do
  if curl -fsS -o /dev/null "$HEALTH"; then
    log "✅ Live: $(git rev-parse --short HEAD)"
    ls -1dt "$BASE"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf   # keep the last 5
    exit 0
  fi
  sleep 2
done

log "❌ Unhealthy. Rolling back to $PREVIOUS"
if [[ -n "$PREVIOUS" ]]; then
  ln -sfn "$PREVIOUS" "$BASE/current.tmp" && mv -T "$BASE/current.tmp" "$BASE/current"
  sudo systemctl restart "$SERVICE"
fi
exit 1
```

> 💡 `ln -sfn new current` alone is *almost* atomic; creating a temporary link and `mv -T` onto `current` is truly atomic on Linux, because a rename is a single filesystem operation.

### Rollback in seconds

```bash
cd /var/www/myapp
ls -1t releases/                          # newest first
ln -sfn releases/20261115-1012-e4f5a6b current.tmp && mv -T current.tmp current
sudo systemctl restart myapp
```

No rebuild, no `git revert`, no waiting for CI. Fix the bug calmly afterwards.

This leaves one gap: the **few seconds** while the single process restarts.

## Level 2: Blue-green with two instances

Run **two copies** of the app on two ports. Deploy to the idle one, check it, then tell Nginx to switch.

![Nginx points at the blue instance on port 3000; green on 3001 gets the new version, passes its health check, and Nginx switches with a reload](/img/linux-devops/blue-green.svg)

**Two systemd instances from one template**, `/etc/systemd/system/myapp@.service`:

```ini
[Unit]
Description=myapp on port %i

[Service]
User=deploy
WorkingDirectory=/var/www/myapp/slot-%i
EnvironmentFile=/var/www/myapp/shared/.env
Environment=PORT=%i
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now myapp@3000 myapp@3001
```

**Nginx upstream in its own small file**, `/etc/nginx/conf.d/myapp-upstream.conf`:

```nginx
upstream myapp {
    server 127.0.0.1:3000;     # the live slot
}
```

```nginx
# in the server block
location / {
    proxy_pass http://myapp;
    include /etc/nginx/proxy_params;
}
```

**Switching:**

```bash
LIVE=$(grep -oE '127.0.0.1:[0-9]+' /etc/nginx/conf.d/myapp-upstream.conf | cut -d: -f2)
IDLE=$([[ "$LIVE" == 3000 ]] && echo 3001 || echo 3000)

# 1. deploy the new release into slot-$IDLE, then:
sudo systemctl restart "myapp@$IDLE"
curl -fsS "http://127.0.0.1:$IDLE/" > /dev/null    # 2. check the idle slot directly

# 3. point Nginx at it; reload keeps existing connections alive
echo "upstream myapp { server 127.0.0.1:$IDLE; }" | sudo tee /etc/nginx/conf.d/myapp-upstream.conf
sudo nginx -t && sudo systemctl reload nginx
```

`nginx reload` starts new worker processes with the new config while the old workers finish their current requests, so **no request is dropped**. Rollback = switch the upstream back.

> 💡 A simpler variant: list **both** instances in the upstream and restart them **one at a time** (a *rolling* restart). Nginx automatically retries the other instance while one is down (`proxy_next_upstream error timeout http_502;`).

## Database migrations without downtime

Code can switch in a second. The database can't, and **both versions of the code run at the same time** during a switch. So every migration must work with **old and new code** at once.

Use **expand → migrate → contract**:

| Step | Example: rename `name` to `full_name` | Safe because |
| --- | --- | --- |
| **1. Expand** | Add `full_name` (nullable). Code writes **both** columns | Old code ignores the new column |
| **2. Migrate** | Backfill `full_name` from `name` in batches | No locks on the whole table |
| **3. Switch** | Code reads `full_name` | Both columns are still filled |
| **4. Contract** | Later release: drop `name` | No running code uses it any more |

| ❌ Breaks during deploy | ✅ Safe |
| --- | --- |
| `RENAME COLUMN` in one go | Expand, migrate, contract |
| `ADD COLUMN … NOT NULL` with no default on a big table | Add nullable → backfill → add the constraint |
| Dropping a column the old code still reads | Drop it one release later |
| A long `ALTER TABLE` that locks writes at peak time | `CREATE INDEX CONCURRENTLY`, off-peak, or online schema tools |

Run migrations as an **explicit step before switching traffic**, and never put a destructive migration in the same release as the code that stops using the column.

## Graceful shutdown

Even with blue-green, each old process must finish in-flight requests before exiting:

```js
const server = app.listen(process.env.PORT);

process.on("SIGTERM", () => {
  server.close(async () => {      // stop accepting new connections, finish current ones
    await db.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();   // hard stop if stuck
});
```

Match systemd's `TimeoutStopSec=` to that timeout.

## Choosing a strategy

| Strategy | Downtime | Rollback | Extra resources | Good for |
| --- | --- | --- | --- | --- |
| In-place (`git pull && build && restart`) | Seconds to minutes, broken builds possible | Slow (rebuild) | None | Hobby projects |
| **Release folders + symlink** ⭐ | A few seconds (restart) | **Seconds** | Disk for a few releases | Most single-server apps |
| **Blue-green** (two slots) | None | Seconds | 2× app memory | Busy single servers |
| Rolling (many servers or pods) | None | Minutes | Spare capacity | Clusters, Kubernetes |
| Canary (send 5% of traffic first) | None | Seconds | Traffic splitting | High-risk changes at scale |

## Key takeaways

- Never build **in place**: build each release in its own folder.
- Switch with an **atomic symlink** and keep the last few releases for instant rollback.
- **Blue-green** with two ports and an `nginx reload` removes the restart gap entirely.
- Old and new code run together during a switch, so migrations must follow **expand → migrate → contract**.
- Handle `SIGTERM` so in-flight requests finish.
- The deploy script should **health-check** and **roll back automatically** when the new version fails.

## Try it yourself

Convert a simple in-place deploy into release folders with a `current` symlink. Deploy a version with a deliberate startup error (for example `throw new Error("boom")` at the top of the server) and confirm the script rolls back and the site never goes down.
