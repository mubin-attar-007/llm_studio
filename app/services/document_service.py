"""Document upload + text extraction service."""
import os

from app.core.config import settings
from app.llm.document_loader import read_document
from app.utils.file_utils import safe_filename


async def extract_upload(upload):
    """Save an UploadFile to the uploads dir, extract its text, then clean up."""
    name = upload.filename or "upload"
    path = os.path.join(settings.uploads_dir, "glm_" + safe_filename(name))
    with open(path, "wb") as f:
        f.write(await upload.read())
    try:
        return name, read_document(path)
    finally:
        try:
            os.remove(path)
        except Exception:
            pass
