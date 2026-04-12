def test_weekly_summary_empty(client):
    r = client.get("/api/weekly-summary")
    assert r.status_code == 200
    data = r.json()
    assert data["days_with_meals"] == 0
    assert data["avg_calories"] == 0


def test_body_composition_requires_profile(client):
    r = client.get("/api/body-composition")
    assert r.status_code == 400


def test_body_composition(client, sample_profile):
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/body-composition")
    assert r.status_code == 200
    data = r.json()
    assert "bmi" in data
    assert "body_fat_pct" in data
    assert "lean_mass_kg" in data
    assert data["lean_mass_kg"] > 0
    assert data["lean_mass_kg"] < data["lean_mass_kg"] + data["fat_mass_kg"]


def test_protein_status_requires_profile(client):
    r = client.get("/api/protein-status")
    assert r.status_code == 400


def test_protein_status_no_meals(client, sample_profile):
    """No meals logged — no alert (alert only fires after eating)."""
    client.post("/api/profile", json=sample_profile)
    r = client.get("/api/protein-status")
    assert r.status_code == 200
    data = r.json()
    assert data["protein_consumed_g"] == 0
    assert data["alert"] is None  # No alert when no meals


def test_protein_status_low_protein(client, sample_profile):
    """Log a low-protein meal — should trigger alert."""
    client.post("/api/profile", json=sample_profile)
    # Log a meal with very little protein
    client.post("/api/meals", json={
        "date": "2026-04-12", "meal_name": "Butter",
        "meal_description": "Just butter", "calories": 700,
        "protein_g": 1, "fat_g": 80, "carbs_g": 0, "fiber_g": 0,
    })
    r = client.get("/api/protein-status")
    data = r.json()
    assert data["alert"] is not None
    assert "Low protein" in data["alert"]
    assert data["pct"] < 80


def test_protein_status_adequate(client, sample_profile):
    """Log a protein-rich meal — should be OK."""
    client.post("/api/profile", json=sample_profile)
    # High protein meal that exceeds target
    client.post("/api/meals", json={
        "date": "2026-04-12", "meal_name": "Ribeye Feast",
        "meal_description": "Large ribeye steak", "calories": 1500,
        "protein_g": 150, "fat_g": 100, "carbs_g": 0, "fiber_g": 0,
    })
    r = client.get("/api/protein-status")
    data = r.json()
    assert data["alert"] is None
    assert data["pct"] >= 80


def test_achievements_empty(client):
    r = client.get("/api/achievements")
    assert r.status_code == 200
    badges = r.json()["badges"]
    assert all(not b["earned"] for b in badges)


def test_achievements_after_meal(client, sample_meal):
    client.post("/api/meals", json=sample_meal)
    r = client.get("/api/achievements")
    badges = {b["id"]: b["earned"] for b in r.json()["badges"]}
    assert badges["first_meal"] is True


def test_meal_timing(client, sample_meal):
    client.post("/api/meals", json=sample_meal)
    r = client.get("/api/meal-timing?target_date=2026-04-12")
    assert r.status_code == 200
    assert len(r.json()["timings"]) == 1


def test_daily_snapshot(client, sample_meal):
    client.post("/api/meals", json=sample_meal)
    r = client.get("/api/daily-snapshot?target_date=2026-04-12")
    assert r.status_code == 200
    data = r.json()
    assert data["stats"]["meal_count"] == 1
    assert len(data["meals"]) == 1


def test_export_csv(client, sample_meal):
    client.post("/api/meals", json=sample_meal)
    r = client.get("/api/export")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "Ribeye Steak" in r.text


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
