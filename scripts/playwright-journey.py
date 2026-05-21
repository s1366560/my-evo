#!/usr/bin/env python3
"""E2E Journey Tests - Python Playwright (uses system chromium-1208)"""
import json
import os, re
from pathlib import Path
from playwright.sync_api import sync_playwright

WORKTREE = Path("/workspace/.memstack/worktrees/921ced55-d188-4f33-88fc-2936c049cef1")
OUT_DIR = WORKTREE / "frontend" / "tests" / "screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BASE = "http://127.0.0.1:3002"
RESULTS_FILE = OUT_DIR / "journey-report.json"

STEPS = [
    ("01-homepage",    BASE),
    ("02-register",    f"{BASE}/register"),
    ("03-login",       f"{BASE}/login"),
    ("04-dashboard",   f"{BASE}/dashboard"),
    ("05-map",         f"{BASE}/map"),
    ("06-editor",      f"{BASE}/editor"),
    ("07-browse",      f"{BASE}/browse"),
    ("08-pricing",     f"{BASE}/pricing"),
    ("09-arena",       f"{BASE}/arena"),
    ("10-marketplace",  f"{BASE}/marketplace"),
    ("11-bounty-hall", f"{BASE}/bounty-hall"),
    ("12-onboarding",   f"{BASE}/onboarding"),
    ("13-profile",     f"{BASE}/profile"),
    ("14-swarm",       f"{BASE}/swarm"),
    ("15-workspace",   f"{BASE}/workspace"),
    ("16-publish",     f"{BASE}/publish"),
    ("17-credits",     f"{BASE}/credits"),
    ("18-council",     f"{BASE}/council"),
]

def main():
    results = []
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/root/.cache/ms-playwright/chromium-1208/chrome-linux/chrome"
        )
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.add_init_script("""
            window.localStorage.setItem('evomap-auth', JSON.stringify({
                state: { token: 'e2e-test-token', userId: 'e2e-user-001', isAuthenticated: true },
                version: 0,
            }));
        """)

        def on_console(msg):
            if msg.type == "error":
                t = msg.text
                if not any(x in t for x in ["fonts.googleapis", "fonts.gstatic", "MIME type", "400 (Bad Request)"]):
                    console_errors.append(t[:100])

        page.on("console", on_console)
        page.on("pageerror", lambda e: console_errors.append("PAGEERROR: " + e.message[:100]))

        page.route(re.compile(r"/api/v2/workspace/current"), lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"id": "ws1", "name": "EvoMap Workspace", "memberCount": 2, "reputation": 85, "credits": 100})
        ))
        page.route(re.compile(r"/api/v2/workspace/tasks"), lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps({"tasks": [], "total": 0})
        ))
        page.route(re.compile(r"/api/v2/workspace/goals"), lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps({"goals": [], "total": 0})
        ))

        for step_name, url in STEPS:
            filename = f"{step_name}.png"
            filepath = OUT_DIR / filename
            try:
                resp = page.goto(url, wait_until="load", timeout=20000)
                page.wait_for_timeout(2000)
                status = resp.status if resp else 0
                page.screenshot(path=str(filepath), full_page=False)
                body_len = len(page.content())
                results.append({"step": step_name, "url": url, "filename": filename, "status": status, "bodyChars": body_len})
                sym = "OK" if status == 200 else f"HTTP{status}"
                print(f"[{sym}] {step_name} -> {status} ({body_len} chars)")
            except Exception as e:
                results.append({"step": step_name, "url": url, "filename": filename, "error": str(e)[:120]})
                print(f"[ERR] {step_name} -> {e}")

        browser.close()

    http2xx = sum(1 for r in results if r.get("status") == 200)
    http404 = [r for r in results if r.get("status") == 404]
    report = {
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "base": BASE,
        "steps": results,
        "consoleErrors": console_errors,
        "summary": {
            "total": len(results),
            "http2xx": http2xx,
            "failed": sum(1 for r in results if "error" in r),
            "http404": [r["step"] for r in http404],
        }
    }
    RESULTS_FILE.write_text(json.dumps(report, indent=2))
    print(f"\n=== SUMMARY ===")
    print(f"Total: {len(results)} | 200: {http2xx} | 404: {len(http404)}")
    if http404:
        print(f"404 routes: {[r['step'] for r in http404]}")
    print(f"Console errors: {len(console_errors)}")
    print(f"Report: {RESULTS_FILE}")

if __name__ == "__main__":
    main()
