from playwright.sync_api import Page, expect, sync_playwright
import time

def test_journal_performance(page: Page):
    print("Navigating to app...")
    page.goto("http://localhost:8081")

    print("Waiting for Navigate Journal button...")
    journal_btn = page.get_by_test_id("btn.navigateJournal")
    expect(journal_btn).to_be_visible(timeout=30000)

    print("Clicking Navigate Journal...")
    journal_btn.click()

    print("Waiting for Journal Screen...")
    journal_screen = page.get_by_test_id("screen.journal")
    expect(journal_screen).to_be_visible(timeout=10000)

    print("Waiting for Dreams List...")
    dream_list = page.get_by_test_id("list.dreams")
    expect(dream_list).to_be_visible(timeout=10000)

    print("Taking initial screenshot...")
    page.screenshot(path="verification/journal_initial.png")

    print("Scrolling...")
    # Target the list specifically if possible, or just page scroll
    dream_list.focus()
    page.mouse.wheel(0, 1000)
    time.sleep(2) # Wait for render

    print("Taking final screenshot...")
    page.screenshot(path="verification/verification.png")
    print("Done.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--lang=en-US"])
        context = browser.new_context(locale="en-US")
        page = context.new_page()
        try:
            test_journal_performance(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()
