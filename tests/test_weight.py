def test_log_weight_and_get_returns_entry(client):
    r = client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 90.5})
    assert r.status_code == 200

    r = client.get("/api/weight")
    weights = r.json()
    assert len(weights) == 1
    assert weights[0]["weight_kg"] == 90.5


def test_logging_weight_on_same_date_replaces_previous(client):
    client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 90.0})
    client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 89.5})

    weights = client.get("/api/weight").json()
    assert len(weights) == 1
    assert weights[0]["weight_kg"] == 89.5


def test_delete_weight_removes_entry(client):
    client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 90.0})
    r = client.delete("/api/weight/2026-04-10")
    assert r.status_code == 200

    assert len(client.get("/api/weight").json()) == 0


def test_delete_weight_returns_404_when_date_not_found(client):
    r = client.delete("/api/weight/2026-01-01")
    assert r.status_code == 404


def test_deficit_returns_400_without_profile(client):
    r = client.get("/api/deficit")
    assert r.status_code == 400


def test_deficit_returns_tdee_and_recommendations_with_profile(client, sample_profile):
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/deficit")
    assert r.status_code == 200
    data = r.json()
    assert "tdee_estimate" in data
    assert data["tdee_estimate"] > 0
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0
