# Yard Gate

Wholesale meat auction board. Farmers apply for $20 and keep the hammer. Buyers bid over a WebSocket clerk.

Public preview (static only, no live bids): https://yard-gate-ernesto22.vercel.app

## Run the clerk (Hetzner / any VPS)

```bash
sudo mkdir -p /var/www
sudo git clone https://github.com/2n4wnt6q2n-ui/yard-gate.git /var/www/yard-gate
cd /var/www/yard-gate
sudo bash deploy/setup.sh
```

Then open `http://YOUR_SERVER_IP`. Bids on two browsers share the same clock.

Local:

```bash
node server.js
```

Opens at http://localhost:8787
