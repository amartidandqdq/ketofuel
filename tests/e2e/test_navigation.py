"""Tab navigation — switching between sections."""


def test_switch_to_meals(app_page):
    app_page.click("[data-tab='meals']")
    assert app_page.locator("section#meals").is_visible()
    assert not app_page.locator("section#today").is_visible()


def test_switch_to_progress(app_page):
    app_page.click("[data-tab='progress']")
    assert app_page.locator("section#progress").is_visible()


def test_switch_to_settings(app_page):
    app_page.click("[data-tab='settings']")
    assert app_page.locator("section#settings").is_visible()


def test_switch_back_to_today(app_page):
    app_page.click("[data-tab='settings']")
    app_page.click("[data-tab='today']")
    assert app_page.locator("section#today").is_visible()
    assert not app_page.locator("section#settings").is_visible()
