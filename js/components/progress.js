/**
 * PDF Tools — Progress Controller Component
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Progress = function (containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const fill = container.querySelector('.progress-bar-fill');
  const text = container.querySelector('.progress-text');

  return {
    show: function (initialText) {
      container.classList.add('active');
      if (fill) fill.style.width = '0%';
      if (text && initialText) text.textContent = initialText;
    },
    update: function (percent, statusText) {
      if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      if (text && statusText) text.textContent = statusText;
    },
    hide: function () {
      container.classList.remove('active');
      if (fill) fill.style.width = '0%';
    }
  };
};
