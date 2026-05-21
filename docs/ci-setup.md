# Local CI Setup
> Forgejo on Fedora + Linux runner + macOS runner (Xcode builds)
> Actual steps as run — May 2026

---

## Infrastructure overview

```
Mac (dev)          — git push → Forgejo (ci.local:3000)
Mac (dev)          — macOS runner → handles iOS/watchOS Xcode builds
Fedora laptop      — Forgejo server + PostgreSQL + Linux runner
Linux runner       — handles relay-server (Node.js) + Android CI
```

---

## 1. Forgejo server on Fedora

### System prep

```bash
# Enable SSH first (Fedora doesn't ship with sshd active)
sudo dnf install openssh-server
sudo systemctl enable --now sshd
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

### avahi / mDNS (gives you ci.local instead of a raw IP)

```bash
sudo dnf install avahi nss-mdns
sudo systemctl enable --now avahi-daemon
sudo firewall-cmd --permanent --add-service=mdns
sudo firewall-cmd --reload
sudo hostnamectl set-hostname ci
# accessible as ci.local from any machine on the LAN
# restart avahi after hostname change:
sudo systemctl restart avahi-daemon
```

### PostgreSQL (native, not Docker)

```bash
sudo dnf install postgresql-server postgresql
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql

# Create DB and user
sudo -u postgres psql << 'EOF'
CREATE USER forgejo WITH PASSWORD 'changeme';
CREATE DATABASE forgejo OWNER forgejo ENCODING 'UTF8';
\q
EOF

# Switch pg_hba.conf from ident to md5 for TCP connections
sudo nano /var/lib/pgsql/data/pg_hba.conf
# Change these two lines:
#   host    all    all    127.0.0.1/32    md5
#   host    all    all    ::1/128         md5

sudo systemctl reload postgresql

# Test
psql -h 127.0.0.1 -U forgejo -d forgejo -W
```

If you get locked out: set the local line to `trust`, reload, reset password, set back.

### Forgejo binary

```bash
sudo useradd --system --create-home --home-dir /home/git --shell /bin/bash git

FORGEJO_VERSION="15.0.0"
sudo curl -Lo /usr/local/bin/forgejo \
  "https://codeberg.org/forgejo/forgejo/releases/download/v${FORGEJO_VERSION}/forgejo-${FORGEJO_VERSION}-linux-amd64"

# Must be owned by root — git:git breaks SELinux
sudo chown root:root /usr/local/bin/forgejo
sudo chmod +x /usr/local/bin/forgejo

# SELinux label
sudo semanage fcontext -a -t bin_t '/usr/local/bin/forgejo'
sudo restorecon -v /usr/local/bin/forgejo
sudo semanage port -a -t http_port_t -p tcp 3000
```

If SELinux still blocks after restorecon:
```bash
sudo ausearch -c 'forgejo' --raw | audit2allow -M forgejo-local
sudo semodule -X 300 -i forgejo-local.pp
```

### Directories + systemd

```bash
sudo mkdir -p /var/lib/forgejo/{custom,data,log}
sudo chown -R git:git /var/lib/forgejo
sudo chmod -R 750 /var/lib/forgejo
sudo mkdir -p /etc/forgejo
sudo chown root:git /etc/forgejo
sudo chmod 770 /etc/forgejo

sudo tee /etc/systemd/system/forgejo.service << 'EOF'
[Unit]
Description=Forgejo
After=network.target postgresql.service

[Service]
User=git
Group=git
WorkingDirectory=/var/lib/forgejo/
RuntimeDirectory=forgejo
ExecStart=/usr/local/bin/forgejo web --config /etc/forgejo/app.ini
Restart=always
RestartSec=5s
Environment=USER=git HOME=/home/git GITEA_WORK_DIR=/var/lib/forgejo

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now forgejo
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### First-run web setup

Open `http://ci.local:3000` and configure:
- **Database**: PostgreSQL, host `127.0.0.1:5432`, db `forgejo`, user `forgejo`
- **Domain**: `ci.local`
- **Base URL**: `http://ci.local:3000/`
- Create admin account

Then: **Admin panel → Actions → Runners → Enable**

### app.ini adjustments

`/etc/forgejo/app.ini`:

```ini
[server]
DOMAIN    = ci.local
ROOT_URL  = http://ci.local:3000/
HTTP_PORT = 3000
SSH_PORT  = 2222
START_SSH_SERVER = true

[database]
DB_TYPE = postgres
HOST    = 127.0.0.1:5432
NAME    = forgejo
USER    = forgejo
PASSWD  = changeme
```

