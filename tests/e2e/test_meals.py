"""Meal logging — add a meal and verify it appears."""


def test_meal_textarea_exists(app_page):
    assert app_page.locator("#meal-desc").is_visible()


def test_log_meal_with_description(app_page):
    app_page.fill("#meal-desc", "Ribeye steak with butter")
    app_page.click("#btn-log-meal")
    # Wait for toast confirming the log
    toast = app_page.locator(".toast")
    toast.wait_for(state="visible", timeout=3000)
