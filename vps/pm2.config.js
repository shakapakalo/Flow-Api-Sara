// ============================================================
// Flow by RSA - PM2 Process Manager Config
// Manages: API Server (Node.js) + Flow2API (Python)
// ============================================================

const path = require("path");
const APP_DIR = path.resolve(__dirname, "..");
const ENV_FILE = path.join(APP_DIR, ".env");

module.exports = {
  apps: [
    {
      name: "flowrsa-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: APP_DIR,
      env_file: ENV_FILE,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "./vps/logs/api-error.log",
      out_file: "./vps/logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "flowrsa-flow2api",
      script: "./flow2api/.venv/bin/python3",
      args: "main.py",
      cwd: path.join(APP_DIR, "flow2api"),
      env_file: ENV_FILE,
      env: {
        PORT: 8000,
      },
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "../vps/logs/flow2api-error.log",
      out_file: "../vps/logs/flow2api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
