"""Settings tab — fill, save, and verify persistence."""


def test_settings_fields_exist(app_page):
    app_page.click("[data-tab='settings']")
    assert app_page.locator("#set-name").is_visible()
    assert app_page.locator("#set-age").is_visible()
    assert app_page.locator("#set-calories").is_visible()


def test_save_settings_shows_toast(app_page):
    app_page.click("[data-tab='settings']")
    app_page.fill("#set-name", "Test User")
    app_page.fill("#set-age", "30")
    app_page.fill("#set-calories", "1800")
    app_page.click("text=Save Settings")
    # Toast appears as a .toast element on body
    toast = app_page.locator(".toast")
    toast.wait_for(state="visible", timeout=3000)


def test_settings_persist_after_reload(app_page):
    app_page.click("[data-tab='settings']")
    app_page.fill("#set-name", "Persisted User")
    app_page.fill("#set-age", "35")
    app_page.click("text=Save Settings")
    app_page.locator(".toast").wait_for(state="visible", timeout=3000)

    app_page.reload()
    app_page.wait_for_selector("[data-tab='today']", state="visible", timeout=5000)
    app_page.click("[data-tab='settings']")
    # POURQUOI: loadSettings() is async — poll via locator instead of eval (CSP blocks eval)
    from playwright.sync_api import expect
    import time
    deadline = time.time() + 10
    while time.time() < deadline:
        val = app_page.input_value("#set-name")
        if val:
            break
        time.sleep(0.3)
    assert app_page.input_value("#set-name") == "Persisted User"
    assert app_page.input_value("#set-age") == "35"
