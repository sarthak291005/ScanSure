from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from .ocr_engine import OCREngine

app = FastAPI(title="ScanSure OCR API")

ocr_engine = OCREngine()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
SUFFIXES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ScanSure OCR"
    }


@app.post("/ocr")
async def run_ocr(request: Request):
    """Run the existing OCR engine against a single uploaded image.

    The image is sent as the raw request body so this small service does not
    need a multipart dependency. The Next.js backend is the intended caller.
    Files are validated and kept only in a temporary file while PaddleOCR runs.
    """
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Use JPEG, PNG, or WEBP.",
        )

    payload = await request.body()
    if not payload:
        raise HTTPException(status_code=400, detail="An image is required.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller.")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=SUFFIXES[content_type], delete=False) as temp_file:
            temp_file.write(payload)
            temp_path = Path(temp_file.name)

        # Verify the bytes are a readable image before sending them to PaddleOCR.
        with Image.open(temp_path) as image:
            image.verify()

        result = ocr_engine.extract_text(temp_path)
        # The engine normally derives this from the filename. HTTP uploads do
        # not retain a filesystem filename, so callers may provide a safe
        # logical identifier without changing the response contract.
        requested_id = request.headers.get("x-image-id")
        if requested_id and requested_id.replace("-", "").replace("_", "").isalnum():
            result["image_id"] = requested_id
        return result
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from error
    except HTTPException:
        raise
    except Exception as error:
        # Do not expose implementation details or let one failed OCR request
        # terminate the API process.
        raise HTTPException(status_code=500, detail="OCR processing failed. Please try another image.") from error
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
