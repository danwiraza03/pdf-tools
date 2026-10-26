/**
 * PDF Tools — Unified Promise-based Modal Component
 * 100% Client-Side, Zero Server Transfer, Zero Emojis.
 * Replaces native window.alert(), window.confirm(), and window.prompt().
 */
(function () {
  'use strict';

  window.PDFTools = window.PDFTools || {};

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Standard inline SVGs (strictly adhering to PROJECT_RULES.md, 0 emoji)
  const ICONS = {
    help: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    danger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    prompt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    lock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  const Modal = {
    /**
     * Show a confirmation modal
     * @param {string} message - Message text
     * @param {object} [options] - Optional title, confirmText, cancelText, isDanger
     * @returns {Promise<boolean>}
     */
    confirm: function (message, options = {}) {
      return new Promise((resolve) => {
        const title = options.title || 'Confirmation';
        const confirmText = options.confirmText || 'Confirm';
        const cancelText = options.cancelText || 'Cancel';
        const isDanger = Boolean(options.isDanger || /delete|remove|clear|purge|invalidate/i.test(message));
        const iconType = isDanger ? 'danger' : 'confirm';
        const iconSvg = isDanger ? ICONS.danger : ICONS.help;

        const backdrop = document.createElement('div');
        backdrop.className = 'pdftools-modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        backdrop.innerHTML = `
          <div class="pdftools-modal-dialog">
            <div class="pdftools-modal-header">
              <div class="pdftools-modal-icon-wrap ${iconType}">
                ${iconSvg}
              </div>
              <div class="pdftools-modal-title">${escapeHtml(title)}</div>
              <button type="button" class="pdftools-modal-close" aria-label="Close">
                ${ICONS.close}
              </button>
            </div>
            <div class="pdftools-modal-body">
              <p class="pdftools-modal-message">${escapeHtml(message)}</p>
            </div>
            <div class="pdftools-modal-footer">
              <button type="button" class="pdftools-modal-cancel">${escapeHtml(cancelText)}</button>
              <button type="button" class="pdftools-modal-confirm ${isDanger ? 'danger' : ''}">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);
        // Force reflow for fade in
        void backdrop.offsetWidth;
        backdrop.classList.add('active');

        const confirmBtn = backdrop.querySelector('.pdftools-modal-confirm');
        const cancelBtn = backdrop.querySelector('.pdftools-modal-cancel');
        const closeBtn = backdrop.querySelector('.pdftools-modal-close');

        confirmBtn.focus();

        function cleanup(result) {
          document.removeEventListener('keydown', onKeyDown);
          backdrop.classList.remove('active');
          setTimeout(() => {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          }, 200);
          resolve(result);
        }

        function onKeyDown(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(false);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(true);
          }
        }

        document.addEventListener('keydown', onKeyDown);

        confirmBtn.addEventListener('click', () => cleanup(true));
        cancelBtn.addEventListener('click', () => cleanup(false));
        closeBtn.addEventListener('click', () => cleanup(false));

        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) cleanup(false);
        });
      });
    },

    /**
     * Show a prompt modal
     * @param {string} label - Input label or prompt question
     * @param {string} [defaultValue=''] - Initial value
     * @param {object} [options] - Optional title, confirmText, cancelText
     * @returns {Promise<string|null>}
     */
    prompt: function (label, defaultValue = '', options = {}) {
      return new Promise((resolve) => {
        const title = options.title || 'Enter Value';
        const confirmText = options.confirmText || 'OK';
        const cancelText = options.cancelText || 'Cancel';

        const backdrop = document.createElement('div');
        backdrop.className = 'pdftools-modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        backdrop.innerHTML = `
          <div class="pdftools-modal-dialog">
            <div class="pdftools-modal-header">
              <div class="pdftools-modal-icon-wrap prompt">
                ${ICONS.prompt}
              </div>
              <div class="pdftools-modal-title">${escapeHtml(title)}</div>
              <button type="button" class="pdftools-modal-close" aria-label="Close">
                ${ICONS.close}
              </button>
            </div>
            <div class="pdftools-modal-body">
              <p class="pdftools-modal-message">${escapeHtml(label)}</p>
              <input type="text" class="pdftools-modal-input" value="${escapeHtml(defaultValue)}" />
            </div>
            <div class="pdftools-modal-footer">
              <button type="button" class="pdftools-modal-cancel">${escapeHtml(cancelText)}</button>
              <button type="button" class="pdftools-modal-confirm">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);
        void backdrop.offsetWidth;
        backdrop.classList.add('active');

        const inputEl = backdrop.querySelector('.pdftools-modal-input');
        const confirmBtn = backdrop.querySelector('.pdftools-modal-confirm');
        const cancelBtn = backdrop.querySelector('.pdftools-modal-cancel');
        const closeBtn = backdrop.querySelector('.pdftools-modal-close');

        inputEl.focus();
        inputEl.select();

        function cleanup(result) {
          document.removeEventListener('keydown', onKeyDown);
          backdrop.classList.remove('active');
          setTimeout(() => {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          }, 200);
          resolve(result);
        }

        function onKeyDown(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(null);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(inputEl.value);
          }
        }

        document.addEventListener('keydown', onKeyDown);

        confirmBtn.addEventListener('click', () => cleanup(inputEl.value));
        cancelBtn.addEventListener('click', () => cleanup(null));
        closeBtn.addEventListener('click', () => cleanup(null));

        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) cleanup(null);
        });
      });
    },

    /**
     * Show an alert modal
     * @param {string} message - Message text
     * @param {object} [options] - Optional title, buttonText
     * @returns {Promise<void>}
     */
    alert: function (message, options = {}) {
      return new Promise((resolve) => {
        const title = options.title || 'Notice';
        const buttonText = options.buttonText || 'OK';

        const backdrop = document.createElement('div');
        backdrop.className = 'pdftools-modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        backdrop.innerHTML = `
          <div class="pdftools-modal-dialog">
            <div class="pdftools-modal-header">
              <div class="pdftools-modal-icon-wrap info">
                ${ICONS.info}
              </div>
              <div class="pdftools-modal-title">${escapeHtml(title)}</div>
              <button type="button" class="pdftools-modal-close" aria-label="Close">
                ${ICONS.close}
              </button>
            </div>
            <div class="pdftools-modal-body">
              <p class="pdftools-modal-message">${escapeHtml(message)}</p>
            </div>
            <div class="pdftools-modal-footer">
              <button type="button" class="pdftools-modal-confirm">${escapeHtml(buttonText)}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);
        void backdrop.offsetWidth;
        backdrop.classList.add('active');

        const confirmBtn = backdrop.querySelector('.pdftools-modal-confirm');
        const closeBtn = backdrop.querySelector('.pdftools-modal-close');

        confirmBtn.focus();

        function cleanup() {
          document.removeEventListener('keydown', onKeyDown);
          backdrop.classList.remove('active');
          setTimeout(() => {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          }, 200);
          resolve();
        }

        function onKeyDown(e) {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            cleanup();
          }
        }

        document.addEventListener('keydown', onKeyDown);

        confirmBtn.addEventListener('click', () => cleanup());
        closeBtn.addEventListener('click', () => cleanup());

        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) cleanup();
        });
      });
    },

    /**
     * Request password modal for protected PDF documents
     * @param {string} fileName - Document name
     * @param {number} [attempt=1] - 1-based attempt counter
     * @param {object} [options] - Optional custom titles or texts
     * @returns {Promise<string|null>}
     */
    requestPassword: function (fileName, attempt = 1, options = {}) {
      return new Promise((resolve) => {
        const i18n = (window.PDFTools && window.PDFTools.i18n) ? window.PDFTools.i18n : null;
        const t = (key, fallback) => i18n ? i18n.t(key, fallback) : fallback;

        const title = options.title || t('modal.password_title', 'Dokumen PDF Dilindungi');
        const defaultMsg = t('modal.password_message', 'Masukkan kata sandi untuk membuka "{filename}":')
          .replace('{filename}', fileName);
        const incorrectMsg = t('modal.password_incorrect', 'Password salah, silakan coba lagi (Percobaan {attempt} dari {max}).')
          .replace('{attempt}', attempt)
          .replace('{max}', 3);

        const openText = options.openText || t('modal.password_unlock', 'Buka');
        const skipText = options.skipText || t('modal.password_skip', 'Lewati');
        const placeholder = t('modal.password_placeholder', 'Masukkan kata sandi dokumen');

        const backdrop = document.createElement('div');
        backdrop.className = 'pdftools-modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        backdrop.innerHTML = `
          <div class="pdftools-modal-dialog">
            <div class="pdftools-modal-header">
              <div class="pdftools-modal-icon-wrap" style="color: var(--tool-color, #ef4444); background: rgba(239, 68, 68, 0.1);">
                ${ICONS.lock}
              </div>
              <div class="pdftools-modal-title">${escapeHtml(title)}</div>
              <button type="button" class="pdftools-modal-close" aria-label="Close">
                ${ICONS.close}
              </button>
            </div>
            <div class="pdftools-modal-body">
              <p class="pdftools-modal-message" style="margin-bottom: 8px;">${escapeHtml(defaultMsg)}</p>
              ${attempt > 1 ? `<p class="pdftools-modal-error" style="color: #ef4444; font-size: 0.875rem; margin-bottom: 12px; font-weight: 500;">${escapeHtml(incorrectMsg)}</p>` : ''}
              <input type="password" class="pdftools-modal-input" placeholder="${escapeHtml(placeholder)}" style="min-height: 44px; width: 100%; box-sizing: border-box; font-size: 1rem; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border, #cbd5e1);" />
            </div>
            <div class="pdftools-modal-footer">
              <button type="button" class="pdftools-modal-cancel" style="min-height: 44px; min-width: 80px; padding: 0 16px;">${escapeHtml(skipText)}</button>
              <button type="button" class="pdftools-modal-confirm" style="min-height: 44px; min-width: 80px; padding: 0 16px;">${escapeHtml(openText)}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);
        void backdrop.offsetWidth;
        backdrop.classList.add('active');

        const inputEl = backdrop.querySelector('.pdftools-modal-input');
        const confirmBtn = backdrop.querySelector('.pdftools-modal-confirm');
        const cancelBtn = backdrop.querySelector('.pdftools-modal-cancel');
        const closeBtn = backdrop.querySelector('.pdftools-modal-close');

        inputEl.focus();

        function cleanup(result) {
          document.removeEventListener('keydown', onKeyDown);
          backdrop.classList.remove('active');
          setTimeout(() => {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          }, 200);
          resolve(result);
        }

        function onKeyDown(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(null);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(inputEl.value);
          }
        }

        document.addEventListener('keydown', onKeyDown);

        confirmBtn.addEventListener('click', () => cleanup(inputEl.value));
        cancelBtn.addEventListener('click', () => cleanup(null));
        closeBtn.addEventListener('click', () => cleanup(null));

        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) cleanup(null);
        });
      });
    }
  };

  window.PDFTools.Modal = Modal;
})();
