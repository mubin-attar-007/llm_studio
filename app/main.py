"""GLM Studio — FastAPI entry point.

Run:   .venv\\Scripts\\python.exe -m app.main     (or: uvicorn app.main:app)
Docs:  http://127.0.0.1:5000/docs
"""
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings
from app.core.logging import log, setup_logging
from app.database.sqlite import init_db
from app.llm import client as llm

setup_logging()
init_db()

_HERE = os.path.dirname(os.path.abspath(__file__))   # .../app

app = FastAPI(title="GLM Studio", version="1.0.0",
              description="Local AI chat — cloud + local models, one unified app")
app.mount("/static", StaticFiles(directory=os.path.join(_HERE, "static")), name="static")
app.include_router(router)


@app.get("/")
def index():
    return FileResponse(os.path.join(_HERE, "templates", "index.html"))


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


@app.get("/healthz")
def healthz():
    return {"ok": True, "default_model": llm.DEFAULT_MODEL}


def main():
    import threading
    import webbrowser

    import uvicorn

    url = f"http://{settings.HOST}:{settings.PORT}"
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    log.info("GLM Studio running at %s — API docs at %s/docs", url, url)
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, log_level=settings.LOG_LEVEL.lower())


if __name__ == "__main__":
    main()
