def test_daily_log_default(client):
    r = client.get("/api/daily-log")
    assert r.status_code == 200
    data = r.json()
    assert data["water_glasses"] == 0


def test_add_remove_water(client):
    client.post("/api/daily-log/water")
    client.post("/api/daily-log/water")
    r = client.get("/api/daily-log")
    assert r.json()["water_glasses"] == 2

    client.delete("/api/daily-log/water")
    r = client.get("/api/daily-log")
    assert r.json()["water_glasses"] == 1


def test_water_no_negative(client):
    client.delete("/api/daily-log/water")
    r = client.get("/api/daily-log")
    assert r.json()["water_glasses"] == 0


def test_invalid_date(client):
    r = client.get("/api/daily-log?target_date=not-a-date")
    assert r.status_code == 400


def test_exercise_types(client):
    r = client.get("/api/exercise-types")
    assert r.status_code == 200
    types = r.json()["types"]
    assert "walk_30" in types
    assert "fat_fast" in types
    assert "espresso" in types


def test_log_exercise(client):
    r = client.post("/api/log-exercise", json={"type": "walk_30"})
    assert r.status_code == 200
    data = r.json()
    assert data["today_total_bonus"] == 0.5
    assert len(data["exercises"]) == 1


def test_exercise_unknown_type(client):
    r = client.post("/api/log-exercise", json={"type": "swimming"})
    assert r.status_code == 400


def test_exercise_per_type_cap(client):
    """Espresso has max_daily=4, 5th should fail."""
    for _ in range(4):
        r = client.post("/api/log-exercise", json={"type": "espresso"})
        assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "espresso"})
    assert r.status_code == 400
    assert "Max 4" in r.json()["error"]


def test_exercise_daily_bonus_cap(client):
    """Daily bonus cap is 2.0. fat_fast=2.0, walk should be rejected."""
    r = client.post("/api/log-exercise", json={"type": "fat_fast"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 2.0

    r = client.post("/api/log-exercise", json={"type": "walk_30"})
    assert r.status_code == 400
    assert "cap reached" in r.json()["error"]


def test_clear_exercises(client):
    client.post("/api/log-exercise", json={"type": "walk_30"})
    client.post("/api/log-exercise", json={"type": "walk_30"})

    r = client.delete("/api/log-exercise?index=0")
    assert r.status_code == 200
    assert len(r.json()["exercises"]) == 1

    r = client.delete("/api/log-exercise")
    assert r.status_code == 200
    assert len(r.json()["exercises"]) == 0


def test_streak_empty(client):
    r = client.get("/api/streak")
    assert r.status_code == 200
    assert r.json()["current_streak"] == 0
