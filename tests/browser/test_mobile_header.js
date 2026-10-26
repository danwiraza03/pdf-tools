const fs = require('fs');
const path = require('path');
const { chromium, webkit, devices } = require('playwright');
const { startTestServer } = require('./helpers');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const TEST_WIDTHS = [360, 390, 440, 768, 810, 834];

// Minimum expected tools in drawer (21 tool pages + viewer)
const MIN_DRAWER_TOOLS = 20;

/**
 * Evaluates header geometry and visibility on the active page.
 */
async function evaluateHeaderState(page, screenWidth) {
  return await page.evaluate((width) => {
    const inner = document.querySelector('.header-inner');
    if (!inner) return { error: 'No .header-inner found' };

    const nav = document.querySelector('.header-nav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    const drawer = document.getElementById('mobileNavDrawer');

    // a. #mobileMenuBtn check
    let btnVisible = false;
    let btnInsideScreen = false;
    let btnBox = null;

    if (menuBtn) {
      const comp = window.getComputedStyle(menuBtn);
      btnVisible = comp.display !== 'none' && comp.visibility !== 'hidden';
      const r = menuBtn.getBoundingClientRect();
      btnBox = { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
      // Bounding box must be strictly within viewport [0, width]
      btnInsideScreen = btnVisible && r.x >= 0 && r.right <= width + 1;
    }

    // b. Right edge of all direct children of .header-inner <= width
    const children = Array.from(inner.children);
    const childDetails = children.map(c => {
      const r = c.getBoundingClientRect();
      return {
        tag: c.tagName,
        cls: c.className,
        right: r.right,
        overflow: r.right > width + 1
      };
    });
    const maxChildRight = Math.max(...childDetails.map(c => c.right), 0);
    const childrenInsideScreen = maxChildRight <= width + 1;

    // c. .header-nav visibility
    let navHidden = true;
    let navDisplay = 'none';
    if (nav) {
      const comp = window.getComputedStyle(nav);
      navDisplay = comp.display;
      navHidden = (comp.display === 'none' || comp.visibility === 'hidden' || nav.getBoundingClientRect().width === 0);
    }

    return {
      btnVisible,
      btnInsideScreen,
      btnBox,
      maxChildRight,
      childrenInsideScreen,
      childDetails,
      navHidden,
      navDisplay
    };
  }, screenWidth);
}

/**
 * Tests tapping hamburger, verifying drawer links, and closing drawer.
 */
async function testDrawerInteraction(page) {
  // Ensure menu button is inside viewport before clicking
  const menuBtn = page.locator('#mobileMenuBtn');
  await menuBtn.click({ timeout: 4000 });
  await page.waitForTimeout(200);

  const drawerStatus = await page.evaluate((minExpected) => {
    const drawer = document.getElementById('mobileNavDrawer');
    if (!drawer) return { exists: false };
    const isOpen = drawer.classList.contains('open');
    const links = Array.from(drawer.querySelectorAll('.mobile-nav-link'));
    return {
      exists: true,
      isOpen,
      toolCount: links.length,
      hasEnoughTools: links.length >= minExpected
    };
  }, MIN_DRAWER_TOOLS);

  // Close drawer
  const closeBtn = page.locator('#mobileNavClose');
  await closeBtn.click({ timeout: 4000 });
  await page.waitForTimeout(200);

  const isClosed = await page.evaluate(() => {
    const drawer = document.getElementById('mobileNavDrawer');
    return drawer ? !drawer.classList.contains('open') : false;
  });

  return {
    openedSuccessfully: drawerStatus.isOpen,
    hasEnoughTools: drawerStatus.hasEnoughTools,
    toolCount: drawerStatus.toolCount,
    closedSuccessfully: isClosed
  };
}

async function runMobileHeaderSuite(browserInstance = null, serverInstance = null) {
  console.log('========================================================================');
  console.log('          MOBILE HEADER & NAVIGATION AUDIT (RESPONSIVE BREAKPOINTS)     ');
  console.log('========================================================================');

  let server = serverInstance;
  let browser = browserInstance;
  let ownServer = false;
  let ownBrowser = false;

  try {
    if (!server) {
      server = await startTestServer(TEST_PORT);
      ownServer = true;
    }
    if (!browser) {
      browser = await chromium.launch({ headless: true });
      ownBrowser = true;
    }

    // Collect all standalone HTML pages except viewer.html
    const pagesDir = path.resolve(__dirname, '../../pages');
    const pageFiles = fs.readdirSync(pagesDir)
      .filter(f => f.endsWith('.html') && f !== 'viewer.html')
      .map(f => `pages/${f}`);
    
    const allPages = ['index.html', ...pageFiles];
    console.log(`Auditing ${allPages.length} pages across widths: ${TEST_WIDTHS.join(', ')} px...`);

    const failures = [];
    let checksRun = 0;

    for (const pagePath of allPages) {
      for (const width of TEST_WIDTHS) {
        checksRun++;
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          hasTouch: true
        });
        const page = await context.newPage();

        try {
          await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(150);

          const state = await evaluateHeaderState(page, width);

          const issues = [];
          if (!state.btnVisible) issues.push('mobileMenuBtn tidak terlihat');
          if (!state.btnInsideScreen) issues.push(`mobileMenuBtn keluar layar (right: ${state.btnBox ? state.btnBox.right : 'null'}px > ${width}px)`);
          if (!state.childrenInsideScreen) issues.push(`.header-inner anak melebihi lebar layar (maxRight: ${state.maxChildRight}px > ${width}px)`);
          if (!state.navHidden) issues.push(`.header-nav bocor tampil di layar seluler (display: ${state.navDisplay})`);

          // Only test drawer click at 390px if button is inside screen
          let drawerResult = null;
          if (width === 390 && state.btnInsideScreen) {
            try {
              drawerResult = await testDrawerInteraction(page);
              if (!drawerResult.openedSuccessfully) issues.push('Laci menu tidak terbuka saat hamburger diklik');
              if (!drawerResult.hasEnoughTools) issues.push(`Jumlah tool di laci kurang (${drawerResult.toolCount} < ${MIN_DRAWER_TOOLS})`);
              if (!drawerResult.closedSuccessfully) issues.push('Tombol tutup laci tidak menutup laci');
            } catch (err) {
              issues.push(`Gagal interaksi laci: ${err.message}`);
            }
          }

          if (issues.length > 0) {
            failures.push({
              page: pagePath,
              width,
              issues
            });
            console.log(`  ✗ [FAIL] ${pagePath} @ ${width}px: ${issues.join('; ')}`);
          }
        } finally {
          await page.close();
          await context.close();
        }
      }
    }

    // Also run on iPhone 13 WebKit
    if (webkit) {
      console.log('\n--- Auditing iPhone 13 on WebKit Engine ---');
      const webkitBrowser = await webkit.launch({ headless: true });
      try {
        for (const pagePath of allPages) {
          checksRun++;
          const context = await webkitBrowser.newContext({
            ...devices['iPhone 13']
          });
          const page = await context.newPage();
          try {
            await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(200);

            const state = await evaluateHeaderState(page, 390);
            const issues = [];
            if (!state.btnVisible) issues.push('mobileMenuBtn tidak terlihat');
            if (!state.btnInsideScreen) issues.push(`mobileMenuBtn keluar layar (right: ${state.btnBox ? state.btnBox.right : 'null'}px > 390px)`);
            if (!state.childrenInsideScreen) issues.push(`.header-inner anak melebihi lebar layar (maxRight: ${state.maxChildRight}px > 390px)`);
            if (!state.navHidden) issues.push(`.header-nav bocor tampil di layar seluler`);

            if (state.btnInsideScreen) {
              try {
                const drawerResult = await testDrawerInteraction(page);
                if (!drawerResult.openedSuccessfully) issues.push('Laci tidak terbuka');
                if (!drawerResult.hasEnoughTools) issues.push(`Tool drawer kurang (${drawerResult.toolCount})`);
                if (!drawerResult.closedSuccessfully) issues.push('Laci tidak menutup');
              } catch (err) {
                issues.push(`Drawer error: ${err.message}`);
              }
            }

            if (issues.length > 0) {
              failures.push({
                page: `${pagePath} (WebKit)`,
                width: 390,
                issues
              });
              console.log(`  ✗ [FAIL WebKit] ${pagePath}: ${issues.join('; ')}`);
            }
          } finally {
            await page.close();
            await context.close();
          }
        }
      } finally {
        await webkitBrowser.close();
      }
    }

    console.log('\n========================================================================');
    console.log(`TOTAL PENGECEKAN: ${checksRun}`);
    console.log(`TOTAL KEGAGALAN : ${failures.length}`);
    console.log('========================================================================\n');

    return {
      success: failures.length === 0,
      failures,
      checksRun
    };

  } finally {
    if (ownBrowser && browser) await browser.close();
    if (ownServer && server) server.close();
  }
}

if (require.main === module) {
  runMobileHeaderSuite().then(res => {
    process.exit(res && res.success ? 0 : 1);
  }).catch(err => {
    console.error('Fatal crash during mobile header test:', err);
    process.exit(1);
  });
}

module.exports = { runMobileHeaderSuite };
