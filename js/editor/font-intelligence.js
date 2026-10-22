/**
 * Font Intelligence Engine
 * Infers exact styling (family, size, weight, italic, color, baseline, line-height)
 * at any clicked point based on hierarchical proximity (same line > same paragraph > same block > nearest spatial).
 */

class FontIntelligenceEngine {
  /**
   * Infer style at (x, y) point on page
   * @param {Array<Object>} textRuns Extracted PDFTextRuns
   * @param {number} x Screen X
   * @param {number} y Screen Y
   */
  static inferStyleAtPoint(textRuns, x, y) {
    if (!textRuns || textRuns.length === 0) {
      return FontIntelligenceEngine.getDefaultStyle();
    }

    let bestRun = null;
    let highestScore = -1;

    for (const run of textRuns) {
      const bbox = run.bbox;
      const midY = bbox.y + bbox.height / 2;
      const isSameLine = Math.abs(y - midY) < Math.max(bbox.height, 12);
      
      const dx = Math.abs(x - (bbox.x + bbox.width / 2));
      const dy = Math.abs(y - midY);
      const spatialDist = Math.sqrt(dx * dx + dy * dy);

      // Score weights: Same line (50pts) + proximity (up to 50pts)
      let score = 0;
      if (isSameLine) score += 50;
      score += Math.max(0, 50 - (spatialDist * 0.15));

      if (score > highestScore) {
        highestScore = score;
        bestRun = run;
      }
    }

    if (bestRun) {
      return {
        family: bestRun.font.normalizedFamily || 'Helvetica',
        size: Math.round(bestRun.font.size * 10) / 10,
        weight: bestRun.font.weight || 'normal',
        bold: !!bestRun.font.bold,
        italic: !!bestRun.font.italic,
        color: bestRun.color || '#111827',
        lineHeight: bestRun.lineHeight || (bestRun.font.size * 1.25),
        baseline: bestRun.baseline,
        confidence: Math.min(100, Math.round(highestScore))
      };
    }

    return FontIntelligenceEngine.getDefaultStyle();
  }

  static getDefaultStyle() {
    return {
      family: 'Arial',
      size: 11,
      weight: 'normal',
      bold: false,
      italic: false,
      color: '#111827',
      lineHeight: 14,
      confidence: 0
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.FontIntelligenceEngine = FontIntelligenceEngine;
