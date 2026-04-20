"""Flow2API - Main Entry Point"""
from src.main import app
import uvicorn
import os

if __name__ == "__main__":
    from src.core.config import config

    port = int(os.environ.get("PORT", config.server_port))

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
