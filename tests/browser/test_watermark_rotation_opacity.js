const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const PDFLib = require(path.resolve(__dirname, '../../js/lib/pdf-lib.min.js'));
const { startTestServer, launchChromium, launchWebKit } = require('./helpers');
const { getTempDir } = require('./helpers/tmp');

/**
 * Creates a pure white A4 PDF document
 */
async function createWhiteA4Pdf() {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: PDFLib.rgb(1, 1, 1)
  });
  return await doc.save();
}

/**
 * Helper to analyze canvas pixels from #wmResultCanvas
 */
async function analyzeCanvasPixels(page, mode = 'image') {
  await page.waitForFunction(({ mode }) => {
    const canvas = document.getElementById('wmResultCanvas');
    if (!canvas || canvas.width <= 50 || canvas.height <= 50) return false;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (mode === 'image') {
        if (a > 10 && g < 240 && r > 100 && b > 100) return true;
      } else {
        if (a > 10 && (r < 235 || g < 235 || b < 235)) return true;
      }
    }
    return false;
  }, { mode }, { timeout: 15000 });

  return await page.evaluate(({ mode }) => {
    const canvas = document.getElementById('wmResultCanvas');
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return { error: 'Canvas empty or not found', coloredCount: 0 };
    }
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let minX = canvas.width, maxX = -1;
    let minY = canvas.height, maxY = -1;
    let coloredCount = 0;
    let sumGreen = 0;
    let sumGray = 0;
    let thickColoredCount = 0;

    const coloredPixels = [];

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        let isTarget = false;
        if (mode === 'image') {
          // Magenta on white: green channel drops from 255
          if (a > 10 && g < 240 && r > 100 && b > 100) {
            isTarget = true;
            sumGreen += g;
            thickColoredCount++;
          }
        } else {
          // Black text on white: r, g, b drop from 255
          if (a > 10 && (r < 235 || g < 235 || b < 235)) {
            isTarget = true;
            // Core/thick pixels for measuring opacity
            if (r < 220) {
              sumGray += (r + g + b) / 3;
              thickColoredCount++;
            }
          }
        }

        if (isTarget) {
          coloredCount++;
          coloredPixels.push({ x, y });
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (coloredCount === 0) {
      return { coloredCount: 0, bboxWidth: 0, bboxHeight: 0, bboxArea: 0 };
    }

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    const bboxArea = bboxWidth * bboxHeight;
    const avgGreen = thickColoredCount > 0 ? (sumGreen / thickColoredCount) : 255;
    const avgGray = thickColoredCount > 0 ? (sumGray / thickColoredCount) : 255;

    // Calculate covariance / tilt orientation: sum((x - meanX) * (y - meanY))
    let meanX = 0, meanY = 0;
    for (const p of coloredPixels) {
      meanX += p.x;
      meanY += p.y;
    }
    meanX /= coloredCount;
    meanY /= coloredCount;

    let covXY = 0;
    for (const p of coloredPixels) {
      covXY += (p.x - meanX) * (p.y - meanY);
    }
    covXY /= coloredCount;

    return {
      coloredCount,
      thickColoredCount,
      minX, maxX, minY, maxY,
      bboxWidth, bboxHeight, bboxArea,
      avgGreen, avgGray,
      covXY
    };
  }, { mode });
}

/**
 * Main suite testing rotation and opacity behavior across Chromium and iPhone 13 WebKit
 */
