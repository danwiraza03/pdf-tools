/**
 * Compare Documents Engine
 * Compares text and visual differences between two PDF documents.
 */

class CompareEngine {
  /**
   * Compare text between two documents across matching pages
   * @param {Object} docA First document StudioDoc
   * @param {Object} docB Second document StudioDoc
   */
  static async compareDocuments(docA, docB) {
    if (!docA || !docB) return { error: 'Both documents are required for comparison.' };

    const pagesA = docA.getActivePagesList();
    const pagesB = docB.getActivePagesList();
    const totalPages = Math.max(pagesA.length, pagesB.length);

    const differences = [];

    for (let i = 0; i < totalPages; i++) {
      const pageNumA = pagesA[i];
      const pageNumB = pagesB[i];

      let textA = '';
      let textB = '';

      if (pageNumA) {
        try {
          const page = await docA.pdfJsDoc.getPage(pageNumA);
          const tc = await page.getTextContent();
          textA = tc.items.map(item => item.str || '').join(' ').trim();
        } catch (e) {}
      }

      if (pageNumB) {
        try {
          const page = await docB.pdfJsDoc.getPage(pageNumB);
          const tc = await page.getTextContent();
          textB = tc.items.map(item => item.str || '').join(' ').trim();
        } catch (e) {}
      }

      const isIdentical = textA === textB;
      differences.push({
        pageIndex: i + 1,
        pageA: pageNumA,
        pageB: pageNumB,
        identical: isIdentical,
        textA: textA,
        textB: textB,
        hasChanges: !isIdentical
      });
    }

    const totalDiffs = differences.filter(d => d.hasChanges).length;
    return {
      docAName: docA.fileName,
      docBName: docB.fileName,
      totalPages: totalPages,
      totalDifferences: totalDiffs,
      pageDiffs: differences
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.CompareEngine = CompareEngine;
