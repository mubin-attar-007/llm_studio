"""GLM Studio — FastAPI entry point.

Run:   .venv\\Scripts\\python.exe -m app.main     (or: uvicorn app.main:app)
Docs:  http://127.0.0.1:5000/docs
"""
import os

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api.auth_routes import auth_router
from app.api.routes import router
from app.core.config import settings
from app.core.logging import log, setup_logging
from app.database.engine import init_db
from app.llm import client as llm

setup_logging()
init_db()

_HERE = os.path.dirname(os.path.abspath(__file__))   # .../app

app = FastAPI(title=settings.APP_NAME, version="1.0.0",
              description="Multi-user AI chat — cloud + local models, one unified app")
app.mount("/static", StaticFiles(directory=os.path.join(_HERE, "static")), name="static")
app.include_router(auth_router)
app.include_router(router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-XSS-Protection", "0")
    return resp


@app.get("/")
def index():
    return FileResponse(os.path.join(_HERE, "templates", "index.html"))


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


@app.get("/healthz")
def healthz():
    db_ok = True
    try:
        from sqlalchemy import text

        from app.database.engine import engine
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"ok": db_ok, "db": db_ok, "env": settings.APP_ENV, "default_model": llm.DEFAULT_MODEL}


def main():
    import threading
    import webbrowser

    import uvicorn

    url = f"http://{settings.HOST}:{settings.PORT}"
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    log.info("%s running at %s — API docs at %s/docs", settings.APP_NAME, url, url)
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, log_level=settings.LOG_LEVEL.lower())


if __name__ == "__main__":
    main()
