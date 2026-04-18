def test_daily_log_defaults_to_zero_water(client):
    r = client.get("/api/daily-log")
    assert r.status_code == 200
    data = r.json()
    assert data["water_glasses"] == 0


def test_add_two_waters_then_remove_one_leaves_one(client):
    client.post("/api/daily-log/water")
    client.post("/api/daily-log/water")
    r = client.get("/api/daily-log")
    assert r.json()["water_glasses"] == 2

    client.delete("/api/daily-log/water")
    r = client.get("/api/daily-log")
    assert r.json()["water_glasses"] == 1


def test_water_cannot_go_negative(client):
    client.delete("/api/daily-log/water")
    r = client.get("/api/daily-log")
    assert r.json()["water_glasses"] == 0


def test_invalid_date_returns_400(client):
    r = client.get("/api/daily-log?target_date=not-a-date")
    assert r.status_code == 400


def test_exercise_types_includes_all_six_types(client):
    r = client.get("/api/exercise-types")
    assert r.status_code == 200
    types = r.json()["types"]
    assert "walk_30" in types
    assert "fat_fast" in types
    assert "espresso" in types
    assert "hiit" in types
    assert "weight_train" in types
    assert "swim" in types


def test_log_walk_adds_0_5_bonus(client):
    r = client.post("/api/log-exercise", json={"type": "walk_30"})
    assert r.status_code == 200
    data = r.json()
    assert data["today_total_bonus"] == 0.5
    assert len(data["exercises"]) == 1


def test_unknown_exercise_type_returns_400(client):
    r = client.post("/api/log-exercise", json={"type": "nonexistent_exercise"})
    assert r.status_code == 400


def test_espresso_5th_rejected_after_max_daily_4(client):
    """Espresso has max_daily=4, 5th should fail."""
    for _ in range(4):
        r = client.post("/api/log-exercise", json={"type": "espresso"})
        assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "espresso"})
    assert r.status_code == 400
    assert "Max 4" in r.json()["error"]


def test_daily_bonus_cap_rejects_exercise_exceeding_3_0(client):
    """Daily bonus cap is 3.0. fat_fast(2.0)+hiit(1.2)=3.2 exceeds cap."""
    r = client.post("/api/log-exercise", json={"type": "fat_fast"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 2.0

    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 400
    assert "cap reached" in r.json()["error"]


def test_delete_exercise_by_index_and_clear_all(client):
    client.post("/api/log-exercise", json={"type": "walk_30"})
    client.post("/api/log-exercise", json={"type": "walk_30"})

    r = client.delete("/api/log-exercise?index=0")
    assert r.status_code == 200
    assert len(r.json()["exercises"]) == 1

    r = client.delete("/api/log-exercise?clear_all=true")
    assert r.status_code == 200
    assert len(r.json()["exercises"]) == 0


def test_streak_returns_zero_when_no_meals(client):
    r = client.get("/api/streak")
    assert r.status_code == 200
    assert r.json()["current_streak"] == 0


# --- Exercise type specific tests ---

def test_hiit_adds_1_2_bonus(client):
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 1.2


def test_weight_training_adds_0_8_bonus(client):
    r = client.post("/api/log-exercise", json={"type": "weight_train"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 0.8


def test_swimming_adds_0_7_bonus(client):
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 0.7


def test_hiit_max_daily_1_rejects_second(client):
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


def test_hiit_plus_weights_plus_swim_totals_2_7_under_cap(client):
    """HIIT(1.2) + weight(0.8) + swim(0.7) = 2.7, all under 3.0 cap."""
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "weight_train"})
    assert r.status_code == 200
    r = client.post("/api/log-exercise", json={"type": "swim"})
    assert r.status_code == 200
    assert r.json()["today_total_bonus"] == 2.7


def test_hiit_cap_error_says_recovery_not_caffeine(client):
    """HIIT cap error should say 'recovery needed', not 'caffeine'."""
    client.post("/api/log-exercise", json={"type": "hiit"})
    r = client.post("/api/log-exercise", json={"type": "hiit"})
    assert r.status_code == 400
    assert "caffeine" not in r.json()["error"]
    assert "recovery" in r.json()["error"]
