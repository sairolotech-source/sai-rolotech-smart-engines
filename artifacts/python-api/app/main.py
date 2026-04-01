"""
main.py — Sai Rolotech Smart Engines v2.2.0 — Python FastAPI Server
Runs on port 9000 alongside the TypeScript/Express API server (port 8080).
"""
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.routes import router
from app.engines.fea.fea_routes import fea_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")

app = FastAPI(
    title="Sai Rolotech Smart Engines — Python API",
    description=(
        "Roll Forming Auto Design API — Python/FastAPI backend. "
        "Modular engine architecture with Rule Book v2.2.0. "
        "Runs alongside TypeScript API on port 8080."
    ),
    version="2.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(fea_router)


@app.get("/certificate", include_in_schema=False)
def serve_certificate():
    cert_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "CERTIFICATE_OF_CAPABILITY.html")
    if os.path.exists(cert_path):
        return FileResponse(cert_path, media_type="text/html")
    return {"error": "Certificate file not found"}


@app.get("/")
def root():
    logger.info("Root health check")
    return {
        "status": "pass",
        "service": "Sai Rolotech Smart Engines — Python API",
        "version": "2.2.0",
        "port": 9000,
        "docs": "/docs",
        "endpoints": {
            "health": "GET /api/health",
            "auto_mode": "POST /api/auto-mode",
            "manual_mode": "POST /api/manual-mode",
            "dxf_upload": "POST /api/dxf-upload",
        },
    }
