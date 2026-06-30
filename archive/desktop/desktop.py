"""Run LLM Studio as a native desktop window (no browser chrome).

Starts the FastAPI server on a background thread, then opens a pywebview window.
Run from source:   .venv\\Scripts\\python.exe desktop.py
Build a single .exe:  .venv\\Scripts\\python.exe build_desktop.py  (or make_desktop.bat)
"""
import threading
import time
import urllib.request

import uvicorn
import webview

from app.core.config import settings
from app.main import app

HOST, PORT = "127.0.0.1", settings.PORT


def _serve():
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


def main():
    threading.Thread(target=_serve, daemon=True).start()
    # Wait for the server to come up before opening the window.
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://{HOST}:{PORT}/healthz", timeout=1)
            break
        except Exception:
            time.sleep(0.25)
    webview.create_window("LLM Studio", f"http://{HOST}:{PORT}", width=1200, height=820)
    webview.start()


if __name__ == "__main__":
    main()
