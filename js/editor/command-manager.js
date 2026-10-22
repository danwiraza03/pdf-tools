/**
 * Command Manager & History Pattern
 * Provides robust multi-level Undo/Redo architecture with history cap of 100 states.
 */

class Command {
  constructor(name = 'Action') {
    this.name = name;
    this.timestamp = Date.now();
  }
  execute() {}
  undo() {}
  redo() {
    this.execute();
  }
}

class CommandManager {
  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
  }

  addListener(fn) {
    this.listeners.push(fn);
  }

  notify() {
    const state = {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastCommand: this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].name : null
    };
    this.listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.error('Listener error:', e); }
    });
  }

  execute(command) {
    if (!command) return;
    try {
      command.execute();
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = []; // Clear redo stack on new action
      this.notify();
    } catch (err) {
      console.error('Command execute error:', err);
    }
  }

  undo() {
    if (!this.canUndo()) return null;
    const cmd = this.undoStack.pop();
    try {
      cmd.undo();
      this.redoStack.push(cmd);
      this.notify();
      return cmd;
    } catch (err) {
      console.error('Command undo error:', err);
      return null;
    }
  }

  redo() {
    if (!this.canRedo()) return null;
    const cmd = this.redoStack.pop();
    try {
      cmd.redo();
      this.undoStack.push(cmd);
      this.notify();
      return cmd;
    } catch (err) {
      console.error('Command redo error:', err);
      return null;
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

// ── Specific Command Implementations ──────────────────────────────────────────

class AddTextCommand extends Command {
  constructor(doc, pageNum, textItem, refreshFn) {
    super('Add Text');
    this.doc = doc;
    this.pageNum = pageNum;
    this.textItem = { ...textItem };
    this.refreshFn = refreshFn;
  }

  execute() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.texts.some(t => t.id === this.textItem.id)) {
      pageAnn.texts.push(this.textItem);
    }
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    pageAnn.texts = pageAnn.texts.filter(t => t.id !== this.textItem.id);
    if (this.refreshFn) this.refreshFn();
  }
}

class DeleteTextCommand extends Command {
  constructor(doc, pageNum, textItem, refreshFn) {
    super('Delete Text');
    this.doc = doc;
    this.pageNum = pageNum;
    this.textItem = { ...textItem };
    this.refreshFn = refreshFn;
  }

  execute() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    pageAnn.texts = pageAnn.texts.filter(t => t.id !== this.textItem.id);
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.texts.some(t => t.id === this.textItem.id)) {
      pageAnn.texts.push(this.textItem);
    }
    if (this.refreshFn) this.refreshFn();
  }
}

class EditTextCommand extends Command {
  constructor(doc, pageNum, editRecord, oldRecord, refreshFn) {
    super('Edit Text');
    this.doc = doc;
    this.pageNum = pageNum;
    this.editRecord = { ...editRecord };
    this.oldRecord = oldRecord ? { ...oldRecord } : null;
    this.refreshFn = refreshFn;
  }

  execute() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.edits) pageAnn.edits = [];
    const idx = pageAnn.edits.findIndex(e => e.id === this.editRecord.id);
    if (idx !== -1) {
      pageAnn.edits[idx] = { ...this.editRecord };
    } else {
      pageAnn.edits.push({ ...this.editRecord });
    }
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.edits) return;
    if (this.oldRecord) {
      const idx = pageAnn.edits.findIndex(e => e.id === this.editRecord.id);
      if (idx !== -1) pageAnn.edits[idx] = { ...this.oldRecord };
    } else {
      pageAnn.edits = pageAnn.edits.filter(e => e.id !== this.editRecord.id);
    }
    if (this.refreshFn) this.refreshFn();
  }
}

class AddImageCommand extends Command {
  constructor(doc, pageNum, stampItem, refreshFn) {
    super('Add Image');
    this.doc = doc;
    this.pageNum = pageNum;
    this.stampItem = { ...stampItem };
    this.refreshFn = refreshFn;
  }

  execute() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.stamps.some(s => s.id === this.stampItem.id)) {
      pageAnn.stamps.push(this.stampItem);
    }
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    pageAnn.stamps = pageAnn.stamps.filter(s => s.id !== this.stampItem.id);
    if (this.refreshFn) this.refreshFn();
  }
}

class DeleteImageCommand extends Command {
  constructor(doc, pageNum, stampItem, refreshFn) {
    super('Delete Image');
    this.doc = doc;
    this.pageNum = pageNum;
    this.stampItem = { ...stampItem };
    this.refreshFn = refreshFn;
  }

  execute() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    pageAnn.stamps = pageAnn.stamps.filter(s => s.id !== this.stampItem.id);
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.stamps.some(s => s.id === this.stampItem.id)) {
      pageAnn.stamps.push(this.stampItem);
    }
    if (this.refreshFn) this.refreshFn();
  }
}

class AddShapeCommand extends Command {
  constructor(doc, pageNum, shapeItem, refreshFn) {
    super('Add Shape');
    this.doc = doc;
    this.pageNum = pageNum;
    this.shapeItem = { ...shapeItem };
    this.refreshFn = refreshFn;
  }

  execute() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (!pageAnn.shapes) pageAnn.shapes = [];
    pageAnn.shapes.push(this.shapeItem);
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    const pageAnn = this.doc.getPageAnnotation(this.pageNum);
    if (pageAnn.shapes) {
      pageAnn.shapes = pageAnn.shapes.filter(s => s !== this.shapeItem && s.id !== this.shapeItem.id);
    }
    if (this.refreshFn) this.refreshFn();
  }
}

class RotatePageCommand extends Command {
  constructor(doc, pageNum, deltaDeg, refreshFn) {
    super(`Rotate Page ${deltaDeg}°`);
    this.doc = doc;
    this.pageNum = pageNum;
    this.deltaDeg = deltaDeg;
    this.refreshFn = refreshFn;
  }

  execute() {
    this.doc.pageRotations[this.pageNum] = ((this.doc.pageRotations[this.pageNum] || 0) + this.deltaDeg + 360) % 360;
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    this.doc.pageRotations[this.pageNum] = ((this.doc.pageRotations[this.pageNum] || 0) - this.deltaDeg + 360) % 360;
    if (this.refreshFn) this.refreshFn();
  }
}

class DeletePageCommand extends Command {
  constructor(doc, pageNum, refreshFn) {
    super(`Delete Page ${pageNum}`);
    this.doc = doc;
    this.pageNum = pageNum;
    this.refreshFn = refreshFn;
  }

  execute() {
    this.doc.deletedPages.add(this.pageNum);
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    this.doc.deletedPages.delete(this.pageNum);
    if (this.refreshFn) this.refreshFn();
  }
}

class ReorderPageCommand extends Command {
  constructor(doc, oldOrder, newOrder, refreshFn) {
    super('Reorder Pages');
    this.doc = doc;
    this.oldOrder = [...oldOrder];
    this.newOrder = [...newOrder];
    this.refreshFn = refreshFn;
  }

  execute() {
    this.doc.pageOrder = [...this.newOrder];
    if (this.refreshFn) this.refreshFn();
  }

  undo() {
    this.doc.pageOrder = [...this.oldOrder];
    if (this.refreshFn) this.refreshFn();
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.Command = Command;
window.PDFTools.CommandManager = CommandManager;
window.PDFTools.Commands = {
  AddTextCommand,
  DeleteTextCommand,
  EditTextCommand,
  AddImageCommand,
  DeleteImageCommand,
  AddShapeCommand,
  RotatePageCommand,
  DeletePageCommand,
  ReorderPageCommand
};
