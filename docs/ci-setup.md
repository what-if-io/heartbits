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

# Get token: Admin panel → Actions → Runners → Create new runner
sudo -u git forgejo-runner register \
  --no-interactive \
  --instance "http://localhost:3000" \
  --token "PASTE_TOKEN" \
  --name "fedora-linux" \
  --labels "linux,ubuntu-latest,fedora" \
  --executor "auto"

sudo tee /etc/systemd/system/forgejo-runner.service << 'EOF'
[Unit]
Description=Forgejo Runner
After=network.target forgejo.service

[Service]
User=git
Group=git
WorkingDirectory=/home/git
ExecStart=/usr/local/bin/forgejo-runner daemon
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

### Registration

The `register` subcommand didn't work reliably. Instead, use the `daemon` command directly
with `--uuid` and `--token-url`:

1. Create a runner in Forgejo UI: **Admin panel → Actions → Runners → Create new runner**
2. Save the token to a file: `echo "TOKEN" > ~/Projects/ci-token`
3. Run once to test:
```bash
~/bin/forgejo-runner daemon \
  --url http://192.168.1.12:3000/ \
  --uuid $(uuidgen | tr '[:upper:]' '[:lower:]') \
  --token-url file:///Users/laztoum/Projects/ci-token \
  --label macos,macos-latest,self-hosted
```

### LaunchAgent

**Important**: use the direct IP (`192.168.1.12`), not `ci.local` — mDNS does not resolve
reliably in LaunchAgent context at login. The UUID below is the one registered with this
Forgejo instance; replace if re-registering.

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
        <string>--url</string>
        <string>http://192.168.1.12:3000/</string>
        <string>--uuid</string>
        <string>c44fc06d-4ccd-4788-8017-d23b57cea2c3</string>
        <string>--token-url</string>
        <string>file:///Users/laztoum/Projects/ci-token</string>
        <string>--label</string>
        <string>macos,macos-latest,self-hosted</string>
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
# logs: tail -f /tmp/forgejo-runner-err.log
```

Note: the runner may fail on the first few attempts at login before the network settles.
KeepAlive restarts it automatically.

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
