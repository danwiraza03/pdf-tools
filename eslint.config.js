'use strict';

const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'js/lib/**',
      'tests/browser/screenshots/**'
    ]
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
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
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', 'server.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error'
    }
  }
];
