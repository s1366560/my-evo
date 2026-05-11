from playwright.sync_api import sync_playwright
import os, json

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:3001")

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        passed = 0
        failed = 0
        errors = []
        try:
            print("Test 1: GET /skill.md")
            page = browser.new_page()
            r = page.goto(BACKEND_URL + "/skill.md", wait_until="domcontentloaded")
            if r.status != 200:
                raise Exception(f"Expected 200, got {r.status}")
            ct = r.headers.get("content-type", "")
            if "text/markdown" not in ct:
                raise Exception(f"Expected text/markdown, got {ct}")
            body_text = page.inner_text("body")
            if "EvoMap" not in body_text:
                raise Exception("Missing EvoMap")
            if "GEP-A2A" not in body_text:
                raise Exception("Missing GEP-A2A")
            print("  PASS")
            passed += 1
            page.close()

            print("Test 2: POST /a2a/hello")
            page = browser.new_page()
            resp = page.request.post(
                BACKEND_URL + "/a2a/hello",
                headers={"Content-Type": "application/json"},
                data=json.dumps({"name": "TestEvolverNode", "description": "E2E test", "capabilities": ["test"], "version": "1.0.0"})
            )
            data = resp.json()
            if resp.status not in (200, 201):
                raise Exception(f"Expected 200 or 201, got {resp.status}")
            if "claim_code" not in data:
                raise Exception("missing claim_code")
            if "claim_url" not in data:
                raise Exception("missing claim_url")
            if not isinstance(data["claim_url"], str) or len(data["claim_url"]) == 0:
                raise Exception(f"bad claim_url: {data.get('claim_url')}")
            if "starter_gene_pack" not in data:
                raise Exception("missing starter_gene_pack")
            if not isinstance(data["starter_gene_pack"], list):
                raise Exception("starter_gene_pack not list")
            if "credit_balance" not in data:
                raise Exception("missing credit_balance")
            if not isinstance(data["credit_balance"], (int, float)):
                raise Exception("credit_balance not number")
            print("  PASS")
            passed += 1
            page.close()

            print("Test 3: POST /a2a/fetch")
            page = browser.new_page()
            resp3 = page.request.post(
                BACKEND_URL + "/a2a/fetch",
                headers={"Content-Type": "application/json"},
                data=json.dumps({"query": "JWT", "type": "gene", "limit": 5})
            )
            if resp3.status != 200:
                raise Exception(f"Expected 200, got {resp3.status}")
            fetch_data = resp3.json()
            assets = fetch_data.get("assets", fetch_data)
            if not isinstance(assets, list):
                raise Exception(f"Response must have assets array, got {type(assets)}")
            print("  PASS")
            passed += 1
            page.close()

        except Exception as e:
            print(f"  FAIL: {e}")
            errors.append(str(e))
            failed += 1
        finally:
            browser.close()

        print(f"Passed: {passed}/3, Failed: {failed}/3")
        if errors:
            for e in errors:
                print(f"  - {e}")
            exit(1)
        else:
            print("All tests passed!")
            exit(0)

if __name__ == "__main__":
    run_tests()
