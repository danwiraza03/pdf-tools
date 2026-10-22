/**
 * Automated Verification Test for Header Dropdowns (Convert & Mega Menu)
 * Verifies CSS styling, HTML structural presence, and runtime toggle behavior.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('         AUTOMATED TEST SUITE: HEADER DROPDOWNS & MEGA MENU            ');
console.log('========================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    failedChecks++;
    console.error(`❌ [FAIL] ${message}`);
  }
}

// ---------------------------------------------------------
// 1. CSS Stylesheet Rules Audit
// ---------------------------------------------------------
console.log('--- 1. Auditing CSS Rules in style.css & home.css ---');

const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');
const homeCss = fs.readFileSync(path.join(ROOT_DIR, 'css/home.css'), 'utf8');

assert(
  /\.convert-dropdown-menu\.(show|active)[\s\S]*?display:\s*block/i.test(styleCss),
  'style.css defines display: block for .convert-dropdown-menu with .show and .active'
);

assert(
  /\.mega-menu-overlay\.(show|active)[\s\S]*?display:\s*block/i.test(styleCss),
  'style.css defines display: block for .mega-menu-overlay with .show and .active'
);

assert(
  /\.nav-chevron-svg\.rotated/i.test(styleCss),
  'style.css includes .nav-chevron-svg.rotated for SVG chevron rotation'
);

assert(
  /\.convert-dropdown-menu::before/i.test(styleCss),
  'style.css includes invisible bridge ::before for smooth hover transition'
);

assert(
  /\.convert-dropdown-menu\.(show|active)[\s\S]*?display:\s*block/i.test(homeCss),
  'home.css defines display: block for .convert-dropdown-menu with .show and .active'
);

assert(
  /\.mega-menu-overlay\.(show|active)[\s\S]*?display:\s*block/i.test(homeCss),
  'home.css defines display: block for .mega-menu-overlay with .show and .active'
);

assert(
  /\.nav-chevron-svg\.rotated/i.test(homeCss),
  'home.css includes .nav-chevron-svg.rotated for SVG chevron rotation'
);

// ---------------------------------------------------------
// 2. HTML Files & Header Inclusion Audit
// ---------------------------------------------------------
console.log('\n--- 2. Auditing HTML Header Inclusion Across Pages ---');

const pagesDir = path.join(ROOT_DIR, 'pages');
const htmlFiles = [
  path.join(ROOT_DIR, 'index.html'),
  ...fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).map(f => path.join(pagesDir, f))
];

let allPagesHaveHeader = true;
let allPagesLoadHeaderJs = true;

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

  if (rel !== 'pages/viewer.html') { // viewer is fullscreen acrobat workspace
    if (!content.includes('id="appHeader"') && !content.includes('class="header"')) {
      allPagesHaveHeader = false;
      console.error(`Missing header in: ${rel}`);
    }
    if (!content.includes('header.js')) {
      allPagesLoadHeaderJs = false;
      console.error(`Missing header.js in: ${rel}`);
    }
  }
});

assert(allPagesHaveHeader, `All standalone pages contain header placeholder (Checked ${htmlFiles.length} files)`);
assert(allPagesLoadHeaderJs, `All standalone pages include js/components/header.js (Checked ${htmlFiles.length} files)`);

// ---------------------------------------------------------
// 3. Runtime DOM Toggle Behavior in Mocked Browser Environment
// ---------------------------------------------------------
console.log('\n--- 3. Testing Runtime Toggle & Keyboard Interactions ---');

function createMockElement(tagName, id = '', className = '') {
  const listeners = {};
  const attributes = {};
  const classes = new Set(className ? className.split(/\s+/).filter(Boolean) : []);
  let innerHTML = '';
  let parent = null;
  const children = [];

  const el = {
    tagName: tagName.toUpperCase(),
    id,
    dataset: {},
    get parentElement() { return parent; },
    get children() { return children; },
    get classList() {
      return {
        contains: (c) => classes.has(c),
        add: (...args) => args.forEach(c => classes.add(c)),
        remove: (...args) => args.forEach(c => classes.delete(c)),
        toggle: (c) => classes.has(c) ? classes.delete(c) : classes.add(c),
        toString: () => Array.from(classes).join(' ')
      };
    },
    get className() { return Array.from(classes).join(' '); },
    set className(val) {
      classes.clear();
      if (val) val.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
    get innerHTML() { return innerHTML; },
    set innerHTML(val) {
      innerHTML = val;
      children.length = 0;
      const tagMatches = val.matchAll(/<([a-z0-9]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi);
      for (const m of tagMatches) {
        const tagName = m[1];
        const rawAttrs = m[2];
        const id = m[3];
        const classMatch = rawAttrs.match(/class="([^"]+)"/i);
        const className = classMatch ? classMatch[1] : '';
        const childEl = createMockElement(tagName, id, className);

        const ariaMatch = rawAttrs.match(/aria-expanded="([^"]+)"/i);
        if (ariaMatch) childEl.setAttribute('aria-expanded', ariaMatch[1]);

        const haspopupMatch = rawAttrs.match(/aria-haspopup="([^"]+)"/i);
        if (haspopupMatch) childEl.setAttribute('aria-haspopup', haspopupMatch[1]);

        childEl.parent = el;
        children.push(childEl);
      }
    },
    setAttribute: (name, val) => { attributes[name] = String(val); },
    getAttribute: (name) => attributes[name] || null,
    hasAttribute: (name) => name in attributes,
    removeAttribute: (name) => { delete attributes[name]; },
    addEventListener: (evt, fn) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    dispatchEvent: (evt) => {
      const fns = listeners[evt.type] || [];
      evt.target = evt.target || el;
      evt.currentTarget = el;
      fns.forEach(fn => fn(evt));
      if (!evt.cancelBubble && parent && parent.dispatchEvent) {
        parent.dispatchEvent(evt);
      }
    },
    querySelector: function(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll: function(sel) {
      const results = [];
      function search(node) {
        if (!node) return;
        if (matchesSelector(node, sel)) results.push(node);
        if (node.children) node.children.forEach(search);
      }
      if (this.children) this.children.forEach(search);
      return results;
    },
    closest: function(sel) {
      let cur = this;
      while (cur) {
        if (matchesSelector(cur, sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    appendChild: function(child) {
      child.parent = this;
      children.push(child);
      return child;
    }
  };

  return el;
}

function matchesSelector(el, sel) {
  if (!el || !sel) return false;
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  if (sel === el.tagName.toLowerCase()) return true;
  // Multiple classes or complex selector fallback
  const parts = sel.split(/\s*,\s*/);
  if (parts.length > 1) return parts.some(p => matchesSelector(el, p));
  return false;
}

