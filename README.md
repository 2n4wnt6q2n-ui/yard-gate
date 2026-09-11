# Yard Gate

Wholesale meat auction. Farmers apply for $20 and keep the hammer. Buyers bid over a WebSocket clerk.

Repo: https://github.com/2n4wnt6q2n-ui/yard-gate
Static preview: https://yard-gate-ernesto22.vercel.app

## On this repo

- Clerk: `server.js`, `ws-lite.js`, `mail.js`, `totp.js`, `secret-store.js`
- Desk: `join.html`, `desk.html`, `verify.html`, `account.js`, `privacy.html`
- Board: `index.html`, `lots.html`, `apply.html`, `buy.html`, `auction.js`
- Vercel: install command `echo skip-install` in `vercel.json`

Secrets are not in git: `accounts.json`, `sessions.json`, `totp.key`, `totp-secrets.json`.

## VPS

```bash
sudo git clone https://github.com/2n4wnt6q2n-ui/yard-gate.git /var/www/yard-gate
cd /var/www/yard-gate
sudo bash deploy/setup.sh
```
