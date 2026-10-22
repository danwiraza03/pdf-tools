/**
 * PDF Tools — JPG to PDF Core Logic
 */
window.PDFTools = window.PDFTools || {};

PDFTools.JpgToPdf = {
  /**
   * Convert multiple image files into a single PDF
   * @param {File[]} imageFiles
   * @param {Object} options - { pageSize: 'A4'|'Letter'|'fit', orientation: 'portrait'|'landscape', margin: 'none'|'small'|'normal' }
   * @param {Function} onProgress
   */
  convert: async function (imageFiles, options, onProgress) {
    options = options || {};
    const pageSize = options.pageSize || 'A4';
    const orientation = options.orientation || 'portrait';
    const marginType = options.margin || 'none';

    const { PDFDocument, PageSizes } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    // Standard points for margin
    const margins = {
      none: 0,
      small: 18,
      normal: 36
    };
    const margin = margins[marginType] || 0;

    const totalImages = imageFiles.length;

    for (let i = 0; i < totalImages; i++) {
      const file = imageFiles[i];
      if (typeof onProgress === 'function') {
        onProgress(Math.round(((i) / totalImages) * 90), `Processing image ${i + 1} of ${totalImages}...`);
      }

      const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
      let embeddedImage;

      const ext = PDFTools.FileUtils.getExtension(file.name);
      if (ext === 'png') {
        embeddedImage = await pdfDoc.embedPng(arrayBuffer);
      } else {
        embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      let pageWidth, pageHeight;

      if (pageSize === 'fit') {
        pageWidth = imgWidth + (margin * 2);
        pageHeight = imgHeight + (margin * 2);
      } else {
        const stdSize = PageSizes[pageSize] || PageSizes.A4;
        if (orientation === 'landscape') {
          pageWidth = stdSize[1];
          pageHeight = stdSize[0];
        } else {
          pageWidth = stdSize[0];
          pageHeight = stdSize[1];
        }
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Calculate scale to fit inside page minus margins
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);

      const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      const x = margin + ((availableWidth - scaledWidth) / 2);
      const y = margin + ((availableHeight - scaledHeight) / 2);

      page.drawImage(embeddedImage, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight
      });
    }

    if (typeof onProgress === 'function') {
      onProgress(95, 'Generating PDF file...');
    }

    const pdfBytes = await pdfDoc.save();

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return pdfBytes;
  }
};
