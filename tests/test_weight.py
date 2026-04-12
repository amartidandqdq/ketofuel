def test_log_and_get_weight(client):
    r = client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 90.5})
    assert r.status_code == 200

    r = client.get("/api/weight")
    weights = r.json()
    assert len(weights) == 1
    assert weights[0]["weight_kg"] == 90.5


def test_weight_replaces_same_date(client):
    client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 90.0})
    client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 89.5})

    weights = client.get("/api/weight").json()
    assert len(weights) == 1
    assert weights[0]["weight_kg"] == 89.5


def test_delete_weight(client):
    client.post("/api/weight", json={"date": "2026-04-10", "weight_kg": 90.0})
    r = client.delete("/api/weight/2026-04-10")
    assert r.status_code == 200

    assert len(client.get("/api/weight").json()) == 0


def test_delete_weight_not_found(client):
    r = client.delete("/api/weight/2026-01-01")
    assert r.status_code == 404


def test_deficit_requires_profile(client):
    r = client.get("/api/deficit")
    assert r.status_code == 400


def test_deficit_calculation(client, sample_profile):
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/deficit")
    assert r.status_code == 200
    data = r.json()
    assert "tdee_estimate" in data
    assert data["tdee_estimate"] > 0
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0
