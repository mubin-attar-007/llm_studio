"""Extract plain text from uploaded documents."""
import os


def read_document(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".txt", ".md", ".text", ""):
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    if ext == ".pdf":
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(path).pages)
    if ext == ".docx":
        import docx
        return "\n".join(p.text for p in docx.Document(path).paragraphs)
    raise ValueError(f"Unsupported file type '{ext}'. Use .txt, .md, .pdf, or .docx.")
