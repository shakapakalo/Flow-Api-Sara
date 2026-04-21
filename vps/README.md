# Flow by RSA — VPS Deployment Guide

Simple 3-step deployment on any Ubuntu 22.04 VPS via Git.

---

## Architecture

```
Internet → Nginx :80/:443
               ├── /        → Frontend (React static files)
               ├── /api/    → API Server (Node.js :3001)
               └── /manage  → Flow2API (Python :8000)

PM2 manages:
  • flowrsa-api       — Node.js Express API
  • flowrsa-flow2api  — Python FastAPI (Flow2API)

Database: PostgreSQL (local)
```

---

## Step 1 — First Time Setup (do once)

```bash
# On your VPS as root:
git clone https://github.com/YOUR_USER/YOUR_REPO.git /var/www/flowrsa
cd /var/www/flowrsa
bash vps/setup.sh
```

**Save the DATABASE_URL** printed at the end — you'll need it for `.env`.

---

## Step 2 — Configure Environment

```bash
cd /var/www/flowrsa
cp vps/.env.example .env
nano .env   # Fill in DATABASE_URL, SESSION_SECRET
```

**Required values:**
| Variable | Description |
|---|---|
| `DATABASE_URL` | From setup.sh output |
| `SESSION_SECRET` | Any random string (`openssl rand -base64 32`) |

---

## Step 3 — Deploy

```bash
cd /var/www/flowrsa
bash vps/deploy.sh
```

This will:
1. Pull latest code from Git
2. Install all dependencies (Node + Python)
3. Build frontend + API
4. Push DB schema
5. Start/restart all services with PM2

---

## Step 4 — Setup Nginx + Domain (optional)

```bash
bash vps/nginx-setup.sh yourdomain.com
```

This configures nginx and optionally sets up free SSL via Let's Encrypt.

---

## Updating the App

Every time you push code to Git, just run on VPS:

```bash
cd /var/www/flowrsa && bash vps/deploy.sh
```

---

## Useful Commands

```bash
pm2 list                    # Check all services
pm2 logs flowrsa-api        # API server logs
pm2 logs flowrsa-flow2api   # Flow2API logs
pm2 restart all             # Restart everything
pm2 stop all                # Stop everything

nginx -t                    # Test nginx config
systemctl reload nginx      # Reload nginx
```

---

## Minimum VPS Requirements

| Resource | Minimum |
|---|---|
| OS | Ubuntu 22.04 LTS |
| RAM | 2 GB |
| Storage | 20 GB |
| CPU | 2 vCPU |