function setupMockDOM(currentUrl = 'http://127.0.0.1/index.html') {
  const docListeners = {};
  const allElements = {};

  const documentElement = createMockElement('html');
  const body = createMockElement('body');
  const header = createMockElement('header', 'appHeader', 'header');
  body.appendChild(header);
  documentElement.appendChild(body);

  const mockDoc = {
    readyState: 'complete',
    documentElement,
    body,
    getElementById: (id) => {
      if (allElements[id]) return allElements[id];
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) {
          const res = find(child);
          if (res) return res;
        }
        return null;
      }
      return find(documentElement);
    },
    querySelector: (sel) => documentElement.querySelector(sel),
    querySelectorAll: (sel) => documentElement.querySelectorAll(sel),
    createElement: (tag) => {
      const el = createMockElement(tag);
      return el;
    },
    addEventListener: (evt, fn) => {
      docListeners[evt] = docListeners[evt] || [];
      docListeners[evt].push(fn);
    },
    dispatchEvent: (evt) => {
      const fns = docListeners[evt.type] || [];
      fns.forEach(fn => fn(evt));
    }
  };

  const mockWindow = {
    location: {
      href: currentUrl,
      pathname: new URL(currentUrl).pathname
    },
    document: mockDoc,
    PDFTools: {},
    addEventListener: (evt, fn) => mockDoc.addEventListener(evt, fn)
  };

  return { mockWindow, mockDoc, header, body };
}

