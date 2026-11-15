---
title: Linux Command-Line Essentials
summary: "Find your way around a Linux server: the folder layout, moving around, reading and editing files, pipes and redirection, and searching logs with grep and find."
level: Beginner
tags: [linux, shell, bash, command-line]
---

## The big idea

A Linux server usually has **no screen and no mouse**. You talk to it by typing commands into a **shell** (most often **Bash**). It feels slow for a day, then much faster than clicking, because commands can be **combined, repeated and automated**.

A command looks like this:

```bash
ls   -la   /var/log
#│     │      └── argument: what to act on
#│     └── options (flags): how to do it
#└── command: what to do
```

> 💡 Stuck? `man ls` opens the manual for any command, and `ls --help` gives a short summary. Press `q` to quit the manual.

## The Linux folder layout

Everything in Linux lives in **one tree** that starts at `/` (called "root"). There are no `C:` or `D:` drives.

![The Linux filesystem tree: etc for config, var for logs and websites, home for users, usr for programs](/img/linux-devops/linux-filesystem.svg)

| Folder | What lives there | You'll use it for |
| --- | --- | --- |
| `/etc` | System and app **configuration** | Nginx config, systemd units, SSH settings |
| `/var/log` | **Log files** | Finding out what went wrong |
| `/var/www` | Websites (by convention) | Your deployed app |
| `/home/<user>` | Each user's personal files (`~` is a shortcut) | Your scripts, SSH keys |
| `/root` | The root user's home | Rarely: avoid working as root |
| `/usr/bin`, `/usr/local/bin` | Installed **programs** | `node`, `git`, `nginx` |
| `/tmp` | Temporary files, cleared on reboot | Scratch work |
| `/opt` | Optional third-party software | Some vendor apps |

**Paths:**

- **Absolute** paths start at `/`: `/var/www/myapp/package.json`
- **Relative** paths start where you are: `./src` (here), `../` (one folder up), `~` (your home)

## Moving around

```bash
pwd                 # where am I?  → /home/deploy
ls                  # list files
ls -la              # long list, including hidden files (names starting with .)
ls -lh              # human-readable sizes (K, M, G)
cd /var/www/myapp   # go to a folder
cd ..               # up one level
cd ~                # home
cd -                # back to the previous folder
```

> ⌨️ Press **Tab** to auto-complete file names and commands. Press **↑** to repeat earlier commands, and **Ctrl+R** to search your command history.

## Working with files and folders

```bash
mkdir -p releases/2026-11-15   # create folders (-p: parents too, no error if exists)
touch notes.txt                # create an empty file
cp app.env app.env.bak         # copy
cp -r src/ backup-src/         # copy a folder (-r: recursive)
mv old.txt new.txt             # move or rename
rm notes.txt                   # delete a file (no recycle bin!)
rm -r old-folder/              # delete a folder and everything inside
ln -s releases/v42 current     # symbolic link (a shortcut), used for releases later
```

> ⚠️ **`rm` is permanent.** Never run `rm -rf` with a variable that might be empty (`rm -rf $DIR/` becomes `rm -rf /`). Double-check the path, and prefer `rm -ri` when unsure.

## Reading files

```bash
cat package.json          # print a whole (small) file
less /var/log/syslog      # scroll a big file (Space, b, /search, q)
head -n 20 app.log        # first 20 lines
tail -n 50 app.log        # last 50 lines
tail -f app.log           # FOLLOW new lines live (Ctrl+C to stop) ⭐
wc -l access.log          # count lines
```

## Editing files on a server

| Editor | Start | Save and quit | Best for |
| --- | --- | --- | --- |
| **nano** | `nano file` | `Ctrl+O`, `Enter`, `Ctrl+X` | Beginners, quick edits |
| **vim** | `vim file` | `Esc`, then `:wq`, `Enter` (`:q!` quits without saving) | Installed everywhere |

## Pipes and redirection: combining commands ⭐

The real power of the shell is **joining small commands together**.

| Symbol | Meaning | Example |
| --- | --- | --- |
| `\|` | Send the output of one command into the next | `cat access.log \| grep 500` |
| `>` | Write output to a file (overwrites) | `ls > files.txt` |
| `>>` | Append output to a file | `echo "done" >> deploy.log` |
| `2>` | Redirect errors | `npm run build 2> errors.txt` |
| `2>&1` | Send errors to the same place as output | `npm start > app.log 2>&1` |
| `&&` | Run the next command only if the first succeeded | `npm ci && npm run build` |
| `;` | Run the next command regardless | `cd /tmp; ls` |

```bash
# The 10 IP addresses making the most requests
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10
```

Read it left to right: take column 1 (the IP) → sort → count duplicates → sort by count, biggest first → keep the top 10.

## Searching: `grep` and `find`

**`grep` searches inside files:**

```bash
grep "ERROR" app.log                 # lines containing ERROR
grep -i "timeout" app.log            # ignore case
grep -rn "DATABASE_URL" /var/www/app # recursive, with line numbers
grep -v "healthcheck" access.log     # lines NOT matching
grep -c " 502 " access.log           # count matches
grep -E "500|502|504" access.log     # several patterns (regex)
```

**`find` searches for files:**

```bash
find /var/www -name "*.env"                  # by name
find /var/log -name "*.log" -size +100M      # bigger than 100 MB
find /tmp -type f -mtime +7                  # files not modified for 7+ days
find /tmp -type f -mtime +7 -delete          # …and delete them (check first!)
```

## Disk and system information

```bash
df -h            # free disk space per drive ⭐ (a full disk breaks everything)
du -sh *         # size of each item in this folder
du -sh /var/log  # size of one folder
free -h          # memory usage
uptime           # how long it's been running + load average
uname -a         # kernel version
cat /etc/os-release   # which Linux distribution (Ubuntu 24.04, Debian 12…)
```

## Installing software (Ubuntu / Debian)

```bash
sudo apt update             # refresh the list of available packages
sudo apt upgrade -y         # install security updates
sudo apt install -y nginx git curl
apt list --installed | grep nginx
sudo apt remove nginx
```

Other distributions use `dnf` (Fedora, RHEL, Amazon Linux) or `apk` (Alpine, common in Docker images).

## Cheat sheet

| Task | Command |
| --- | --- |
| Where am I / what's here | `pwd`, `ls -la` |
| Follow a log live | `tail -f file.log` |
| Search inside files | `grep -rn "text" folder/` |
| Find files | `find / -name "nginx.conf" 2>/dev/null` |
| Disk full? | `df -h`, then `du -sh /var/* \| sort -h` |
| Memory? | `free -h` |
| Command manual | `man command` |
| Previous command with sudo | `sudo !!` |

## Key takeaways

- Linux is **one tree from `/`**: config in `/etc`, logs in `/var/log`, apps often in `/var/www`.
- Learn the core verbs: `ls`, `cd`, `cp`, `mv`, `rm`, `cat`, `less`, `tail -f`.
- **Pipes (`|`) and redirection (`>`, `>>`, `2>&1`)** turn small commands into powerful tools.
- `grep` searches inside files, `find` searches for files, `df -h` checks the disk.
- `rm` has no undo. Check paths before deleting.

## Try it yourself

On any Linux machine (or WSL on Windows, or a free cloud VM):

1. Find the five biggest folders inside `/var` with `du -sh /var/* | sort -h | tail -5`.
2. Find every `.conf` file under `/etc` that mentions `listen`.
3. Count how many lines in `/var/log/syslog` (or `journalctl` output) contain the word `error`.
