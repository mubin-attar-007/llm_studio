"""LLM Studio — FastAPI entry point.

Run:   .venv\\Scripts\\python.exe -m app.main     (or: uvicorn app.main:app)
Docs:  http://127.0.0.1:5000/docs
"""
import os
import time

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api.auth_routes import auth_router
from app.api.routes import router
from app.core.config import settings
from app.core.logging import log, setup_logging
from app.database.engine import init_db
from app.llm import client as llm

setup_logging()

# Optional error monitoring — only active when a DSN is configured.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.APP_ENV, traces_sample_rate=0.0)
        log.info("Sentry error monitoring enabled")
    except Exception as e:  # pragma: no cover - defensive
        log.warning("Sentry init failed: %s", e)

init_db()

_HERE = os.path.dirname(os.path.abspath(__file__))   # .../app

# Content-Security-Policy — allows the CDNs the frontend actually loads
# (marked / DOMPurify / highlight.js / KaTeX from jsDelivr, Google Fonts).
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'"
)

app = FastAPI(title=settings.APP_NAME, version="1.0.0",
              description="Multi-user AI chat — cloud + local models, one unified app")
app.mount("/static", StaticFiles(directory=os.path.join(_HERE, "static")), name="static")
app.include_router(auth_router)
app.include_router(router)


@app.middleware("http")
async def security_and_logging(request: Request, call_next):
    start = time.perf_counter()
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-XSS-Protection", "0")
    resp.headers.setdefault("Content-Security-Policy", _CSP)
    if settings.is_prod:
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    path = request.url.path
    if not path.startswith("/static") and path != "/healthz":
        dur = (time.perf_counter() - start) * 1000
        log.info("%s %s -> %s (%.0f ms)", request.method, path, resp.status_code, dur)
    return resp


@app.get("/")
def index():
    return FileResponse(os.path.join(_HERE, "templates", "index.html"))


@app.get("/favicon.ico")
def favicon():
    # Serve the real SVG favicon for /favicon.ico requests (browsers accept SVG here).
    return FileResponse(os.path.join(_HERE, "static", "favicon.svg"),
                        media_type="image/svg+xml")


@app.get("/robots.txt")
def robots():
    body = "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nSitemap: /sitemap.xml\n"
    return PlainTextResponse(body)


@app.get("/sitemap.xml")
def sitemap():
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "  <url><loc>/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n"
        "</urlset>\n"
    )
    return Response(content=body, media_type="application/xml")


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