// Test 3.1: Landing Page header.js Dropdown Toggle
const { mockWindow, mockDoc, header } = setupMockDOM('http://127.0.0.1/index.html');

const headerJsCode = fs.readFileSync(path.join(ROOT_DIR, 'js/components/header.js'), 'utf8');

// Run header.js in sandbox
const context = vm.createContext({
  window: mockWindow,
  document: mockDoc,
  console,
  setTimeout,
  clearTimeout
});

vm.runInContext(headerJsCode, context);

// Verify initialization
assert(mockWindow.PDFTools.Header !== undefined, 'PDFTools.Header is registered globally');
mockWindow.PDFTools.Header.init();

const convertTrigger = mockDoc.getElementById('convertPdfTrigger');
const convertMenu = mockDoc.getElementById('convertDropdownMenu');
const allToolsTrigger = mockDoc.getElementById('allToolsTrigger');
const megaOverlay = mockDoc.getElementById('megaMenuOverlay');

assert(convertTrigger !== null, 'convertPdfTrigger element rendered');
assert(convertMenu !== null, 'convertDropdownMenu element rendered');
assert(allToolsTrigger !== null, 'allToolsTrigger element rendered');
assert(megaOverlay !== null, 'megaMenuOverlay element created and attached to body');

// Initially closed
assert(!convertMenu.classList.contains('show'), 'convertDropdownMenu initially closed');
assert(convertTrigger.getAttribute('aria-expanded') === 'false', 'convertPdfTrigger initial aria-expanded="false"');

// 1. Click Convert trigger -> Opens Convert Dropdown
convertTrigger.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});

assert(
  convertMenu.classList.contains('show') && convertMenu.classList.contains('active'),
  'Clicking convertPdfTrigger adds .show and .active to convertDropdownMenu'
);
assert(
  convertTrigger.getAttribute('aria-expanded') === 'true',
  'Clicking convertPdfTrigger sets aria-expanded="true"'
);

// 2. Click ALL PDF TOOLS trigger -> Closes Convert, Opens Mega Menu
allToolsTrigger.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});

assert(
  !convertMenu.classList.contains('show') && !convertMenu.classList.contains('active'),
  'Opening megaMenu closes convertDropdownMenu'
);
assert(
  megaOverlay.classList.contains('show') && megaOverlay.classList.contains('active'),
  'Clicking allToolsTrigger opens megaMenuOverlay with .show and .active'
);
assert(
  allToolsTrigger.getAttribute('aria-expanded') === 'true',
  'Clicking allToolsTrigger sets aria-expanded="true"'
);

// 3. Escape key closes Mega Menu
mockDoc.dispatchEvent({
  type: 'keydown',
  key: 'Escape'
});

assert(
  !megaOverlay.classList.contains('show') && !megaOverlay.classList.contains('active'),
  'Pressing Escape closes megaMenuOverlay'
);
assert(
  allToolsTrigger.getAttribute('aria-expanded') === 'false',
  'Pressing Escape resets allToolsTrigger aria-expanded="false"'
);

// 4. Outside click closes Convert Dropdown
convertTrigger.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert(convertMenu.classList.contains('show'), 'Re-opened convertDropdownMenu for outside click test');

// Simulate outside click on body
mockDoc.dispatchEvent({
  type: 'click',
  target: mockDoc.body
});

assert(
  !convertMenu.classList.contains('show') && !convertMenu.classList.contains('active'),
  'Clicking outside closes convertDropdownMenu cleanly'
);

// 5. Nine Dots Button -> Quick Actions Modal Interactions
const nineDotsBtn = mockDoc.getElementById('nineDotsBtn');
const quickModalBackdrop = mockDoc.getElementById('quickModalBackdrop');
const closeQuickModalBtn = mockDoc.getElementById('closeQuickModalBtn');

