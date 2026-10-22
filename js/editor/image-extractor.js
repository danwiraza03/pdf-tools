/**
 * Image Extractor
 * Inspects PDF operator stream and extracts XObject image locations, dimensions, and transformations.
 */

class ImageExtractor {
  /**
   * Extract image positions and bounding boxes from a PDF.js page
   * @param {Object} page PDF.js page object
   * @param {number} pageNumber
   * @returns {Promise<Array<Object>>} List of detected image objects
   */
  static async extractPageImages(page, pageNumber) {
    const images = [];
    try {
      const ops = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1.0 });

      // Transform matrix stack
      const matrixStack = [[1, 0, 0, 1, 0, 0]];
      let currentMatrix = [1, 0, 0, 1, 0, 0];

      const OPS = (typeof pdfjsLib !== 'undefined' && pdfjsLib.OPS) ? pdfjsLib.OPS : {
        save: 10,
        restore: 11,
        transform: 12,
        paintImageXObject: 85,
        paintInlineImageXObject: 86,
        paintImageMaskXObject: 87
      };

      const multiplyMatrix = (m1, m2) => {
        return [
          m1[0] * m2[0] + m1[2] * m2[1],
          m1[1] * m2[0] + m1[3] * m2[1],
          m1[0] * m2[2] + m1[2] * m2[3],
          m1[1] * m2[2] + m1[3] * m2[3],
          m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
          m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
        ];
      };

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];

        if (fn === OPS.save) {
          matrixStack.push([...currentMatrix]);
        } else if (fn === OPS.restore) {
          if (matrixStack.length > 1) {
            currentMatrix = matrixStack.pop();
          }
        } else if (fn === OPS.transform) {
          currentMatrix = multiplyMatrix(currentMatrix, args);
        } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
          const imgName = args ? args[0] : `img_${i}`;

          // CTM maps unit square [0,0,1,1] to PDF coordinates
          const width = Math.max(10, Math.hypot(currentMatrix[0], currentMatrix[1]));
          const height = Math.max(10, Math.hypot(currentMatrix[2], currentMatrix[3]));
          const x = currentMatrix[4];
          const y = currentMatrix[5];
          const rotation = Math.atan2(currentMatrix[1], currentMatrix[0]);

          // Screen top-left coordinates at scale 1.0
          const screenY = viewport.height - y - height;

          // Filter out tiny 1x1 image artifacts or zero-size fills
          if (width >= 8 && height >= 8) {
            images.push({
              id: `img_${pageNumber}_${i}_${Math.round(x)}_${Math.round(y)}`,
              name: imgName,
              pageNumber: pageNumber,
              x: x,
              y: screenY,
              width: width,
              height: height,
              rotation: rotation,
              matrix: [...currentMatrix],
              opIndex: i
            });
          }
        }
      }
    } catch (err) {
      console.warn('Image extraction warning for page', pageNumber, err);
    }

    return images;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.ImageExtractor = ImageExtractor;
