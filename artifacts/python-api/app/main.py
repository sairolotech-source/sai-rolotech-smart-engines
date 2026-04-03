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


_DEMO_ROOT = os.path.dirname(os.path.dirname(__file__))
_SANDBOX_ASSETS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "mockup-sandbox", "public", "assets"
)

_DEMO_FILES = {
    "subtitles.srt":        (os.path.join(_DEMO_ROOT, "client_demo_subtitles.srt"),   "text/plain"),
    "storyboard.md":        (os.path.join(_DEMO_ROOT, "client_demo_storyboard.md"),   "text/markdown"),
    "proof.md":             (os.path.join(_DEMO_ROOT, "CLIENT_DEMO_PROOF.md"),         "text/markdown"),
    "roll-forming.mp4":     (os.path.join(_SANDBOX_ASSETS, "roll-forming-video.mp4"), "video/mp4"),
    "bg.png":               (os.path.join(_SANDBOX_ASSETS, "roll-forming-bg.png"),    "image/png"),
    "blueprint.png":        (os.path.join(_SANDBOX_ASSETS, "blueprint-texture.png"),  "image/png"),
    "tooling.png":          (os.path.join(_SANDBOX_ASSETS, "tooling-closeup.png"),    "image/png"),
}


@app.get("/demo/{filename}", include_in_schema=False)
def serve_demo_asset(filename: str):
    if filename not in _DEMO_FILES:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown demo asset: {filename}. Available: {list(_DEMO_FILES.keys())}")
    file_path, media_type = _DEMO_FILES[filename]
    if not os.path.exists(file_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"File not found on disk: {file_path}")
    return FileResponse(file_path, media_type=media_type, filename=filename)


@app.get("/demo", include_in_schema=False)
def demo_index():
    base = "http://localhost:9000"
    return {
        "demo_preview": "https://a5b55ff8-7921-4a2e-97b9-b44644dc6e89-00-1xkhi20ngsrml.worf.replit.dev:8081/__mockup/preview/ClientDemoVideo",
        "downloads": {k: f"{base}/demo/{k}" for k in _DEMO_FILES},
    }


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
