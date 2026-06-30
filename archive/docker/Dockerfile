# GLM Studio — reproducible container image (FastAPI + Uvicorn)
FROM python:3.12-slim

WORKDIR /app

# Install deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

EXPOSE 5000
ENV HOST=0.0.0.0 PORT=5000 LOG_LEVEL=info

# Healthcheck hits the FastAPI /healthz endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/healthz').status==200 else 1)"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
