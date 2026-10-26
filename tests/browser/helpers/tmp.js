/**
 * Temporary Directory Helper for Browser Tests
 *
 * Provides isolated system temp directories under os.tmpdir()/pdf-tools-tests/<name>
 * with automatic recursive creation and cleanup via fs.rmSync.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getTempDir(name) {
  const dirPath = path.join(os.tmpdir(), 'pdf-tools-tests', name || `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dirPath, { recursive: true });

  return {
    dir: dirPath,
    path: dirPath,
    cleanup: function () {
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      } catch (err) {
        // Silently ignore cleanup errors (e.g. transient file locking on Windows)
      }
    },
    toString: function () {
      return dirPath;
    }
  };
}

module.exports = {
  getTempDir
};
