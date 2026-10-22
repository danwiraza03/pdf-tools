/**
 * Comments Engine
 * Manages PDF sticky note markers, threaded replies, author timestamps, and resolution states.
 */

class CommentsEngine {
  /**
   * Add a new root comment with sticky note marker
   */
  static addComment(doc, pageNum, x, y, text, author = 'Reviewer', color = '#F59E0B') {
    const pageAnn = doc.getPageAnnotation(pageNum);
    if (!pageAnn.comments) pageAnn.comments = [];

    const newComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      pageNum: pageNum,
      x: x,
      y: y,
      author: author,
      text: text,
      color: color,
      timestamp: new Date().toLocaleString(),
      resolved: false,
      replies: []
    };

    pageAnn.comments.push(newComment);
    return newComment;
  }

  /**
   * Add reply to an existing comment
   */
  static addReply(doc, commentId, text, author = 'Reviewer') {
    const comment = CommentsEngine.findComment(doc, commentId);
    if (!comment) return null;

    const reply = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      author: author,
      text: text,
      timestamp: new Date().toLocaleString()
    };

    if (!comment.replies) comment.replies = [];
    comment.replies.push(reply);
    return reply;
  }

  /**
   * Toggle resolved state
   */
  static toggleResolved(doc, commentId) {
    const comment = CommentsEngine.findComment(doc, commentId);
    if (!comment) return false;
    comment.resolved = !comment.resolved;
    return comment.resolved;
  }

  /**
   * Delete comment
   */
  static deleteComment(doc, commentId) {
    const pages = doc.getActivePagesList();
    for (const pageNum of pages) {
      const pageAnn = doc.getPageAnnotation(pageNum);
      if (pageAnn.comments) {
        const idx = pageAnn.comments.findIndex(c => c.id === commentId);
        if (idx !== -1) {
          pageAnn.comments.splice(idx, 1);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find comment by ID across all pages
   */
  static findComment(doc, commentId) {
    const pages = doc.getActivePagesList();
    for (const pageNum of pages) {
      const pageAnn = doc.getPageAnnotation(pageNum);
      if (pageAnn.comments) {
        const found = pageAnn.comments.find(c => c.id === commentId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get all comments across all document pages
   */
  static getAllComments(doc) {
    if (!doc) return [];
    const all = [];
    const pages = doc.getActivePagesList();
    for (const pageNum of pages) {
      const pageAnn = doc.getPageAnnotation(pageNum);
      if (pageAnn.comments && pageAnn.comments.length > 0) {
        pageAnn.comments.forEach(c => all.push({ ...c, pageNum }));
      }
    }
    return all;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.CommentsEngine = CommentsEngine;
