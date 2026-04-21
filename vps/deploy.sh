#!/bin/bash
# ============================================================
# Flow by RSA - Deploy / Update Script
# Run this every time you want to update from Git
# Usage: bash vps/deploy.sh
# Run from project root: /var/www/flowrsa
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "======================================"
echo " Flow by RSA - Deploying..."
echo " Directory: $APP_DIR"
echo "======================================"

# 1. Pull latest code
echo "[1/7] Pulling latest code from Git..."
git pull origin main

# 2. Install Node dependencies
echo "[2/7] Installing Node dependencies..."
pnpm install --frozen-lockfile

# 3. Build API Server
echo "[3/7] Building API Server..."
pnpm --filter @workspace/api-server run build

# 4. Build Frontend
echo "[4/7] Building Frontend..."
pnpm --filter @workspace/image-tester run build

# 5. Push DB schema (safe, non-destructive)
echo "[5/7] Pushing database schema..."
pnpm --filter @workspace/db run push 2>/dev/null || echo "DB schema already up to date"

# 6. Setup Python venv + install deps for Flow2API
echo "[6/7] Installing Python dependencies..."
if [ ! -d "flow2api/.venv" ]; then
  python3 -m venv flow2api/.venv
fi
source flow2api/.venv/bin/activate
pip install -q -r flow2api/requirements.txt
deactivate

# 7. Start / Restart PM2
echo "[7/7] Starting services with PM2..."
pm2 startOrReload vps/pm2.config.js --update-env
pm2 save

echo ""
echo "======================================"
echo " Deploy Complete! Services running:"
pm2 list
echo "======================================"
