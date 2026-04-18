def test_log_meal_returns_id_and_get_finds_it(client, sample_meal):
    r = client.post("/api/meals", json=sample_meal)
    assert r.status_code == 200
    meal = r.json()
    assert meal["meal_name"] == "Ribeye Steak"
    assert "id" in meal
    meal_id = meal["id"]

    r = client.get("/api/meals?target_date=2026-04-12")
    data = r.json()
    assert data["total"] == 1
    assert data["meals"][0]["id"] == meal_id


def test_delete_meal_removes_it_from_list(client, sample_meal):
    meal = client.post("/api/meals", json=sample_meal).json()
    r = client.delete(f"/api/meals/{meal['id']}")
    assert r.status_code == 200

    r = client.get("/api/meals?target_date=2026-04-12")
    assert r.json()["total"] == 0


def test_delete_nonexistent_meal_returns_404(client):
    r = client.delete("/api/meals/nonexistent")
    assert r.status_code == 404


def test_meals_pagination_returns_correct_total_and_slice(client, sample_meal):
    for i in range(5):
        m = {**sample_meal, "meal_name": f"Meal {i}"}
        client.post("/api/meals", json=m)

    r = client.get("/api/meals?target_date=2026-04-12&limit=2&offset=0")
    data = r.json()
    assert data["total"] == 5
    assert len(data["meals"]) == 2


def test_stats_after_meal_shows_correct_macros(client, sample_profile, sample_meal):
    client.post("/api/profile", json=sample_profile)
    client.post("/api/meals", json=sample_meal)
    r = client.get("/api/stats?target_date=2026-04-12")
    data = r.json()
    assert data["meal_count"] == 1
    assert data["calories"] == 900
    assert data["protein_g"] == 80


def test_favorites_empty_when_no_meals(client):
    r = client.get("/api/favorites")
    assert r.status_code == 200
    assert r.json() == []


def test_favorites_counts_repeated_meals(client, sample_meal):
    client.post("/api/meals", json=sample_meal)
    client.post("/api/meals", json=sample_meal)
    r = client.get("/api/favorites")
    favs = r.json()
    assert len(favs) == 1
    assert favs[0]["count"] == 2


def test_food_search_returns_results(client):
    r = client.get("/api/foods?q=butter")
    assert r.status_code == 200
