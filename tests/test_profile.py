def test_get_default_profile(client):
    r = client.get("/api/profile")
    assert r.status_code == 200
    data = r.json()
    assert "api_key" not in data
    assert "api_key_set" in data
    assert data["diet_type"] == "keto_omad"


def test_save_and_get_profile(client, sample_profile):
    r = client.post("/api/profile", json=sample_profile)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r = client.get("/api/profile")
    data = r.json()
    assert data["name"] == "Test User"
    assert data["diet_type"] == "carnivore"
    assert data["calorie_target"] == 1800


def test_api_key_preserved_when_empty(client, sample_profile):
    """Saving profile with api_key, then saving with empty key should preserve the original."""
    sample_profile["api_key"] = "sk-test-12345"
    client.post("/api/profile", json=sample_profile)

    sample_profile["api_key"] = ""
    client.post("/api/profile", json=sample_profile)

    r = client.get("/api/profile")
    assert r.json()["api_key_set"] is True
    assert r.json()["api_key_hint"] == "...2345"


def test_stats_empty(client):
    r = client.get("/api/stats")
    assert r.status_code == 200
    assert r.json()["meal_count"] == 0
    assert r.json()["calories"] == 0
