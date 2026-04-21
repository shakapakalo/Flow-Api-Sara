#!/bin/bash
# ============================================================
# Flow by RSA - Nginx Setup Script
# Sets up nginx config + optional SSL with Let's Encrypt
# Usage: bash vps/nginx-setup.sh yourdomain.com
# ============================================================
set -e

DOMAIN="${1:-}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash vps/nginx-setup.sh yourdomain.com"
  exit 1
fi

echo "Setting up nginx for domain: $DOMAIN"

# Replace domain placeholder in nginx config
sed "s/YOUR_DOMAIN/$DOMAIN/g" "$APP_DIR/vps/nginx.conf" > /etc/nginx/sites-available/flowrsa

# Enable site
ln -sf /etc/nginx/sites-available/flowrsa /etc/nginx/sites-enabled/flowrsa

# Remove default nginx site if exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx

echo "Nginx configured for $DOMAIN"

# Ask about SSL
read -p "Setup SSL with Let's Encrypt? (y/n): " SETUP_SSL
if [ "$SETUP_SSL" = "y" ]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN"
  echo "SSL configured! Auto-renewal is handled by certbot."
fi

echo "Done! Visit http://$DOMAIN to check your app."
