"""
ANPR HTTP server — exposes camera MJPEG stream and single-frame plate capture.

Endpoints:
    GET  /health      — readiness probe
    GET  /video_feed  — MJPEG stream for Dashboard CameraFeed component
    POST /capture     — capture one frame, detect plate, return result JSON
"""

import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from anpr_service.anpr_service import ANPRConfig, ANPRService

logger = logging.getLogger(__name__)

_anpr: ANPRService | None = None
_camera: cv2.VideoCapture | None = None
_camera_lock = threading.Lock()

CAMERA_INDEX = int(os.getenv("ANPR_CAMERA_INDEX", "0"))
ANPR_BASE_PATH = Path(__file__).parent


def _get_anpr() -> ANPRService:
    global _anpr
    if _anpr is None:
        config = ANPRConfig(display_output=False, save_output=False)
        _anpr = ANPRService(config=config, base_path=ANPR_BASE_PATH)
    return _anpr


def _get_camera() -> cv2.VideoCapture:
    global _camera
    with _camera_lock:
        if _camera is None or not _camera.isOpened():
            _camera = cv2.VideoCapture(CAMERA_INDEX)
        return _camera


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("ANPR server starting — loading models …")
    try:
        _get_anpr()
        logger.info("Models loaded")
    except Exception as exc:
        logger.warning("Model load failed (camera-only mode): %s", exc)
    yield
    global _camera
    with _camera_lock:
        if _camera is not None:
            _camera.release()
            _camera = None
    logger.info("ANPR server shut down, camera released")


app = FastAPI(
    title="ANPR Service",
    description="Camera MJPEG stream + license plate detection for barricade verification",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    logger.debug("GET /health")
    cam = _get_camera()
    cam_ok = cam.isOpened() if cam else False
    return {
        "status": "ok",
        "service": "anpr-service",
        "camera": "connected" if cam_ok else "unavailable",
        "models": "loaded" if _anpr is not None else "not_loaded",
    }


def _generate_mjpeg():
    """Yield JPEG frames as a multipart MJPEG stream."""
    cap = _get_camera()
    while True:
        with _camera_lock:
            if not cap.isOpened():
                break
            ok, frame = cap.read()
        if not ok:
            time.sleep(0.1)
            continue
        _, jpeg = cv2.imencode(".jpg", frame)
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + jpeg.tobytes()
            + b"\r\n"
        )


@app.get("/video_feed")
def video_feed():
    """MJPEG stream consumed by Dashboard's CameraFeed component."""
    logger.debug("GET /video_feed — MJPEG stream client connected")
    return StreamingResponse(
        _generate_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.post("/capture")
async def capture():
    """Capture a single frame from the camera, run ANPR, return the best plate."""
    logger.info("POST /capture — processing frame")
    cap = _get_camera()
    with _camera_lock:
        if not cap.isOpened():
            return JSONResponse(status_code=503, content={"error": "Camera not available"})
        ok, frame = cap.read()

    if not ok or frame is None:
        logger.warning("POST /capture — frame read failed")
        return JSONResponse(status_code=503, content={"error": "Frame capture failed"})

    try:
        anpr = _get_anpr()
    except Exception as exc:
        logger.error("POST /capture — models unavailable: %s", exc)
        return JSONResponse(status_code=503, content={"error": f"ANPR models not loaded: {exc}"})

    _, results = anpr.process_frame(frame, draw_detections=False)

    best = None
    for r in results:
        text = r.license_plate_text
        if text and text != "Couldn't Decode":
            if best is None or r.confidence > best.confidence:
                best = r

    if best is None:
        logger.info("POST /capture — no decodable plate in frame")
        return {"plate": None, "confidence": 0.0, "detail": "No plate detected in frame"}

    logger.info(
        "POST /capture — plate=%s confidence=%.4f vehicle_id=%s",
        best.license_plate_text,
        best.confidence,
        best.vehicle_id,
    )
    return {
        "plate": best.license_plate_text,
        "confidence": round(best.confidence, 4),
        "vehicle_id": best.vehicle_id,
    }


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,
    )
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logger.info("Starting ANPR HTTP server on 0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")


if __name__ == "__main__":
    main()
