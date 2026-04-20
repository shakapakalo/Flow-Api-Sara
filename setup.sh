#!/bin/bash
set -e

echo "======================================"
echo "  Flow by RSA — Setup"
echo "======================================"

# ── Step 1: Config ─────────────────────────────────────────────────────────
if [ ! -f flow2api/config/setting.toml ]; then
  echo "[1/5] Creating flow2api config from template..."
  cp flow2api/config/setting_example.toml flow2api/config/setting.toml
  echo "      ✓ Config created: flow2api/config/setting.toml"
  echo "      ⚠  Edit this file: change api_key, admin_username, admin_password"
else
  echo "[1/5] Config already exists — skipping"
fi

# ── Step 2: .env file ────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "[2/5] Creating .env from example..."
  cp .env.example .env
  echo "      ✓ .env created — edit it before going live!"
else
  echo "[2/5] .env already exists — skipping"
fi

# ── Step 3: Data directories ─────────────────────────────────────────────────
echo "[3/5] Creating data directories..."
mkdir -p flow2api/data flow2api/tmp
echo "      ✓ Directories ready"

# ── Step 4: Python dependencies ──────────────────────────────────────────────
echo "[4/5] Installing Python dependencies..."
cd flow2api
pip install -r requirements.txt -q
cd ..
echo "      ✓ Python deps installed"

# ── Step 5: Node dependencies ────────────────────────────────────────────────
echo "[5/5] Installing Node dependencies..."
if command -v pnpm &> /dev/null; then
  pnpm install -q
elif command -v npm &> /dev/null; then
  npm install -g pnpm && pnpm install -q
else
  echo "      ✗ pnpm/npm not found — skip Node setup"
fi
echo "      ✓ Node deps installed"

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "── Development (Replit) ───────────────"
echo "  Workflows start automatically."
echo "  Register at /register — first user is admin."
echo ""
echo "── VPS (Docker) ──────────────────────"
echo "  1. Edit .env  (set POSTGRES_PASSWORD, SESSION_SECRET, etc.)"
echo "  2. Edit flow2api/config/setting.toml (set api_key & admin password)"
echo "  3. docker compose -f docker-compose.vps.yml up -d --build"
echo "  4. Open http://your-server-ip in your browser"
echo "  5. Register — first account auto-becomes admin"
echo ""
echo "── Manual (no Docker) ────────────────"
echo "  1. Set env vars from .env"
echo "  2. Start Flow2API:   cd flow2api && python main.py"
echo "  3. Push DB schema:   pnpm --filter @workspace/db push"
echo "  4. Start API Server: pnpm --filter @workspace/api-server run dev"
echo "  5. Start Frontend:   pnpm --filter @workspace/image-tester run dev"
echo ""
