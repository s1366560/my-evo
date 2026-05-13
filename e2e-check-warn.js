const { chromium } = require('playwright');

const BASE = 'http://localhost:3002';
const pages = ['/browse', '/workspace'];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  for (const url of pages) {
    const page = await context.newPage();
    const messages = [];
    page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => messages.push(`[PAGE_ERROR] ${err.message}`));
    
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 15000 });
    
    console.log(`\n=== ${url} console messages ===`);
    messages.forEach(m => console.log(m));
    await page.close();
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