assert(nineDotsBtn !== null, 'nineDotsBtn element rendered in header');
assert(quickModalBackdrop !== null, 'quickModalBackdrop element created and attached to body');
assert(nineDotsBtn.getAttribute('aria-expanded') === 'false', 'nineDotsBtn initial aria-expanded="false"');
assert(!quickModalBackdrop.classList.contains('active'), 'quickModalBackdrop initially closed');

// Click nineDotsBtn -> Opens Quick Modal
nineDotsBtn.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});

assert(
  quickModalBackdrop.classList.contains('active'),
  'Clicking nineDotsBtn adds .active to quickModalBackdrop'
);
assert(
  nineDotsBtn.getAttribute('aria-expanded') === 'true',
  'Clicking nineDotsBtn sets aria-expanded="true"'
);

// Click cancel button -> Closes Quick Modal
assert(closeQuickModalBtn !== null, 'closeQuickModalBtn element exists in quickModal');
closeQuickModalBtn.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});

assert(
  !quickModalBackdrop.classList.contains('active'),
  'Clicking closeQuickModalBtn removes .active from quickModalBackdrop'
);
assert(
  nineDotsBtn.getAttribute('aria-expanded') === 'false',
  'Closing quickModal resets nineDotsBtn aria-expanded="false"'
);

// Re-open and test Escape key
nineDotsBtn.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert(quickModalBackdrop.classList.contains('active'), 'Re-opened quickModal for Escape test');

mockDoc.dispatchEvent({
  type: 'keydown',
  key: 'Escape'
});

assert(
  !quickModalBackdrop.classList.contains('active'),
  'Pressing Escape closes quickModalBackdrop'
);
assert(
  nineDotsBtn.getAttribute('aria-expanded') === 'false',
  'Pressing Escape resets nineDotsBtn aria-expanded="false"'
);

// Re-open and test backdrop click
nineDotsBtn.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert(quickModalBackdrop.classList.contains('active'), 'Re-opened quickModal for backdrop click test');

mockDoc.dispatchEvent({
  type: 'click',
  target: quickModalBackdrop
});

assert(
  !quickModalBackdrop.classList.contains('active'),
  'Clicking directly on quickModalBackdrop backdrop closes modal'
);

// ---------------------------------------------------------
// 4. Active Route Preservation Test (e.g. pages/pdf-to-docx.html)
// ---------------------------------------------------------
console.log('\n--- 4. Testing Active Route Indicator Preservation ---');

const docxDOM = setupMockDOM('http://127.0.0.1/pages/pdf-to-docx.html');
const docxContext = vm.createContext({
  window: docxDOM.mockWindow,
  document: docxDOM.mockDoc,
  console,
  setTimeout,
  clearTimeout
});

vm.runInContext(headerJsCode, docxContext);
docxDOM.mockWindow.PDFTools.Header.init();

const docxConvertTrigger = docxDOM.mockDoc.getElementById('convertPdfTrigger');
const docxConvertMenu = docxDOM.mockDoc.getElementById('convertDropdownMenu');

assert(
  docxConvertTrigger.classList.contains('active'),
  'convertPdfTrigger starts with .active route indicator on pdf-to-docx.html'
);

// Open menu
docxConvertTrigger.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});

// Close menu
docxConvertTrigger.dispatchEvent({
  type: 'click',
  preventDefault: () => {},
  stopPropagation: () => {}
});

assert(
  docxConvertTrigger.classList.contains('active'),
  'convertPdfTrigger preserves .active route indicator after opening and closing dropdown'
);

// ---------------------------------------------------------
// Final Summary
// ---------------------------------------------------------
console.log('\n========================================================================');
console.log(`RESULTS: ${passedChecks} passed, ${failedChecks} failed across ${totalChecks} test assertions`);
console.log('========================================================================');

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
