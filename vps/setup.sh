#!/bin/bash
# ============================================================
# Flow by RSA - One-Time VPS Setup Script
# Run this ONCE on a fresh Ubuntu 22.04 VPS as root/sudo
# Usage: bash vps/setup.sh
# ============================================================
set -e

echo "======================================"
echo " Flow by RSA - VPS Setup Starting..."
echo "======================================"

# 1. Update system
apt-get update -y && apt-get upgrade -y

# 2. Install basics
apt-get install -y curl git nginx certbot python3-certbot-nginx \
  python3 python3-pip python3-venv build-essential

# 3. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 4. Install pnpm
npm install -g pnpm pm2

# 5. Install PostgreSQL
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# 6. Create PostgreSQL database + user
DB_NAME="flowrsa"
DB_USER="flowrsa"
DB_PASS="flowrsa$(date +%s | sha256sum | head -c 12)"

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true

echo ""
echo "======================================"
echo " DATABASE CREDENTIALS (SAVE THESE!)"
echo "======================================"
echo " DB Name: $DB_NAME"
echo " DB User: $DB_USER"
echo " DB Pass: $DB_PASS"
echo " DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo "======================================"
echo ""

# 7. Save DATABASE_URL to a temp file
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" > /root/db-credentials.txt
echo "Credentials saved to /root/db-credentials.txt"

# 8. Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root || true

echo ""
echo "======================================"
echo " Setup Complete!"
echo " Next steps:"
echo " 1. Clone your repo: git clone <your-repo-url> /var/www/flowrsa"
echo " 2. cd /var/www/flowrsa"
echo " 3. Copy .env: cp vps/.env.example .env  (then fill in values)"
echo " 4. Run deploy: bash vps/deploy.sh"
echo " 5. Setup nginx: bash vps/nginx-setup.sh YOUR_DOMAIN"
echo "======================================"
