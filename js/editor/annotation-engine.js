/**
 * Annotation Engine
 * Manages native PDF annotation structures (Highlight, Underline, StrikeOut, FreeText, Ink, Square, Circle, Line, Sticky Note, Stamp)
 * and explicit annotation flattening.
 */

class AnnotationEngine {
  /**
   * Create a standard annotation object
   */
  static createAnnotation(type, data = {}) {
    const base = {
      id: data.id || `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: type, // 'highlight'|'underline'|'strikeout'|'freetext'|'ink'|'square'|'circle'|'line'|'note'|'stamp'
      pageNumber: data.pageNumber || 1,
      rect: data.rect || { x: 0, y: 0, width: 100, height: 20 },
      color: data.color || '#FACC15',
      opacity: data.opacity !== undefined ? data.opacity : 1.0,
      author: data.author || 'User',
      contents: data.contents || '',
      creationDate: data.creationDate || new Date().toISOString(),
      modificationDate: new Date().toISOString(),
      flags: data.flags || 4 // Standard Print flag
    };

    switch (type) {
      case 'highlight':
      case 'underline':
      case 'strikeout':
        base.quadPoints = data.quadPoints || [];
        base.opacity = data.opacity !== undefined ? data.opacity : (type === 'highlight' ? 0.45 : 1.0);
        break;
      case 'ink':
        base.points = data.points || [];
        base.strokeWidth = data.strokeWidth || 3;
        break;
      case 'square':
      case 'circle':
        base.fillColor = data.fillColor || 'transparent';
        base.strokeWidth = data.strokeWidth || 2;
        break;
      case 'line':
        base.x2 = data.x2 || base.rect.x + base.rect.width;
        base.y2 = data.y2 || base.rect.y + base.rect.height;
        base.strokeWidth = data.strokeWidth || 2;
        break;
      case 'note':
        base.icon = data.icon || 'Comment';
        base.rect = { x: data.x || 50, y: data.y || 50, width: 24, height: 24 };
        break;
      case 'freetext':
        base.text = data.text || '';
        base.fontSize = data.fontSize || 14;
        base.fontFamily = data.fontFamily || 'Helvetica';
        break;
    }

    return base;
  }

  /**
   * Explicitly Flatten Annotations into permanent visual layers
   * @param {Object} pageAnn Page annotation data
   */
  static flattenAnnotations(pageAnn) {
    if (!pageAnn) return;

    // Convert notes into text stamps or permanent badges
    if (pageAnn.notes && pageAnn.notes.length > 0) {
      pageAnn.notes.forEach(note => {
        if (!pageAnn.texts) pageAnn.texts = [];
        pageAnn.texts.push({
          id: `flat_note_${note.id}`,
          x: note.x,
          y: note.y,
          text: `[Note: ${note.author}] ${note.text}`,
          fontSize: 10,
          fontFamily: 'Helvetica',
          color: '#1F2937'
        });
      });
      pageAnn.notes = [];
    }

    return pageAnn;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.AnnotationEngine = AnnotationEngine;
