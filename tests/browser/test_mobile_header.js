const fs = require('fs');
const path = require('path');
const { devices } = require('playwright');
const { startTestServer, launchChromium, launchWebKit } = require('./helpers');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Breakpoints required: 360, 375, 390, 393, 412, 414, 430 px
const MOBILE_WIDTHS = [360, 375, 390, 393, 412, 414, 430];
const TABLET_WIDTHS = [768, 810, 834];

// Minimum expected tools in drawer (21 tool pages + viewer)
const MIN_DRAWER_TOOLS = 20;

/**
 * Evaluates header geometry, touch targets, and visibility on the active page.
 */
async function evaluateHeaderState(page, screenWidth, isTouch) {
  return await page.evaluate(({ width, touch }) => {
    const inner = document.querySelector('.header-inner');
    if (!inner) return { error: 'No .header-inner found' };

    const nav = document.querySelector('.header-nav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    const controls = document.querySelector('.header-controls');

    // a. Horizontal overflow check
    const scrollW = document.documentElement.scrollWidth;
    const hasHorizontalOverflow = scrollW > width;

    // b. Header children & controls boundary check: all must be >= 4px inside right edge (right <= width - 4)
    const elementsToCheck = [];
    if (menuBtn) elementsToCheck.push({ name: '#mobileMenuBtn', el: menuBtn });
    if (controls) {
      Array.from(controls.children).forEach(c => {
        const s = window.getComputedStyle(c);
        if (s.display !== 'none' && s.visibility !== 'hidden') {
          elementsToCheck.push({ name: `controls > ${c.tagName.toLowerCase()}.${Array.from(c.classList).join('.')}`, el: c });
        }
      });
    }
    if (inner) {
      Array.from(inner.children).forEach(c => {
        const s = window.getComputedStyle(c);
        if (s.display !== 'none' && s.visibility !== 'hidden') {
          elementsToCheck.push({ name: `inner > ${c.tagName.toLowerCase()}.${Array.from(c.classList).join('.')}`, el: c });
        }
      });
    }

    const boundaryIssues = [];
    let maxChildRight = 0;
    for (const item of elementsToCheck) {
      const r = item.el.getBoundingClientRect();
      if (r.right > maxChildRight) maxChildRight = r.right;
      // Syarat: minimal 4px di dalam tepi kanan -> right <= width - 4
      if (r.right > width - 4) {
        boundaryIssues.push(`${item.name} keluar batas (right: ${r.right.toFixed(1)}px > batas ${width - 4}px, selisih +${(r.right - (width - 4)).toFixed(1)}px)`);
      }
    }

    // c. Minimum 44x44px touch targets on touch devices
    const touchTargetIssues = [];
    if (touch && controls) {
      const touchSelectors = ['.theme-toggle', '.lang-toggle', '.nine-dots-btn', '.mobile-menu-btn'];
      for (const sel of touchSelectors) {
        const el = controls.querySelector(sel);
        if (el) {
          const comp = window.getComputedStyle(el);
          if (comp.display !== 'none' && comp.visibility !== 'hidden') {
            const r = el.getBoundingClientRect();
            // Rounding tolerance: 43.5px
            if (r.width < 43.5 || r.height < 43.5) {
              touchTargetIssues.push(`${sel} touch target kurang dari 44x44px (${r.width.toFixed(1)}x${r.height.toFixed(1)}px)`);
            }
          }
        }
      }
    }

    // d. .header-nav visibility check
    let navHidden = true;
    let navDisplay = 'none';
    if (nav) {
      const comp = window.getComputedStyle(nav);
      navDisplay = comp.display;
      navHidden = (comp.display === 'none' || comp.visibility === 'hidden' || nav.getBoundingClientRect().width === 0);
    }

    // e. #mobileMenuBtn check
    let btnVisible = false;
    let btnBox = null;
    if (menuBtn) {
      const comp = window.getComputedStyle(menuBtn);
      btnVisible = comp.display !== 'none' && comp.visibility !== 'hidden';
      const r = menuBtn.getBoundingClientRect();
      btnBox = { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
    }

    return {
      hasHorizontalOverflow,
      scrollW,
      width,
      boundaryIssues,
      touchTargetIssues,
      maxChildRight,
      navHidden,
      navDisplay,
      btnVisible,
      btnBox
    };
  }, { width: screenWidth, touch: isTouch });
}

/**
 * Tests tapping hamburger, verifying drawer links, and closing drawer.
 */
async function testDrawerInteraction(page) {
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
  console.log('  MOBILE HEADER AUDIT (360-430px Touch & Non-Touch, Wide Fallback Font) ');
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
      browser = await launchChromium({ headless: true });
      ownBrowser = true;
    }

    // Collect all standalone HTML pages except viewer.html
    const pagesDir = path.resolve(__dirname, '../../pages');
    const pageFiles = fs.readdirSync(pagesDir)
      .filter(f => f.endsWith('.html') && f !== 'viewer.html')
      .map(f => `pages/${f}`);
    
    const allPages = ['index.html', ...pageFiles];
    console.log(`Auditing ${allPages.length} pages across mobile widths: ${MOBILE_WIDTHS.join(', ')} px...`);

    const failures = [];
    let checksRun = 0;

    // Test matrix: each width with touch and without touch
    const testVariants = [];
    for (const width of MOBILE_WIDTHS) {
      testVariants.push({ width, hasTouch: true, isMobile: true, label: 'Touch' });
      testVariants.push({ width, hasTouch: false, isMobile: false, label: 'NoTouch' });
    }
    // Also include tablet widths (touch)
    for (const width of TABLET_WIDTHS) {
      testVariants.push({ width, hasTouch: true, isMobile: true, label: 'Tablet' });
    }

    for (const pagePath of allPages) {
      for (const variant of testVariants) {
        checksRun++;
        const context = await browser.newContext({
          viewport: { width: variant.width, height: 844 },
          hasTouch: variant.hasTouch,
          isMobile: variant.isMobile
        });
        const page = await context.newPage();

        try {
          await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(100);

          // SUNTIKKAN CSS "FONT LEBAR": Memaksa logo & header controls memakai font cadangan lebar
          // seperti 'DejaVu Sans', Verdana agar hasil uji tidak bergantung pada font OS.
          await page.addStyleTag({
            content: `
              .app-logo, .app-logo *, .logo-title, .logo-title *,
              .header-controls, .header-controls *,
              .theme-toggle, .lang-toggle, .nine-dots-btn, .mobile-menu-btn {
                font-family: 'DejaVu Sans', Verdana, sans-serif !important;
              }
            `
          });
          await page.waitForTimeout(50);

          const state = await evaluateHeaderState(page, variant.width, variant.hasTouch);

          const issues = [];
          if (!state.btnVisible) issues.push('mobileMenuBtn tidak terlihat');
          if (state.hasHorizontalOverflow) {
            issues.push(`Horizontal overflow terdeteksi (scrollWidth: ${state.scrollW}px > ${variant.width}px)`);
          }
          if (state.boundaryIssues && state.boundaryIssues.length > 0) {
            issues.push(...state.boundaryIssues);
          }
          if (state.touchTargetIssues && state.touchTargetIssues.length > 0) {
            issues.push(...state.touchTargetIssues);
          }
          if (!state.navHidden) {
            issues.push(`.header-nav bocor tampil di layar seluler (display: ${state.navDisplay})`);
          }

          // Test drawer interaction on 390px Touch
          if (variant.width === 390 && variant.hasTouch && issues.length === 0) {
            try {
              const drawerResult = await testDrawerInteraction(page);
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
              variant: `${variant.width}px (${variant.label})`,
              issues
            });
            console.log(`  ✗ [FAIL] ${pagePath} @ ${variant.width}px (${variant.label}): ${issues[0]} (total ${issues.length} issues)`);
          }
        } finally {
          await page.close();
          await context.close();
        }
      }
    }

    // Also run on iPhone 13 WebKit
    console.log('\n--- Auditing iPhone 13 on WebKit Engine ---');
    let skippedWebKitCount = 0;
    const webkitBrowser = await launchWebKit({ headless: true });
    if (!webkitBrowser) {
      console.log('  ⚠️  [DILEWATI] Audit iPhone 13 pada WebKit Engine dilewati karena WebKit tidak tersedia.');
      skippedWebKitCount++;
    } else {
      try {
        for (const pagePath of allPages) {
          checksRun++;
          const context = await webkitBrowser.newContext({
            ...devices['iPhone 13']
          });
          const page = await context.newPage();
          try {
            await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(100);

            // Wide font injection
            await page.addStyleTag({
              content: `
                .app-logo, .app-logo *, .logo-title, .logo-title *,
                .header-controls, .header-controls *,
                .theme-toggle, .lang-toggle, .nine-dots-btn, .mobile-menu-btn {
                  font-family: 'DejaVu Sans', Verdana, sans-serif !important;
                }
              `
            });
            await page.waitForTimeout(50);

            const state = await evaluateHeaderState(page, 390, true);
            const issues = [];
            if (!state.btnVisible) issues.push('mobileMenuBtn tidak terlihat');
            if (state.hasHorizontalOverflow) issues.push(`Horizontal overflow (${state.scrollW}px > 390px)`);
            if (state.boundaryIssues && state.boundaryIssues.length > 0) issues.push(...state.boundaryIssues);
            if (state.touchTargetIssues && state.touchTargetIssues.length > 0) issues.push(...state.touchTargetIssues);
            if (!state.navHidden) issues.push('.header-nav bocor tampil di layar seluler');

            if (issues.length > 0) {
              failures.push({
                page: `${pagePath} (WebKit)`,
                variant: '390px iPhone 13',
                issues
              });
              console.log(`  ✗ [FAIL WebKit] ${pagePath}: ${issues[0]}`);
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
      checksRun,
      skippedWebKit: skippedWebKitCount
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
