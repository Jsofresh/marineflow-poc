# Deploy (VPS + systemd + Caddy)

## Services
- App service: `marineflow.service`
- Reverse proxy: `caddy.service`

## Quick commands

### Status
```bash
sudo systemctl status marineflow --no-pager
sudo systemctl status caddy --no-pager
```

### Logs
```bash
journalctl -u marineflow -n 200 --no-pager
journalctl -u caddy -n 200 --no-pager
```

### Restart
```bash
sudo systemctl restart marineflow
sudo systemctl restart caddy
```

### Health
- Local: `curl -fsS http://127.0.0.1:3000/api/health`
- Public: `https://poc.stanley-systems.com/api/health`

## Deploy script
From repo root:
```bash
chmod +x deploy.sh
./deploy.sh
```

Notes:
- For now, migrations are conservative.
- When ready for strict production workflows, we’ll use `prisma migrate deploy` consistently.
