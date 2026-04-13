"""Smoke tests — app loads and basic structure is present."""
import httpx


def test_page_title(app_page):
    assert "KetoFuel" in app_page.title()


def test_four_tab_buttons(app_page):
    tabs = app_page.query_selector_all("[data-tab]")
    assert len(tabs) == 4


def test_today_active_by_default(app_page):
    today_link = app_page.query_selector("[data-tab='today']")
    assert "active" in today_link.get_attribute("class")
    assert app_page.locator("section#today").is_visible()


def test_health_endpoint(live_server):
    r = httpx.get(f"{live_server}/api/health")
    assert r.status_code == 200
