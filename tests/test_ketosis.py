def test_ketosis_no_start_date(client):
    """Without keto_start_date, should return not_started."""
    r = client.get("/api/ketosis")
    assert r.status_code == 200
    assert r.json()["phase"] == "not_started"


def test_ketosis_non_keto_diet(client, sample_profile):
    sample_profile["diet_type"] = "paleo"
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/ketosis")
    assert r.json()["phase"] == "not_applicable"


def test_ketosis_carnivore(client, sample_profile):
    """Carnivore with start date should return a valid phase."""
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/ketosis")
    data = r.json()
    assert data["phase"] in ["glucose", "depletion", "entering", "ketosis", "adapted"]
    assert "phases" in data
    assert len(data["phases"]) == 5
    assert data["fasting_bonus"] != ""  # 23h fasting should give bonus


def test_ketosis_exercise_bonus_capped(client, sample_profile):
    """Exercise bonus per day should be capped at DAILY_EXERCISE_BONUS_CAP."""
    client.post("/api/profile", json=sample_profile)

    # Log a fat fast (2.0 bonus) — that's already at the cap
    client.post("/api/log-exercise", json={"type": "fat_fast"})

    r = client.get("/api/ketosis")
    data = r.json()
    # exercise_bonus_days should be capped at 2.0 for today
    assert data["exercise_bonus_days"] <= 2.0


def test_ketosis_speed_tips(client, sample_profile):
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/ketosis")
    data = r.json()
    assert len(data["speed_tips"]) > 0
    assert len(data["accelerators"]) > 0
