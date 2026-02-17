#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/jaden/.openclaw/workspace/marineflow-poc/app"

echo "[deploy] cd $APP_DIR"
cd "$APP_DIR"

echo "[deploy] git status (non-fatal)"
git status --porcelain || true

echo "[deploy] npm ci"
npm ci

echo "[deploy] prisma migrate (deploy)"
# If you later switch to prisma migrate deploy, add a shadow DB etc.
# For now, keep dev-style migrations controlled by you.

# In production, prefer: npx prisma migrate deploy
if [ -d prisma/migrations ]; then
  npx prisma migrate deploy || true
fi

echo "[deploy] build"
npm run build

echo "[deploy] restart systemd service"
sudo systemctl restart marineflow

echo "[deploy] wait for health"
HEALTH_OK=0
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 0.5
done

if [ "$HEALTH_OK" != "1" ]; then
  echo "[deploy] ERROR: service did not become healthy in time"
  echo "[deploy] Last logs:"
  journalctl -u marineflow -n 80 --no-pager || true
  exit 1
fi

echo "[deploy] health check (json)"
curl -fsS http://127.0.0.1:3000/api/health | jq . || curl -fsS http://127.0.0.1:3000/api/health

echo "[deploy] done"
