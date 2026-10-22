/**
 * Image Edit Engine
 * Manages selecting, moving, resizing, rotating, replacing, deleting, and reordering image objects.
 */

class ImageEditEngine {
  /**
   * Apply an image edit operation to page annotations
   * @param {Object} pageAnn
   * @param {Object} imageObj Original image object or stamp
   * @param {Object} changes Delta changes { x, y, width, height, rotation, opacity, dataUrl, deleted }
   */
  static applyImageEdit(pageAnn, imageObj, changes = {}) {
    if (!pageAnn.stamps) pageAnn.stamps = [];
    if (!pageAnn.imageEdits) pageAnn.imageEdits = [];

    // If it's a user-added stamp
    const stampIdx = pageAnn.stamps.findIndex(s => s.id === imageObj.id);
    if (stampIdx !== -1) {
      if (changes.deleted) {
        pageAnn.stamps.splice(stampIdx, 1);
        return null;
      }
      Object.assign(pageAnn.stamps[stampIdx], changes);
      return pageAnn.stamps[stampIdx];
    }

    // If it's an existing PDF image XObject
    const editIdx = pageAnn.imageEdits.findIndex(e => e.id === imageObj.id);
    if (changes.deleted) {
      const delRecord = {
        id: imageObj.id,
        original: { ...imageObj },
        deleted: true,
        x: imageObj.x,
        y: imageObj.y,
        width: imageObj.width,
        height: imageObj.height
      };
      if (editIdx !== -1) {
        pageAnn.imageEdits[editIdx] = delRecord;
      } else {
        pageAnn.imageEdits.push(delRecord);
      }
      return delRecord;
    }

    const editRecord = {
      id: imageObj.id,
      original: { ...imageObj },
      x: changes.x !== undefined ? changes.x : imageObj.x,
      y: changes.y !== undefined ? changes.y : imageObj.y,
      width: changes.width !== undefined ? changes.width : imageObj.width,
      height: changes.height !== undefined ? changes.height : imageObj.height,
      rotation: changes.rotation !== undefined ? changes.rotation : (imageObj.rotation || 0),
      opacity: changes.opacity !== undefined ? changes.opacity : (imageObj.opacity !== undefined ? imageObj.opacity : 1.0),
      dataUrl: changes.dataUrl || imageObj.dataUrl || null,
      deleted: false
    };

    if (editIdx !== -1) {
      pageAnn.imageEdits[editIdx] = Object.assign(pageAnn.imageEdits[editIdx], editRecord);
    } else {
      pageAnn.imageEdits.push(editRecord);
    }

    return editRecord;
  }

  /**
   * Adjust Z-Index / layer ordering
   */
  static reorderImage(pageAnn, imageId, direction = 'forward') {
    if (!pageAnn.stamps) return;
    const idx = pageAnn.stamps.findIndex(s => s.id === imageId);
    if (idx === -1) return;

    const item = pageAnn.stamps.splice(idx, 1)[0];
    if (direction === 'forward') {
      pageAnn.stamps.splice(Math.min(pageAnn.stamps.length, idx + 1), 0, item);
    } else if (direction === 'backward') {
      pageAnn.stamps.splice(Math.max(0, idx - 1), 0, item);
    } else if (direction === 'front') {
      pageAnn.stamps.push(item);
    } else if (direction === 'back') {
      pageAnn.stamps.unshift(item);
    }
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.ImageEditEngine = ImageEditEngine;
