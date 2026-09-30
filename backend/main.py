import sys
import os

# Set selector event loop policy on Windows to prevent WinError 10054 ConnectionResetError
if sys.platform == "win32":
    import asyncio
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

# Bootstrap: Add parent directory to path to support absolute imports if run directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from backend.config import settings
from backend.models.history import init_history_db
from backend.models.models import init_app_db
from backend.api.routes import router
from backend.api.routes_v2 import router as router_v2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("backend.main")

app = FastAPI(
    title="PRAJNA — Predictive Research & Analytics for Judgement, Navigation & Action",
    description="Predictive Research & Analytics for Judgement, Navigation & Action. CSV Data Analysis, Visualization, ML Training, Testing, and Deployment Platform.",
    version="2.0.0"
)

# Set CORS middleware with allowed_origins and regex matching any localhost/127.0.0.1 port
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register routers
app.include_router(router_v2, prefix="/api")
app.include_router(router, prefix="/api")

@app.on_event("startup")
def on_startup():
    logger.info("Initializing application...")
    try:
        init_history_db()
        init_app_db()
        logger.info("Application and query history databases initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize databases: {e}")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "AntiBI - AI Data Analysis & ML Platform API",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)

