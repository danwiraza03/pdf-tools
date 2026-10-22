function generateSafeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch (e) {}
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

class TextRun {
  constructor(data) {
    this.id = data.id || generateSafeId();
    this.pageNumber = data.pageNumber;
    this.text = data.text || '';
    
    this.bbox = {
      x: data.bbox?.x || 0,
      y: data.bbox?.y || 0,
      width: data.bbox?.width || 0,
      height: data.bbox?.height || 0
    };
    
    this.matrix = data.matrix || [1, 0, 0, 1, 0, 0];
    this.baseline = data.baseline || 0;
    
    this.font = {
      pdfFontName: data.font?.pdfFontName || '',
      family: data.font?.family || 'Helvetica',
      baseFamily: data.font?.baseFamily || 'Helvetica',
      postScriptName: data.font?.postScriptName || '',
      size: data.font?.size || 12,
      weight: data.font?.weight || 'normal',
      italic: data.font?.italic || false,
      subset: data.font?.subset || false,
      embedded: data.font?.embedded || false
    };
    
    this.color = data.color || '#000000';
    this.opacity = data.opacity !== undefined ? data.opacity : 1;
    
    this.charSpacing = data.charSpacing || 0;
    this.wordSpacing = data.wordSpacing || 0;
    this.horizontalScale = data.horizontalScale || 100;
    this.lineHeight = data.lineHeight || 1.2;
    
    this.rotation = data.rotation || 0;
    this.sourceOperatorIndexes = data.sourceOperatorIndexes || [];
  }
}

class TextLine {
  constructor() {
    this.id = generateSafeId();
    this.runs = [];
    this.bbox = { x: 0, y: 0, width: 0, height: 0 };
    this.text = '';
  }
  
  addRun(run) {
    if (this.runs.length === 0 && run && run.id) {
      this.id = 'line_' + run.id;
    }
    this.runs.push(run);
    this.text += run.text;
  }
}

class TextParagraph {
  constructor() {
    this.id = generateSafeId();
    this.lines = [];
    this.bbox = { x: 0, y: 0, width: 0, height: 0 };
  }
  
  addLine(line) {
    this.lines.push(line);
  }
}

class TextBlock {
  constructor() {
    this.id = generateSafeId();
    this.paragraphs = [];
    this.bbox = { x: 0, y: 0, width: 0, height: 0 };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.TextModel = { TextRun, TextLine, TextParagraph, TextBlock };
