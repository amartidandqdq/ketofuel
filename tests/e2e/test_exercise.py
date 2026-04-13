"""Exercise grid — log exercises and verify UI updates."""
import httpx


def _clear_exercises(base_url):
    """Reset exercise state between tests."""
    httpx.delete(f"{base_url}/api/log-exercise")


def test_exercise_grid_has_buttons(app_page):
    grid = app_page.locator("#exercise-grid")
    grid.wait_for(state="visible", timeout=5000)
    buttons = grid.locator(".exercise-btn")
    # POURQUOI: 6 types — walk, hiit, weight_train, swim, fat_fast, espresso
    assert buttons.count() == 6


def test_log_exercise_updates_badge(app_page, live_server):
    _clear_exercises(live_server)
    app_page.reload()
    app_page.wait_for_selector("#exercise-grid", state="visible", timeout=5000)
    grid = app_page.locator("#exercise-grid")
    grid.locator(".exercise-btn").first.click()
    app_page.locator(".toast").wait_for(state="visible", timeout=3000)
    log = app_page.locator("#exercise-today-log")
    assert log.inner_text() != ""


def test_exercise_count_increments(app_page, live_server):
    _clear_exercises(live_server)
    app_page.reload()
    app_page.wait_for_selector("#exercise-grid", state="visible", timeout=5000)
    grid = app_page.locator("#exercise-grid")
    walk_btn = grid.locator(".exercise-btn").first
    walk_btn.click()
    app_page.locator(".toast").wait_for(state="visible", timeout=3000)
    walk_btn.click()
    app_page.locator(".toast").nth(1).wait_for(state="visible", timeout=3000)
    assert "(2/" in walk_btn.inner_text()
