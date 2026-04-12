# POURQUOI: Shared fixtures — isolated temp data dir per test, fresh TestClient.

import shutil
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def isolated_data_dir(monkeypatch):
    """Each test gets a fresh temporary data directory so tests don't interfere."""
    tmpdir = tempfile.mkdtemp(prefix="ketofuel_test_")
    monkeypatch.setenv("DATA_DIR", tmpdir)
    # Patch both config and storage modules — storage imports DATA_DIR at load time
    import config
    import storage
    monkeypatch.setattr(config, "DATA_DIR", tmpdir)
    monkeypatch.setattr(storage, "DATA_DIR", tmpdir)
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def client(isolated_data_dir):
    """Fresh TestClient with isolated storage."""
    from main import app
    return TestClient(app)


@pytest.fixture
def sample_profile():
    return {
        "name": "Test User", "diet_type": "carnivore", "calorie_target": 1800,
        "protein_ratio": 35.0, "fat_ratio": 60.0, "carb_ratio": 5.0,
        "sex": "male", "age": 35, "activity_level": 1.375,
        "height_cm": 180, "current_weight_kg": 90, "target_weight_kg": 80,
        "keto_start_date": "2026-04-01", "net_carb_limit": 0,
        "fasting_goal_hours": 23, "api_key": "",
    }


@pytest.fixture
def sample_meal():
    return {
        "date": "2026-04-12", "meal_name": "Ribeye Steak",
        "meal_description": "400g ribeye with butter and salt",
        "calories": 900, "protein_g": 80, "fat_g": 65, "carbs_g": 0, "fiber_g": 0,
    }
