'use strict';

const globals = require('globals');

module.exports = [
  // Ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'js/lib/**',
      'tests/browser/screenshots/**'
    ]
  },

  // 1a. Base configuration for all frontend js/** scripts
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        PDFTools: 'writable',
        Tesseract: 'readonly',
        // Library globals derived from <script> tags in pages/*.html
        PDFLib: 'readonly',
        pdfjsLib: 'readonly',
        JSZip: 'readonly',
        Sortable: 'readonly',
        saveAs: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error'
    }
  },

  // 1b. UMD guards only for js/core/** and js/editor/** (no Buffer here)
  {
    files: ['js/core/**/*.js', 'js/editor/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        global: 'readonly'
      }
    }
  },

  // 1d. File-specific overrides
  // js/editor/redaction-engine.js -> Buffer (Node raster fallback and createNodeRasterPng test helper)
  {
    files: ['js/editor/redaction-engine.js'],
    languageOptions: {
      globals: {
        Buffer: 'readonly'
      }
    }
  },
  // js/core/pdf-studio.js -> pdfjs (legacy typeof guard)
  {
    files: ['js/core/pdf-studio.js'],
    languageOptions: {
      globals: {
        pdfjs: 'readonly'
      }
    }
  },

  // 1c. Node files: tests/**, scripts/**, server.js, eslint.config.js
  // sourceType 'commonjs' resolves no-redeclare for `const crypto = require('crypto')`
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', 'server.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error'
    }
  },

  // 1c (continued). Tests evaluation globals (browser, PDFLib, pdfjsLib, PDFTools, Image for page.evaluate)
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        PDFTools: 'readonly',
        PDFLib: 'readonly',
        pdfjsLib: 'readonly',
        Image: 'readonly'
      }
    }
  }
];
