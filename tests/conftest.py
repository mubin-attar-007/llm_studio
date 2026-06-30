import os
import tempfile

# Use a throwaway DB for tests (must be set before app.* is imported).
os.environ.setdefault("GLM_DB_PATH", os.path.join(tempfile.gettempdir(), "glm_studio_test.db"))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    return TestClient(app)
