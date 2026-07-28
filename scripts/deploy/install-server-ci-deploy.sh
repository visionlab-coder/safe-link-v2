#!/usr/bin/env bash
# Run once on the production server as an administrator:
#   sudo bash install-server-ci-deploy.sh
set -euo pipefail

APP_ROOT=/home/ubuntu/safelink-v3
DEPLOY_USER=safelink-deploy
DEPLOY_HOME=/home/$DEPLOY_USER
ACTIVATOR=/usr/local/sbin/safelink-v3-activate-release
SUDOERS_FILE=/etc/sudoers.d/safelink-v3-github-deploy

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi

install -d -o ubuntu -g ubuntu -m 0755 "$APP_ROOT/releases"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0750 "$DEPLOY_HOME/incoming"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$DEPLOY_HOME/.ssh"
touch "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 0600 "$DEPLOY_HOME/.ssh/authorized_keys"
install -m 0755 "$(dirname "$0")/activate-release.sh" "$ACTIVATOR"

cat > /etc/systemd/system/safelink-v3-frontend.service <<'UNIT'
[Unit]
Description=SQ Link V3 Next.js Frontend
After=network-online.target safelink-v3-backend.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/safelink-v3/current/frontend
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
Environment=NEXT_PUBLIC_SAFE_LINK_API_BASE_URL=https://api.safe-link.co.kr
Environment=SAFE_LINK_INTERNAL_API_BASE_URL=http://localhost:8080
Environment=SAFE_LINK_PUBLIC_APP_URL=https://app.safe-link.co.kr
ExecStart=/usr/bin/node /home/ubuntu/safelink-v3/current/frontend/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/safelink-v3-backend.service <<'UNIT'
[Unit]
Description=SQ Link V3 Spring Boot API
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
EnvironmentFile=/etc/safelink/v3-backend.env
ExecStart=/usr/bin/java -jar /home/ubuntu/safelink-v3/current/backend/safe-link-v3-backend.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

cat > "$SUDOERS_FILE" <<'SUDOERS'
Cmnd_Alias SAFELINK_V3_DEPLOY = /usr/local/sbin/safelink-v3-activate-release *
safelink-deploy ALL=(root) NOPASSWD: SAFELINK_V3_DEPLOY
SUDOERS
chmod 0440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"
systemctl daemon-reload
echo "Server is prepared. The first GitHub Actions deployment creates /home/ubuntu/safelink-v3/current."