```bash
sudo firewall-cmd --permanent --add-port=2222/tcp
sudo firewall-cmd --reload
sudo systemctl restart forgejo
```

---

## 2. Linux runner on Fedora

```bash
# v12.10.1 is latest as of May 2026
sudo curl -Lo /usr/local/bin/forgejo-runner \
  https://code.forgejo.org/forgejo/runner/releases/download/v12.10.1/forgejo-runner-12.10.1-linux-amd64
sudo chmod +x /usr/local/bin/forgejo-runner

# In Forgejo UI: Admin panel → Actions → Runners → Create new runner
# Copy the UUID and Token shown, then:
echo "PASTE_TOKEN" > /home/git/runner-token
sudo chown git:git /home/git/runner-token && sudo chmod 600 /home/git/runner-token

sudo -u git forgejo-runner generate-config > /home/git/.forgejo-runner.yaml
sudo chown git:git /home/git/.forgejo-runner.yaml

# Edit /home/git/.forgejo-runner.yaml — add at the bottom under connections:
#   connections:
#     heartbits-ci:
#       url: http://localhost:3000
#       uuid: PASTE_UUID_FROM_UI
#       token_url: file:///home/git/runner-token
#       labels:
#         - linux
#         - ubuntu-latest
#         - fedora

sudo tee /etc/systemd/system/forgejo-runner.service << 'EOF'
[Unit]
Description=Forgejo Runner
After=network.target forgejo.service

[Service]
User=git
Group=git
WorkingDirectory=/home/git
ExecStart=/usr/local/bin/forgejo-runner daemon --config /home/git/.forgejo-runner.yaml
Restart=always
RestartSec=5s
Environment=HOME=/home/git

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now forgejo-runner
```

---

## 3. macOS runner (Xcode builds)

No pre-built macOS binary exists — build from source (Go required):

```bash
cd /tmp
git clone https://code.forgejo.org/forgejo/runner forgejo-runner-src --depth=1
cd forgejo-runner-src
go build -o ~/bin/forgejo-runner .
```

### Registration — config file approach (v12+)

`register` is fully deprecated in v12+. The UI creates the runner entry and hands you credentials.

**In Forgejo UI: Admin panel → Actions → Runners → Create new runner**

The page shows you both a **UUID** and a **Token** — copy both immediately.

```bash
echo "PASTE_TOKEN_FROM_UI" > ~/Projects/ci-token
```

Generate the config and add the connection:

```bash
~/bin/forgejo-runner generate-config > ~/.forgejo-runner.yaml
```

Edit `~/.forgejo-runner.yaml` — find `connections:` at the bottom and add:

```yaml
  connections:
    heartbits-ci:
      url: http://192.168.1.12:3000
      uuid: PASTE_UUID_FROM_UI
      token_url: file:///Users/laztoum/Projects/ci-token
      labels:
        - macos
        - macos-latest
        - self-hosted
```

**Critical**: labels must be a YAML list — a comma-separated string registers as a single label
and breaks `runs-on` matching in workflows. The UUID must come from the Forgejo UI; a
self-generated UUID will be rejected as "unregistered runner".

### LaunchAgent

**Important**: use the direct IP (`192.168.1.12`), not `ci.local` — mDNS does not resolve
reliably in LaunchAgent context at login.

`~/Library/LaunchAgents/io.forgejo.runner.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.forgejo.runner</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/laztoum/bin/forgejo-runner</string>
        <string>daemon</string>
        <string>--config</string>
        <string>/Users/laztoum/.forgejo-runner.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/forgejo-runner.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/forgejo-runner-err.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/io.forgejo.runner.plist
tail -f /tmp/forgejo-runner-err.log
```

Note: runner may fail the first few attempts at login before the network settles — KeepAlive
handles restarts automatically.

---

## 4. Pushing to Forgejo from Mac

```bash
# SSH (preferred)
git remote add origin ssh://git@ci.local:2222/laztoum/Heartbits.git

# HTTP fallback
git remote add origin http://ci.local:3000/laztoum/Heartbits.git

git push -u origin main
```

---

## Quick reference

| Thing | Command / URL |
|---|---|
| Forgejo UI | `http://ci.local:3000` |
| Runner admin | `http://ci.local:3000/-/admin/runners` |
| Forgejo logs | `sudo journalctl -u forgejo -f` |
| Linux runner logs | `sudo journalctl -u forgejo-runner -f` |
| macOS runner logs | `tail -f /tmp/forgejo-runner-err.log` |
| Fedora IP | `192.168.1.12` |
