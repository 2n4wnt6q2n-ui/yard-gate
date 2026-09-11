#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl nginx
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
id -u www-data >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin www-data
mkdir -p /var/www/yard-gate
chown -R www-data:www-data /var/www/yard-gate
install -m 644 /var/www/yard-gate/deploy/yard-gate.service /etc/systemd/system/yard-gate.service
cat >/etc/nginx/sites-available/yard-gate <<'NGX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location /ws {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGX
ln -sfn /etc/nginx/sites-available/yard-gate /etc/nginx/sites-enabled/yard-gate
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now yard-gate
systemctl reload nginx
echo "Yard Gate clerk is up on port 80 /ws"
