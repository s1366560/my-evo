const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to http://127.0.0.1:3002/...');
  const response = await page.goto('http://127.0.0.1:3002/', { waitUntil: 'networkidle' });
  console.log('Status:', response.status());
  
  // Get page content
  const content = await page.content();
  console.log('Page has h1:', content.includes('<h1'));
  console.log('Page has "EvoMap":', content.includes('EvoMap'));
  
  // Check headings
  const h1Count = await page.locator('h1').count();
  console.log('h1 count:', h1Count);
  
  // Get all headings
  const headings = await page.locator('h1, h2, h3').all();
  for (const h of headings.slice(0, 5)) {
    const text = await h.textContent();
    console.log('Heading:', text?.substring(0, 80));
  }
  
  // Check if page loaded correctly
  const title = await page.title();
  console.log('Page title:', title);
  
  await browser.close();
})();