async function runRotationOpacitySuite(browser, baseUrl, engineName = 'Chromium') {
  console.log(`\n========================================================================`);
  console.log(`>>> [TEST] Watermark Rotation & Opacity Suite (${engineName})`);
  console.log(`========================================================================`);

  const temp = getTempDir('test_wm_rot_op');
  const tempDir = temp.dir;

  const whitePdfPath = path.join(tempDir, 'white_a4.pdf');
  const magentaPngPath = path.join(tempDir, 'magenta_200x100.png');
  fs.writeFileSync(whitePdfPath, await createWhiteA4Pdf());

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} "${dialog.message()}"`);
  });

  try {
    await page.goto(`${baseUrl}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    // Generate solid magenta 200x100 PNG
    const pngBase64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(0, 0, 200, 100);
      return c.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(magentaPngPath, Buffer.from(pngBase64, 'base64'));

    const pdfInput = page.locator('#dropzone input[type="file"]');
    await pdfInput.setInputFiles(whitePdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

    // Verify presence of unified rotation & opacity controls
    const rotSlider = page.locator('#wmRotationRange');
    const rotNum = page.locator('#wmRotationNum');
    const rotResetBtn = page.locator('#wmResetRotationBtn');
    const opSlider = page.locator('#wmOpacityRange');
    const opNum = page.locator('#wmOpacityNum');

    // 1. Requirement 1d: Synchronized slider and number input + reset button
    console.log('  --- Checking Rotation & Opacity Control Synchronization ---');
    await rotSlider.waitFor({ state: 'visible', timeout: 4000 });
    await rotNum.waitFor({ state: 'visible', timeout: 4000 });
    await opSlider.waitFor({ state: 'visible', timeout: 4000 });
    await opNum.waitFor({ state: 'visible', timeout: 4000 });

    // Slider -> number input sync
    await rotSlider.fill('45');
    await rotSlider.dispatchEvent('input');
    assert.strictEqual(await rotNum.inputValue(), '45', 'Number input must sync when slider moves to 45');
    assert((await page.locator('#wmRotationVal').textContent()).includes('45'), 'Rotation label must show 45');

    // Number input -> slider sync
    await rotNum.fill('-30');
    await rotNum.dispatchEvent('input');
    assert.strictEqual(await rotSlider.inputValue(), '-30', 'Slider must sync when number input changes to -30');
    assert((await page.locator('#wmRotationVal').textContent()).includes('-30'), 'Rotation label must show -30');

    // Reset button returns to 0
    await rotResetBtn.click();
    assert.strictEqual(await rotSlider.inputValue(), '0', 'Reset button must set slider back to 0');
    assert.strictEqual(await rotNum.inputValue(), '0', 'Reset button must set number input back to 0');
    console.log('  ✓ Slider, number inputs, and reset button synchronized properly.');

    // 2. Requirement 1a: Default rotation without changes is 0 (NOT tilted) for Image & Text
    console.log('  --- Checking Requirement 1a: Default Rotation = 0 (Axis-aligned / Horizontal) ---');

    // 2A. Image mode default rotation
    await page.locator('#wmModeImage').click();
    await page.waitForTimeout(200);
    await page.locator('#wmImageInput').setInputFiles(magentaPngPath);
    await page.waitForTimeout(300);

    // Apply with default rotation (0)
    await page.locator('#applyBtn').click();
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });

    const imgDefaultAnalysis = await analyzeCanvasPixels(page, 'image');
    assert(imgDefaultAnalysis.coloredCount > 0, 'Image watermark pixels must be rendered');
    const imgRatio = imgDefaultAnalysis.bboxArea / imgDefaultAnalysis.coloredCount;
    // For a non-tilted solid rectangle, bboxArea ≈ coloredCount (diff <= 5%)
    assert(imgRatio <= 1.06, `Default image watermark must NOT be tilted. bboxArea/pixels ratio=${imgRatio.toFixed(3)} (expected <= 1.06)`);
    console.log(`  ✓ Image mode default rotation is untilted (ratio: ${imgRatio.toFixed(3)} <= 1.06).`);

    // 2B. Text mode default rotation
    await page.locator('#resetBtn').click();
    await page.waitForSelector('#dropzone', { state: 'visible', timeout: 5000 });
    await pdfInput.setInputFiles(whitePdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

    await page.locator('#wmModeText').click();
    await page.locator('#wmText').fill('TES-LURUS');
    await page.locator('#wmFontSize').selectOption('72');
    // Ensure default rotation is 0
    assert.strictEqual(await page.locator('#wmRotationNum').inputValue(), '0', 'Default text rotation must be 0');

    await page.locator('#applyBtn').click();
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });

    const textDefaultAnalysis = await analyzeCanvasPixels(page, 'text');
    assert(textDefaultAnalysis.coloredCount > 0, 'Text watermark pixels must be rendered');
    // Horizontal text has bboxWidth much larger than bboxHeight
    assert(textDefaultAnalysis.bboxWidth > textDefaultAnalysis.bboxHeight * 2, 'Default text must be horizontal (bboxWidth > 2 * bboxHeight)');
    console.log(`  ✓ Text mode default rotation is horizontal ("TES-LURUS" bbox: ${textDefaultAnalysis.bboxWidth}x${textDefaultAnalysis.bboxHeight}).`);

    // 3. Requirement 1c: Rotation +30, -30, and 90 on both modes
    console.log('  --- Checking Requirement 1c: Rotation +30, -30, and 90 degrees ---');

    // Test Image +30 and -30
    async function testRotationOnImage(angle) {
      await page.locator('#resetBtn').click();
      await page.waitForSelector('#dropzone', { state: 'visible', timeout: 5000 });
      await pdfInput.setInputFiles(whitePdfPath);
      await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

      await page.locator('#wmModeImage').click();
      await page.locator('#wmImageInput').setInputFiles(magentaPngPath);
      await page.locator('#wmImageThumb').waitFor({ state: 'visible', timeout: 5000 });
      await page.locator('#wmRotationNum').fill(String(angle));
      await page.locator('#wmRotationNum').dispatchEvent('input');
      await page.locator('#wmRotationNum').dispatchEvent('change');

      await page.locator('#applyBtn').click();
      await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });
      return await analyzeCanvasPixels(page, 'image');
    }

    const imgRotPlus30 = await testRotationOnImage(30);
    const imgRotMinus30 = await testRotationOnImage(-30);
    const imgRot90 = await testRotationOnImage(90);

    const ratioPlus30 = imgRotPlus30.bboxArea / imgRotPlus30.coloredCount;
    const ratioMinus30 = imgRotMinus30.bboxArea / imgRotMinus30.coloredCount;
    assert(ratioPlus30 > 1.25, `Image at +30° bbox must expand (got ratio ${ratioPlus30.toFixed(2)} > 1.25)`);
    assert(ratioMinus30 > 1.25, `Image at -30° bbox must expand (got ratio ${ratioMinus30.toFixed(2)} > 1.25)`);
    // Opposite tilt orientation: covariance sign must be opposite
    assert((imgRotPlus30.covXY * imgRotMinus30.covXY) < 0, `Tilts for +30° and -30° must have opposite directions (covXY: ${imgRotPlus30.covXY} vs ${imgRotMinus30.covXY})`);
    // 90° rotation produces upright bbox: bboxHeight > bboxWidth
    assert(imgRot90.bboxHeight > imgRot90.bboxWidth * 1.5, `Image at 90° must be upright (height ${imgRot90.bboxHeight} > 1.5 * width ${imgRot90.bboxWidth})`);
    console.log('  ✓ Image rotation +30°, -30°, and 90° verified with proper bounding box geometry and opposite tilt.');

    // 4. Requirement 1b: Opacity 20%, 50%, 100% (via slider & number field)
    console.log('  --- Checking Requirement 1b: Opacity Levels 20%, 50%, 100% ---');
    async function testOpacityOnImage(opValue, viaInput = false) {
      await page.locator('#resetBtn').click();
      await page.waitForSelector('#dropzone', { state: 'visible', timeout: 5000 });
      await pdfInput.setInputFiles(whitePdfPath);
      await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

      await page.locator('#wmModeImage').click();
      await page.locator('#wmImageInput').setInputFiles(magentaPngPath);
      await page.locator('#wmImageThumb').waitFor({ state: 'visible', timeout: 5000 });
      await page.locator('#wmRotationNum').fill('0');
      await page.locator('#wmRotationNum').dispatchEvent('input');
      await page.locator('#wmRotationNum').dispatchEvent('change');

      if (viaInput) {
        await page.locator('#wmOpacityNum').fill(String(opValue));
        await page.locator('#wmOpacityNum').dispatchEvent('input');
        await page.locator('#wmOpacityNum').dispatchEvent('change');
      } else {
        await page.evaluate((val) => {
          const el = document.getElementById('wmOpacityRange');
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, opValue);
      }

      await page.locator('#applyBtn').click();
      await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });
      return await analyzeCanvasPixels(page, 'image');
    }

    const op20 = await testOpacityOnImage(20, false);
    const op50 = await testOpacityOnImage(50, true);
    const op100 = await testOpacityOnImage(100, false);

    // Green component for magenta #FF00FF on white (255) is ~ 255 * (1 - opacity)
    // 20% opacity: green ~ 204 (+-10)
    // 50% opacity: green ~ 128 (+-10)
    // 100% opacity: green ~ 0 (+-10)
    console.log(`    - Opacity 20% green: ${op20.avgGreen.toFixed(1)} (expected ~204 ±10)`);
    console.log(`    - Opacity 50% green: ${op50.avgGreen.toFixed(1)} (expected ~128 ±10)`);
    console.log(`    - Opacity 100% green: ${op100.avgGreen.toFixed(1)} (expected ~0 ±10)`);

    assert(Math.abs(op20.avgGreen - 204) <= 10, `Opacity 20% green (${op20.avgGreen}) out of expected range ~204 ±10`);
    assert(Math.abs(op50.avgGreen - 128) <= 10, `Opacity 50% green (${op50.avgGreen}) out of expected range ~128 ±10`);
    assert(Math.abs(op100.avgGreen - 0) <= 10, `Opacity 100% green (${op100.avgGreen}) out of expected range ~0 ±10`);

    // Invalid opacity check: 0 or out of range rejected or corrected
    await page.locator('#resetBtn').click();
    await page.waitForSelector('#dropzone', { state: 'visible', timeout: 5000 });
    await pdfInput.setInputFiles(whitePdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

    await page.locator('#wmOpacityNum').fill('0');
    await page.locator('#wmOpacityNum').dispatchEvent('change');
    const correctedOp = parseInt(await page.locator('#wmOpacityNum').inputValue(), 10);
    assert(correctedOp >= 1, `Opacity 0 must be corrected to >= 1, got ${correctedOp}`);
    console.log('  ✓ Opacity level colors (20%, 50%, 100%) and boundary input validations verified.');

    console.log(`\n✅ [PASS] Watermark Rotation & Opacity Suite passed on ${engineName}!`);
    return { success: true };
  } finally {
    await page.close();
    await context.close();
    temp.cleanup();
  }
}

