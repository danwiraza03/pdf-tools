/**
 * PDF Tools — Form Fill Standalone Page Controller
 * Extracted from pages/form-fill.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
      let pdfFile = null;
      let pdfArrayBuffer = null;
      let pdfDocLib = null;       // pdf-lib instance
      let pdfJsDoc = null;        // pdf.js instance
      let totalPages = 1;
      let currentPage = 1;
      let currentScale = 1.0;

      // Detected AcroForm Fields map: name -> { field, type, pageNum, rect, value }
      let formFieldsMap = new Map();

      const uploadState = document.getElementById('uploadState');
      const workspaceState = document.getElementById('workspaceState');
      const dropzone = document.getElementById('dropzone');
      const fileInput = document.getElementById('fileInput');
      const docTitle = document.getElementById('docTitle');
      const changeDocBtn = document.getElementById('changeDocBtn');
      const resetFormBtn = document.getElementById('resetFormBtn');
      const pdfPageCanvas = document.getElementById('pdfPageCanvas');
      const formFieldsLayer = document.getElementById('formFieldsLayer');
      const prevPageBtn = document.getElementById('prevPageBtn');
      const nextPageBtn = document.getElementById('nextPageBtn');
      const pageInfo = document.getElementById('pageInfo');
      const fieldsCountBadge = document.getElementById('fieldsCountBadge');
      const fieldsListContainer = document.getElementById('fieldsListContainer');
      const noFieldsAlert = document.getElementById('noFieldsAlert');
      const flattenOutputCheck = document.getElementById('flattenOutputCheck');
      const exportDataBtn = document.getElementById('exportDataBtn');
      const importDataBtn = document.getElementById('importDataBtn');
      const importDataInput = document.getElementById('importDataInput');
      const savePdfBtn = document.getElementById('savePdfBtn');

      // Dropzone
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      });
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
      });
      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); });
      });
      dropzone.addEventListener('drop', e => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });

      changeDocBtn.addEventListener('click', () => {
        workspaceState.style.display = 'none';
        uploadState.style.display = 'block';
        pdfFile = null;
        pdfArrayBuffer = null;
      });

      // Check pending file
      (async function checkPending() {
        if (window.PDFTools && PDFTools.FileUtils && PDFTools.FileUtils.getPendingFile) {
          const pending = await PDFTools.FileUtils.getPendingFile();
          if (pending) handleFile(pending);
        }
      })();

      async function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          if (PDFTools.Toast) PDFTools.Toast.error('Please select a PDF document.');
          return;
        }

        pdfFile = file;
        docTitle.textContent = file.name;
        if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
          PDFTools.FileUtils.initPdfJsWorker();
        }

        // 1. Load with loadPdfDecrypted
        pdfDocLib = await PDFTools.FileUtils.loadPdfDecrypted(file);
        const decryptedBytes = await pdfDocLib.save();
        pdfArrayBuffer = decryptedBytes.buffer.slice(decryptedBytes.byteOffset, decryptedBytes.byteOffset + decryptedBytes.byteLength);

        // 2. Load with PDF.js for crisp rendering
        const loadingTask = pdfjsLib.getDocument({ data: decryptedBytes });
        pdfJsDoc = await loadingTask.promise;
        totalPages = pdfJsDoc.numPages;
        currentPage = 1;

        // 3. Inspect AcroForm fields
        extractFieldsFromDoc();

        uploadState.style.display = 'none';
        workspaceState.style.display = 'block';

        await renderPage(currentPage);
      }

      function extractFieldsFromDoc() {
        formFieldsMap.clear();
        try {
          const form = pdfDocLib.getForm();
          const fields = form.getFields();

          fields.forEach(field => {
            const name = field.getName();
            let type = 'unknown';
            let val = '';

            const constructorName = field.constructor.name;
            if (constructorName.includes('PDFTextField')) {
              type = 'text';
              val = field.getText() || '';
            } else if (constructorName.includes('PDFCheckBox')) {
              type = 'checkbox';
              val = field.isChecked();
            } else if (constructorName.includes('PDFDropdown')) {
              type = 'dropdown';
              val = field.getSelected() ? field.getSelected()[0] : '';
            } else if (constructorName.includes('PDFRadioGroup')) {
              type = 'radio';
              val = field.getSelected() || '';
            } else if (constructorName.includes('PDFButton')) {
              type = 'button';
            }

            // Get widget visual annotations to know coordinates & page
            const widgets = field.acroField.getWidgets();
            widgets.forEach((widget, wIdx) => {
              const rect = widget.getRectangle();
              const pRef = widget.P();
              let pageIndex = 0;

              if (pRef) {
                const pages = pdfDocLib.getPages();
                for (let i = 0; i < pages.length; i++) {
                  if (pages[i].ref === pRef) {
                    pageIndex = i;
                    break;
                  }
                }
              }

              formFieldsMap.set(`${name}_${wIdx}`, {
                name: name,
                field: field,
                widget: widget,
                type: type,
                pageIndex: pageIndex,
                pageNumber: pageIndex + 1,
                rect: rect,
                value: val,
                options: (type === 'dropdown') ? field.getOptions() : []
              });
            });
          });
        } catch (err) {
          console.warn('Form inspection warning:', err);
        }

        const count = formFieldsMap.size;
        fieldsCountBadge.textContent = `${count} fields`;
        noFieldsAlert.style.display = count === 0 ? 'block' : 'none';
        renderSidebarFieldsList();
      }

      function renderSidebarFieldsList() {
        fieldsListContainer.innerHTML = '';
        if (formFieldsMap.size === 0) return;

        formFieldsMap.forEach((item, key) => {
          const card = document.createElement('div');
          card.className = 'field-list-item';
          card.dataset.key = key;

          let displayVal = item.value;
          if (item.type === 'checkbox') displayVal = item.value ? 'Checked' : 'Unchecked';
          if (!displayVal) displayVal = '(empty)';

          card.innerHTML = `
            <div class="field-item-header">
              <span class="field-item-name" title="${item.name}">${item.name}</span>
              <span class="field-item-type">p.${item.pageNumber} • ${item.type}</span>
            </div>
            <div class="field-item-val" id="val_preview_${key}">${displayVal}</div>
          `;

          card.addEventListener('click', async () => {
            if (currentPage !== item.pageNumber) {
              await renderPage(item.pageNumber);
            }
            const inputEl = formFieldsLayer.querySelector(`[data-field-key="${key}"] input, [data-field-key="${key}"] textarea, [data-field-key="${key}"] select`);
            if (inputEl) {
              inputEl.focus();
              inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });

          fieldsListContainer.appendChild(card);
        });
      }

      async function renderPage(pageNum) {
        currentPage = pageNum;
        pageInfo.textContent = `Page ${pageNum} of ${totalPages}`;
        prevPageBtn.disabled = pageNum <= 1;
        nextPageBtn.disabled = pageNum >= totalPages;

        const page = await pdfJsDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.4 });
        currentScale = 1.4;

        pdfPageCanvas.width = viewport.width;
        pdfPageCanvas.height = viewport.height;

        const ctx = pdfPageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS
        }).promise;

        renderFieldWidgetsOnPage(pageNum, viewport);
      }

      function renderFieldWidgetsOnPage(pageNum, viewport) {
        formFieldsLayer.innerHTML = '';
        const pageIndex = pageNum - 1;
        const pageLib = pdfDocLib.getPages()[pageIndex];
        const { height: pdfH } = pageLib.getSize();

        formFieldsMap.forEach((item, key) => {
          if (item.pageIndex !== pageIndex) return;

          const rect = item.rect;
          if (!rect) return;

          // Convert PDF coordinates (origin bottom-left) to Viewport coordinates (origin top-left)
          const x = rect.x * currentScale;
          const y = (pdfH - rect.y - rect.height) * currentScale;
          const w = rect.width * currentScale;
          const h = rect.height * currentScale;

          const widget = document.createElement('div');
          widget.className = `pdf-field-widget ${item.type}-widget`;
          widget.dataset.fieldKey = key;
          widget.style.left = `${x}px`;
          widget.style.top = `${y}px`;
          widget.style.width = `${w}px`;
          widget.style.height = `${h}px`;

          if (item.type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item.value || '';
            input.placeholder = item.name;
            input.addEventListener('input', (e) => {
              item.value = e.target.value;
              updateFieldSync(item, key);
            });
            widget.appendChild(input);
          } else if (item.type === 'checkbox') {
            if (item.value === true) widget.classList.add('checked');
            widget.addEventListener('click', () => {
              item.value = !item.value;
              widget.classList.toggle('checked', item.value);
              updateFieldSync(item, key);
            });
          } else if (item.type === 'dropdown') {
            const select = document.createElement('select');
            (item.options || []).forEach(opt => {
              const optEl = document.createElement('option');
              optEl.value = opt;
              optEl.textContent = opt;
              if (opt === item.value) optEl.selected = true;
              select.appendChild(optEl);
            });
            select.addEventListener('change', (e) => {
              item.value = e.target.value;
              updateFieldSync(item, key);
            });
            widget.appendChild(select);
          }

          formFieldsLayer.appendChild(widget);
        });
      }

      function updateFieldSync(item, key) {
        // Sync into pdf-lib field instance
        try {
          if (item.type === 'text') {
            item.field.setText(item.value);
          } else if (item.type === 'checkbox') {
            if (item.value) item.field.check();
            else item.field.uncheck();
          } else if (item.type === 'dropdown') {
            item.field.select(item.value);
          }
        } catch (e) {}

        // Update sidebar preview
        const valPreview = document.getElementById(`val_preview_${key}`);
        if (valPreview) {
          let val = item.value;
          if (item.type === 'checkbox') val = item.value ? 'Checked' : 'Unchecked';
          valPreview.textContent = val || '(empty)';
        }
      }

      prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) renderPage(currentPage - 1);
      });

      nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) renderPage(currentPage + 1);
      });

      // Clear Form
      resetFormBtn.addEventListener('click', async () => {
        let confirmed = true;
        if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.confirm) {
          confirmed = await window.PDFTools.Modal.confirm('Are you sure you want to clear all form fields?', { isDanger: true });
        }
        if (!confirmed) return;
        formFieldsMap.forEach((item, key) => {
          if (item.type === 'text') item.value = '';
          else if (item.type === 'checkbox') item.value = false;
          updateFieldSync(item, key);
        });
        renderPage(currentPage);
        if (PDFTools.Toast) PDFTools.Toast.info('All form fields cleared.');
      });

      // Export Data as JSON
      exportDataBtn.addEventListener('click', () => {
        const exportObj = {};
        formFieldsMap.forEach((item) => {
          exportObj[item.name] = item.value;
        });
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const name = (pdfFile ? pdfFile.name.replace('.pdf', '') : 'form_data') + '_data.json';
        saveAs(blob, name);
        if (PDFTools.Toast) PDFTools.Toast.success('Form data exported to JSON.');
      });

      // Import Data from JSON
      importDataBtn.addEventListener('click', () => importDataInput.click());
      importDataInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            let matched = 0;
            formFieldsMap.forEach((item, key) => {
              if (data[item.name] !== undefined) {
                item.value = data[item.name];
                updateFieldSync(item, key);
                matched++;
              }
            });
            renderPage(currentPage);
            if (PDFTools.Toast) PDFTools.Toast.success(`Imported ${matched} field value(s)!`);
          } catch (err) {
            if (PDFTools.Toast) PDFTools.Toast.error('Invalid JSON form data file.');
          }
        };
        reader.readAsText(file);
      });

      // Download Filled PDF
      savePdfBtn.addEventListener('click', async () => {
        savePdfBtn.disabled = true;
        const savePdfText = document.getElementById('savePdfText');
        if (savePdfText) savePdfText.textContent = 'Saving PDF...';

        try {
          // Re-sync all values before saving
          formFieldsMap.forEach(item => {
            try {
              if (item.type === 'text') item.field.setText(item.value || '');
              else if (item.type === 'checkbox') {
                if (item.value) item.field.check();
                else item.field.uncheck();
              } else if (item.type === 'dropdown' && item.value) {
                item.field.select(item.value);
              }
            } catch (e) {}
          });

          // Flatten if requested
          if (flattenOutputCheck.checked) {
            try {
              const form = pdfDocLib.getForm();
              form.flatten();
            } catch (flatErr) {
              console.warn('Form flatten warning:', flatErr);
            }
          }

          const savedBytes = await pdfDocLib.save();
          const blob = new Blob([savedBytes], { type: 'application/pdf' });
          const outName = pdfFile.name.replace(/\.pdf$/i, '') + '_filled.pdf';

          saveAs(blob, outName);

          if (PDFTools.Toast) PDFTools.Toast.success(`Downloaded: ${outName}`);

          if (PDFTools.RecentFiles) {
            PDFTools.RecentFiles.add({
              name: pdfFile.name,
              tool: 'Fill PDF Forms',
              size: PDFTools.FileUtils.formatSize(savedBytes.length),
              icon: 'form'
            });
          }
        } catch (err) {
          console.error('Save PDF Form error:', err);
          if (PDFTools.Toast) PDFTools.Toast.error('Failed to save filled PDF: ' + err.message);
        } finally {
          savePdfBtn.disabled = false;
          if (savePdfText) savePdfText.textContent = 'Download Filled PDF';
        }
      });

      // Open in PDF Studio
      const openStudioBtn = document.getElementById('openStudioBtn');
      if (openStudioBtn) {
        openStudioBtn.addEventListener('click', async () => {
          if (!pdfDocLib || !pdfFile) return;
          openStudioBtn.disabled = true;
          try {
            formFieldsMap.forEach(item => {
              try {
                if (item.type === 'text') item.field.setText(item.value || '');
                else if (item.type === 'checkbox') {
                  if (item.value) item.field.check();
                  else item.field.uncheck();
                } else if (item.type === 'dropdown' && item.value) {
                  item.field.select(item.value);
                }
              } catch (e) {}
            });

            if (flattenOutputCheck.checked) {
              try {
                const form = pdfDocLib.getForm();
                form.flatten();
              } catch (flatErr) {
                console.warn('Form flatten warning:', flatErr);
              }
            }

            const savedBytes = await pdfDocLib.save();
            const blob = new Blob([savedBytes], { type: 'application/pdf' });
            const file = new File([blob], pdfFile.name.replace(/\.pdf$/i, '') + '_filled.pdf', { type: 'application/pdf' });
            if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
              PDFTools.FileUtils.setPendingFile(file);
            }
            window.location.href = 'viewer.html';
          } catch (err) {
            console.error('Open in Studio error:', err);
            if (PDFTools.Toast) PDFTools.Toast.error('Failed to prepare PDF for Studio: ' + err.message);
            openStudioBtn.disabled = false;
          }
        });
      }
    });
})();
