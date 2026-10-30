/**
 * PDF Tools — Toast Notification Component
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Toast = (function () {
  var container = null;

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.setAttribute('role', 'status');
      document.body.appendChild(container);
    }
  }

  function show(message, type, duration, action) {
    type = type || 'info';
    duration = duration === undefined ? 3000 : duration;
    ensureContainer();

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    var icons = {
      success: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warning: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    var iconSpan = '<span style="display:inline-flex;align-items:center;margin-right:6px;">' + (icons[type] || '') + '</span> ';
    var msgSpan = '<span class="toast-message">' + message + '</span>';
    toast.innerHTML = iconSpan + msgSpan;

    if (action && action.text && typeof action.onClick === 'function') {
      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'btn btn-sm btn-primary toast-action-btn';
      actionBtn.style.marginLeft = '12px';
      actionBtn.style.padding = '4px 10px';
      actionBtn.style.fontSize = '12px';
      actionBtn.textContent = action.text;
      actionBtn.addEventListener('click', function (e) {
        e.preventDefault();
        dismiss();
        action.onClick();
      });
      toast.appendChild(actionBtn);
    }

    container.appendChild(toast);

    var dismissTimer = null;
    function dismiss() {
      if (dismissTimer) clearTimeout(dismissTimer);
      toast.classList.add('toast-out');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }

    if (duration > 0) {
      dismissTimer = setTimeout(dismiss, duration);
    }
  }

  return {
    success: function (msg, dur) { show(msg, 'success', dur); },
    error: function (msg, dur) { show(msg, 'error', dur); },
    warning: function (msg, dur) { show(msg, 'warning', dur); },
    info: function (msg, dur) { show(msg, 'info', dur); },
    action: function (msg, actionText, onAction, dur) {
      show(msg, 'info', dur !== undefined ? dur : 0, { text: actionText, onClick: onAction });
    }
  };
})();
