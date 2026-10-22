/**
 * PDF Tools — Download Utility
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Download = {
  /**
   * Download Uint8Array as file
   */
  save: function (data, filename) {
    var blob;
    if (data instanceof Blob) {
      blob = data;
    } else {
      blob = new Blob([data], { type: 'application/pdf' });
    }
    // Use FileSaver.js if available, otherwise manual
    if (typeof saveAs === 'function') {
      saveAs(blob, filename);
    } else {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }
  },

  /**
   * Download multiple files as ZIP
   */
  saveAsZip: function (files, zipName) {
    if (typeof JSZip === 'undefined') {
      console.error('JSZip not loaded');
      return Promise.reject(new Error('JSZip not loaded'));
    }
    var zip = new JSZip();
    files.forEach(function (f) {
      zip.file(f.name, f.data);
    });
    return zip.generateAsync({ type: 'blob' }).then(function (blob) {
      PDFTools.Download.save(blob, zipName);
    });
  }
};
