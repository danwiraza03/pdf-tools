/**
 * Groups TextRuns into clean Lines and Paragraphs
 */
class TextBlockDetector {
  static groupRuns(runs) {
    if (!runs || runs.length === 0) return [];
    
    // Sort runs top-to-bottom, left-to-right
    runs.sort((a, b) => {
      if (Math.abs(a.bbox.y - b.bbox.y) < 4) {
        return a.bbox.x - b.bbox.x;
      }
      return a.bbox.y - b.bbox.y;
    });
    
    const lines = [];
    let currentLine = new window.PDFTools.TextModel.TextLine();
    
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (currentLine.runs.length === 0) {
        currentLine.addRun(run);
      } else {
        const lastRun = currentLine.runs[currentLine.runs.length - 1];
        const lastFontSize = (lastRun.font && lastRun.font.size) ? lastRun.font.size : 12;
        const sameY = Math.abs(lastRun.bbox.y - run.bbox.y) < Math.max(lastFontSize * 0.55, 5);
        const horizGap = run.bbox.x - (lastRun.bbox.x + lastRun.bbox.width);
        const maxGap = Math.max(lastFontSize * 4.5, 50);

        // Group only if on same horizontal baseline and within reasonable word-spacing
        if (sameY && horizGap >= -4 && horizGap <= maxGap) {
          currentLine.addRun(run);
        } else {
          lines.push(currentLine);
          currentLine = new window.PDFTools.TextModel.TextLine();
          currentLine.addRun(run);
        }
      }
    }
    if (currentLine.runs.length > 0) {
      lines.push(currentLine);
    }
    
    // Group lines into blocks/paragraphs
    const blocks = [];
    let currentBlock = new window.PDFTools.TextModel.TextBlock();
    let currentPara = new window.PDFTools.TextModel.TextParagraph();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (currentPara.lines.length === 0) {
        currentPara.addLine(line);
      } else {
        const lastLine = currentPara.lines[currentPara.lines.length - 1];
        const lastRun = lastLine.runs[0];
        const currentRun = line.runs[0];
        const fontSz = (lastRun && lastRun.font && lastRun.font.size) ? lastRun.font.size : 12;
        
        const yDist = currentRun.bbox.y - (lastRun.bbox.y + lastRun.bbox.height);
        const sameColumn = Math.abs(currentRun.bbox.x - lastRun.bbox.x) < Math.max(fontSz * 4, 60);

        // Check if consecutive line within 1.6x line-height and aligned in same column
        if (yDist >= -4 && yDist < fontSz * 1.6 && sameColumn) {
          currentPara.addLine(line);
        } else {
          currentBlock.paragraphs.push(currentPara);
          blocks.push(currentBlock);
          
          currentBlock = new window.PDFTools.TextModel.TextBlock();
          currentPara = new window.PDFTools.TextModel.TextParagraph();
          currentPara.addLine(line);
        }
      }
    }
    if (currentPara.lines.length > 0) {
      currentBlock.paragraphs.push(currentPara);
      blocks.push(currentBlock);
    }
    
    // Compute exact Bounding Boxes for all structures
    for (const block of blocks) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const para of block.paragraphs) {
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const line of para.lines) {
          let lMinX = Infinity, lMinY = Infinity, lMaxX = -Infinity, lMaxY = -Infinity;
          line.runs.sort((a, b) => a.bbox.x - b.bbox.x);
          
          line.text = '';
          for (let i = 0; i < line.runs.length; i++) {
            const run = line.runs[i];
            if (i > 0) {
              const prevRun = line.runs[i - 1];
              const dist = run.bbox.x - (prevRun.bbox.x + prevRun.bbox.width);
              const runFontSz = (run.font && run.font.size) ? run.font.size : 12;
              if (dist > runFontSz * 0.2) {
                line.text += ' ';
              }
            }
            line.text += run.originalText || run.text || '';
            
            lMinX = Math.min(lMinX, run.bbox.x);
            lMinY = Math.min(lMinY, run.bbox.y);
            lMaxX = Math.max(lMaxX, run.bbox.x + run.bbox.width);
            lMaxY = Math.max(lMaxY, run.bbox.y + run.bbox.height);
          }
          line.bbox = { x: lMinX, y: lMinY, width: Math.max(lMaxX - lMinX, 10), height: Math.max(lMaxY - lMinY, 10) };
          
          pMinX = Math.min(pMinX, line.bbox.x);
          pMinY = Math.min(pMinY, line.bbox.y);
          pMaxX = Math.max(pMaxX, line.bbox.x + line.bbox.width);
          pMaxY = Math.max(pMaxY, line.bbox.y + line.bbox.height);
        }
        para.bbox = { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
        
        minX = Math.min(minX, para.bbox.x);
        minY = Math.min(minY, para.bbox.y);
        maxX = Math.max(maxX, para.bbox.x + para.bbox.width);
        maxY = Math.max(maxY, para.bbox.y + para.bbox.height);
      }
      block.bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    
    return blocks;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.TextBlockDetector = TextBlockDetector;
