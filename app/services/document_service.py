"""Document upload + text extraction service (with size/type/length limits)."""
import os

from app.core.config import settings
from app.llm.document_loader import read_document
from app.utils.file_utils import safe_filename

ALLOWED_EXT = {".txt", ".md", ".text", ".pdf", ".docx", ""}


async def extract_upload(upload):
    """Validate, save, extract text from an UploadFile, then clean up.

    Enforces an allow-list of extensions, a max upload size, and caps the
    extracted text so a huge document can't blow up the model context.
    """
    name = upload.filename or "upload"
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXT:
        raise ValueError("Unsupported file type. Please upload a .txt, .md, .pdf, or .docx file.")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    declared = getattr(upload, "size", None)
    if declared is not None and declared > max_bytes:
        raise ValueError(f"File is too large (max {settings.MAX_UPLOAD_MB} MB).")

    data = await upload.read(max_bytes + 1)   # read at most one byte past the limit
    if len(data) > max_bytes:
        raise ValueError(f"File is too large (max {settings.MAX_UPLOAD_MB} MB).")
    if not data:
        raise ValueError("The file appears to be empty.")

    path = os.path.join(settings.uploads_dir, "llm_" + safe_filename(name))
    with open(path, "wb") as f:
        f.write(data)
    try:
        text = read_document(path)
    finally:
        try:
            os.remove(path)
        except Exception:
            pass

    if len(text) > settings.MAX_DOC_CHARS:
        text = text[:settings.MAX_DOC_CHARS] + "\n\n…[document truncated]"
    return name, text
