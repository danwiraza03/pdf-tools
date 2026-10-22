/**
 * Font Intelligence Engine
 */
class FontIntelligenceEngine {
  /**
   * Infer font style based on coordinates
   */
  static inferAtPoint(pageModelRuns, x, y) {
    if (!pageModelRuns || pageModelRuns.length === 0) {
      return this.getDefaultStyle();
    }
    
    let bestRun = null;
    let bestScore = -1;
    
    for (const run of pageModelRuns) {
      // Calculate spatial distance from center of bounding box to (x,y)
      const cx = run.bbox.x + run.bbox.width / 2;
      const cy = run.bbox.y + run.bbox.height / 2;
      
      const dx = cx - x;
      const dy = cy - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Basic scoring: inversely proportional to distance
      // Give higher weight if Y is very close (same line)
      let score = 1000 / (distance + 1);
      
      if (Math.abs(dy) < run.font.size) {
        score += 500; // Same line bonus
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestRun = run;
      }
    }
    
    if (bestRun && bestScore > 5) { // Minimum threshold
      return {
        family: bestRun.font.family,
        size: Math.round(bestRun.font.size),
        weight: bestRun.font.weight,
        italic: bestRun.font.italic,
        color: bestRun.color,
        baseline: bestRun.baseline,
        lineHeight: bestRun.lineHeight,
        confidence: bestScore
      };
    }
    
    return this.getDefaultStyle();
  }
  
  static getDefaultStyle() {
    return {
      family: 'Helvetica',
      size: 14,
      weight: 'normal',
      italic: false,
      color: '#000000',
      baseline: 0,
      lineHeight: 1.2,
      confidence: 0
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.FontIntelligenceEngine = FontIntelligenceEngine;