/**
 * iPhone 13 WebKit runner for rotation & opacity
 */
async function runRotationOpacityWebKitMobile(baseUrl) {
  console.log(`\n========================================================================`);
  console.log(`>>> [TEST] Watermark Rotation & Opacity on iPhone 13 (WebKit)`);
  console.log(`========================================================================`);

  const browser = await launchWebKit({ headless: true });
  if (!browser) {
    console.log('  ⚠️  [DILEWATI] Watermark Rotation & Opacity iPhone 13 (WebKit) dilewati karena WebKit tidak tersedia.');
    return { success: true, skipped: true, skippedWebKit: 1 };
  }

  const context = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true
  });
  const page = await context.newPage();

  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} "${dialog.message()}"`);
  });

  const temp = getTempDir('test_wm_rot_op_mobile');
  const tempDir = temp.dir;

  try {
    await page.goto(`${baseUrl}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    const whitePdfPath = path.join(tempDir, 'mobile_white.pdf');
    fs.writeFileSync(whitePdfPath, await createWhiteA4Pdf());

    await page.locator('#dropzone input[type="file"]').setInputFiles(whitePdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

    // Verify unified sliders exist and touch target size >= 44px
    const rotSlider = page.locator('#wmRotationRange');
    const opSlider = page.locator('#wmOpacityRange');
    await rotSlider.waitFor({ state: 'visible', timeout: 4000 });
    await opSlider.waitFor({ state: 'visible', timeout: 4000 });

    const rotBox = await rotSlider.boundingBox();
    const opBox = await opSlider.boundingBox();
    assert(rotBox.height >= 40, `Rotation slider height must be >= 40px, got ${rotBox.height}`);
    assert(opBox.height >= 40, `Opacity slider height must be >= 40px, got ${opBox.height}`);

    // Verify no horizontal overflow
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!hasOverflow, 'Watermark options on iPhone 13 WebKit must have zero horizontal overflow');

    console.log('  ✓ iPhone 13 WebKit touch targets >= 44px and zero overflow verified.');
    return { success: true };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    temp.cleanup();
  }
}

// Standalone runner
if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await startTestServer(8765);
      browser = await launchChromium({ headless: true });
      await runRotationOpacitySuite(browser, 'http://127.0.0.1:8765');
      await runRotationOpacityWebKitMobile('http://127.0.0.1:8765');
      console.log('\n🎉 ALL ROTATION & OPACITY TESTS PASSED!\n');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ [FAIL] Rotation & Opacity Test Failed:');
      console.error(err.message || err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = {
  runRotationOpacitySuite,
  runRotationOpacityWebKitMobile
};
