# Flow by RSA — AI Image & Video Generation Platform

A powerful AI media generation platform built on Google Flow/VideoFX (Flow2API). Supports 78+ models for image and video generation with a full user management system, pricing plans, and admin panel.

---

## Features

- **78+ AI Models** — 34 image + 44 video models (Veo 3.0, Imagen 4, etc.)
- **Img-to-Img Regeneration** — Transform existing images with AI
- **Text-to-Video / Image-to-Video** — Multiple video generation modes
- **Bulk Generation** — Generate with multiple prompts at once (paid plans)
- **Extend Video / First & End Frame / Interpolation** — Advanced video tools
- **User Auth** — Email/password registration, auto-approved accounts
- **Admin Panel** — User management, plan assignment, approval
- **Pricing Plans** — Promotion, Starter, Lite, Elite, Infinity, Infinity Pro, Super VEO
- **Download** — Individual files + Bulk ZIP download (images & videos)
- **Queue System** — Per-user generation queue for free users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| API Server | Node.js + Express + TypeScript |
| AI Backend | Python + FastAPI (Flow2API) |
| Database | PostgreSQL + Drizzle ORM |
| Process Manager | PM2 |
| Web Server | Nginx |

---

## VPS Deployment Guide

### Requirements

- **OS:** Ubuntu 22.04 LTS (recommended)
- **RAM:** 2 GB minimum
- **Storage:** 20 GB minimum
- **CPU:** 2 vCPU minimum
- **A domain name** (optional but recommended)

---

### Step 1 — Clone the Repo

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /var/www/flowrsa
cd /var/www/flowrsa
```

---

### Step 2 — One-Time Server Setup

Run this **once** on a fresh VPS as root:

```bash
bash vps/setup.sh
```

This installs: Node.js 20, pnpm, Python 3, PostgreSQL, Nginx, PM2, Certbot.

> **Important:** At the end, it prints your database credentials. **Save them!**
> They are also saved to `/root/db-credentials.txt`

---

### Step 3 — Configure Environment Variables

```bash
cp vps/.env.example .env
nano .env
```

Fill in these values:

```env
# From setup.sh output or /root/db-credentials.txt
DATABASE_URL=postgresql://flowrsa:YOUR_DB_PASS@localhost:5432/flowrsa

# Generate with: openssl rand -base64 32
SESSION_SECRET=your-random-secret-here

NODE_ENV=production
```

Optional email settings (leave blank to disable):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
```

---

### Step 4 — Deploy the App

```bash
bash vps/deploy.sh
```

This automatically:
1. Pulls latest code from Git
2. Installs Node.js dependencies (`pnpm install`)
3. Builds the API server
4. Builds the React frontend
5. Pushes database schema (safe, non-destructive)
6. Sets up Python virtual environment + installs Python deps
7. Starts all services with PM2

---

### Step 5 — Setup Nginx + Domain (Optional)

```bash
bash vps/nginx-setup.sh yourdomain.com
```

This:
- Configures Nginx as reverse proxy
- Serves the frontend as static files
- Proxies `/api/` to Node.js (port 3001)
- Proxies `/manage` to Flow2API (port 8000)
- Optionally sets up free SSL via Let's Encrypt

---

### Step 6 — Access Your App

| URL | Description |
|---|---|
| `http://yourdomain.com/` | Main app (image/video generator) |
| `http://yourdomain.com/admin` | Admin panel |
| `http://yourdomain.com/manage` | Flow2API dashboard |
| `http://yourdomain.com/pricing` | Pricing plans |

---

## Updating the App

Every time you push new code to GitHub, run on your VPS:

```bash
cd /var/www/flowrsa && bash vps/deploy.sh
```

That's it — pulls, builds, and restarts automatically.

---

## Flow2API Configuration

Edit `flow2api/config/config.toml` to change:

```toml
[global]
api_key = "your-api-key"      # API key for accessing Flow2API
admin_username = "admin"       # Flow2API admin username
admin_password = "admin"       # Flow2API admin password

[server]
host = "0.0.0.0"
port = 8000
```

> **Security tip:** Change the default `api_key`, `admin_username`, and `admin_password` before going live.

---

## Admin Panel

Access at `/admin` after logging in with the first registered account (auto-assigned admin).

Admin can:
- View all users
- Change user plans (Free → Starter → Lite → Elite → Infinity → Infinity Pro)
- Approve / reject users
- Monitor usage

---

## Pricing Plans

| Plan | Price | Generations | Threads |
|---|---|---|---|
| Promotion | Free | Limited | 1 |
| Starter | Rs 1,500/mo | 800 | 4 |
| Lite | Rs 2,500/mo | 1,500 | 4 |
| Elite | Rs 3,000/mo | 2,000 | 4 |
| Infinity | Rs 7,000/mo | Unlimited | 4 |
| Infinity Pro | Rs 15,000/mo | Unlimited | 8 |
| Super VEO | Rs 5,000/mo | Unlimited | 4 |

---

## PM2 Commands

```bash
pm2 list                      # See all running services
pm2 logs flowrsa-api          # API server logs
pm2 logs flowrsa-flow2api     # Flow2API logs
pm2 restart all               # Restart everything
pm2 stop all                  # Stop everything
pm2 monit                     # Live monitoring dashboard
```

---

## Nginx Commands

```bash
nginx -t                      # Test config for errors
systemctl reload nginx        # Apply config changes
systemctl status nginx        # Check nginx status
```

---

## Database Commands

```bash
# Connect to database
sudo -u postgres psql flowrsa

# View all users
SELECT id, name, email, role, plan, status FROM users;

# Change a user's plan
UPDATE users SET plan = 'starter' WHERE email = 'user@example.com';
```

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Node.js Express API (TypeScript)
│   └── image-tester/        # React frontend (Vite)
├── flow2api/                # Python FastAPI backend (Google Flow)
├── lib/
│   ├── db/                  # PostgreSQL + Drizzle ORM schema
│   └── api-zod/             # Shared API types
├── vps/                     # VPS deployment scripts
│   ├── setup.sh             # One-time server setup
│   ├── deploy.sh            # Git pull + build + restart
│   ├── pm2.config.js        # PM2 process config
│   ├── nginx.conf           # Nginx reverse proxy config
│   ├── nginx-setup.sh       # Nginx + SSL setup script
│   └── .env.example         # Environment variables template
└── README.md                # This file
```

---

## Troubleshooting

**App not loading?**
```bash
pm2 list          # Check if services are running
pm2 logs          # Check for errors
nginx -t          # Check nginx config
```

**Database connection error?**
```bash
# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection
sudo -u postgres psql flowrsa -c "SELECT 1;"
```

**Port already in use?**
```bash
lsof -i :3001     # Check who's using port 3001
lsof -i :8000     # Check who's using port 8000
pm2 restart all   # Restart PM2 processes
```

**Flow2API not working?**
- Check `flow2api/config/config.toml` settings
- Ensure Google account is logged in via Flow2API dashboard at `/manage`

---

## License

MIT License — Free to use and modify.
