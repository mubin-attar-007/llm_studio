import os
import tempfile

# Tests ALWAYS use a throwaway SQLite DB — never a real Postgres. Force
# DATABASE_URL empty so a developer's .env/environment can't point the suite at
# production. (Must be set before app.* is imported.)
os.environ["DATABASE_URL"] = ""
os.environ.setdefault("LLM_DB_PATH", os.path.join(tempfile.gettempdir(), "llm_studio_test.db"))
# The suite makes many register/login calls — don't let the IP rate limiter trip.
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
# Start each test session from a clean database so registration/quota are deterministic.
try:
    os.remove(os.environ["LLM_DB_PATH"])
except OSError:
    pass

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "password123"


@pytest.fixture
def anon_client():
    """An unauthenticated client."""
    return TestClient(app)


@pytest.fixture
def client():
    """An authenticated client (first user → admin, so quota never blocks tests)."""
    c = TestClient(app)
    r = c.post("/api/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code == 409:
        c.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    return c
