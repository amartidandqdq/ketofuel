"""Water tracker — increment and decrement."""
import httpx
from playwright.sync_api import expect


def _reset_water(base_url):
    """Reset water to 0 via API."""
    log = httpx.get(f"{base_url}/api/daily-log").json()
    for _ in range(log.get("water_glasses", 0)):
        httpx.delete(f"{base_url}/api/daily-log/water")


def test_water_starts_at_zero(app_page):
    count = app_page.locator("#water-count")
    assert count.inner_text().strip() == "0"


def test_add_water_increments(app_page, live_server):
    _reset_water(live_server)
    app_page.reload()
    app_page.wait_for_selector("[data-tab='today']", state="visible", timeout=5000)
    app_page.click("button.tracker-btn.add")
    expect(app_page.locator("#water-count")).to_have_text("1", timeout=3000)


def test_add_then_remove_water(app_page, live_server):
    _reset_water(live_server)
    app_page.reload()
    app_page.wait_for_selector("[data-tab='today']", state="visible", timeout=5000)
    app_page.click("button.tracker-btn.add")
    expect(app_page.locator("#water-count")).to_have_text("1", timeout=3000)
    app_page.click("button.tracker-btn:not(.add)")
    expect(app_page.locator("#water-count")).to_have_text("0", timeout=3000)


def test_water_no_negative(app_page, live_server):
    _reset_water(live_server)
    app_page.reload()
    app_page.wait_for_selector("[data-tab='today']", state="visible", timeout=5000)
    app_page.click("button.tracker-btn:not(.add)")
    expect(app_page.locator("#water-count")).to_have_text("0", timeout=3000)
