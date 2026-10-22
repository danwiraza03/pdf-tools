const fs = require('fs');
const path = require('path');

const scripts = [
  'js/lib/pdf-lib.min.js',
  'js/lib/pdf.min.js',
  'js/lib/pdf.worker.min.js',
  'js/lib/FileSaver.min.js',
  'js/lib/jszip.min.js',
  'js/lib/Sortable.min.js',
  'js/utils/i18n.js',
  'js/utils/file-utils.js',
  'js/utils/download.js',
  'js/components/toast.js',
  'js/components/progress.js',
  'js/components/pdf-preview.js',
  'js/components/dropzone.js',
  'js/components/file-list.js',
  'js/core/pdf-compress.js',
  'js/app.js'
];

for (const s of scripts) {
  const full = path.join('c:/laragon/www/pdf', s);
  if (!fs.existsSync(full)) {
    console.error('MISSING FILE:', s);
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  try {
    new Function(content);
    console.log(`OK: ${s}`);
  } catch (err) {
    console.error(`SYNTAX ERROR in ${s}:`, err);
  }
}
