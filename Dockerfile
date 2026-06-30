# LLM Studio — multi-user AI chat SaaS (FastAPI + vanilla JS)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY . .

# Runtime data dirs (uploads are transient; the database is Postgres in prod).
RUN mkdir -p data/runtime data/uploads && chmod -R 777 data

EXPOSE 7860

# --proxy-headers so secure cookies + the rate limiter see the real scheme/IP
# behind the platform's HTTPS proxy (HF Spaces / Render / Fly).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips=*"]
