"""E2E test fixtures — live server + Playwright page."""
import os
import shutil
import subprocess
import sys
import tempfile
import time

import httpx
import pytest

E2E_PORT = 18901
BASE_URL = f"http://localhost:{E2E_PORT}"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@pytest.fixture(scope="session")
def live_server():
    """Start the FastAPI app in a subprocess with isolated data dir."""
    tmpdir = tempfile.mkdtemp(prefix="ketofuel_e2e_")
    env = {**os.environ, "DATA_DIR": tmpdir, "APP_PORT": str(E2E_PORT), "APP_HOST": "127.0.0.1"}
    proc = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=PROJECT_ROOT, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    # POURQUOI: Poll health endpoint — uvicorn needs a moment to bind
    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            r = httpx.get(f"{BASE_URL}/api/health", timeout=1)
            if r.status_code == 200:
                break
        except httpx.ConnectError:
            time.sleep(0.3)
    else:
        proc.terminate()
        raise RuntimeError(f"Server did not start within 15s on port {E2E_PORT}")

    yield BASE_URL

    proc.terminate()
    proc.wait(timeout=5)
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def app_page(page, live_server):
    """Navigate to the app and wait for the Today tab to be ready."""
    page.goto(live_server)
    page.wait_for_selector("[data-tab='today']", state="visible", timeout=5000)
    return page
