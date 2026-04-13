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
    assert "hiit" in types
    assert "weight_train" in types
    assert "swim" in types


def test_log_exercise(client):
    r = client.post("/api/log-exercise", json={"type": "walk_30"})
    assert r.status_code == 200
    data = r.json()
    assert data["today_total_bonus"] == 0.5
    assert len(data["exercises"]) == 1


def test_exercise_unknown_type(client):
    r = client.post("/api/log-exercise", json={"type": "nonexistent_exercise"})
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
    """Daily bonus cap is 3.0. fat_fast(2.0)+hiit(1.2)=3.2 exceeds cap."""
    r = client.post("/api/log-exercise", json={"type": "fat_fast"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 2.0

    r = client.post("/api/log-exercise", json={"type": "hiit"})
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


# --- New exercise type tests ---

def test_log_hiit(client):
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 1.2


def test_log_weight_training(client):
    r = client.post("/api/log-exercise", json={"type": "weight_train"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 0.8


def test_log_swimming(client):
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 0.7


def test_hiit_max_daily_cap(client):
    """HIIT has max_daily=1, 2nd should fail."""
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 400
    assert "Max 1" in r.json()["error"]


def test_swim_allows_two_rejects_third(client):
    """Swimming has max_daily=2."""
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 1.4
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 400
    assert "Max 2" in r.json()["error"]


def test_combined_new_exercises_under_cap(client):
    """HIIT(1.2) + weight(0.8) + swim(0.7) = 2.7, all under 3.0 cap."""
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "weight_train"})
    assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 2.7


def test_cap_error_no_caffeine_for_hiit(client):
    """HIIT cap error should say 'recovery needed', not 'caffeine'."""
    client.post("/api/log-exercise", json={"type": "hiit"})
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 400
    assert "caffeine" not in r.json()["error"]
    assert "recovery" in r.json()["error"]
