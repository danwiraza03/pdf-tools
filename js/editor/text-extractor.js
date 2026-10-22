/**
 * Extracts structured text from PDF.js page.
 */
class TextExtractor {
  static async extractPageText(page, pageNumber) {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 }); // Use scale 1 for model extraction
    
    const runs = [];
    
    for (let i = 0; i < textContent.items.length; i++) {
      const item = textContent.items[i];
      if (item.str.trim() === '') continue; // skip pure whitespace runs for now
      
      const font = textContent.styles[item.fontName];
      let fontFamily = 'Helvetica';
      let weight = 'normal';
      let italic = false;
      let subset = false;
      
      if (font) {
        let fFamily = font.fontFamily || font.fallbackName || 'Helvetica';
        // Clean subset prefix e.g., ABCDEF+Arial
        if (fFamily.includes('+')) {
          fFamily = fFamily.split('+')[1];
          subset = true;
        }
        fontFamily = fFamily;
        
        const lowerName = fFamily.toLowerCase();
        if (lowerName.includes('bold')) weight = 'bold';
        if (lowerName.includes('italic') || lowerName.includes('oblique')) italic = true;
      }
      
      // Calculate font size and rotation from PDF transformation matrix
      const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
      const rotation = Math.atan2(item.transform[1], item.transform[0]);
      
      const width = item.width; 
      const height = item.height || fontSize;
      
      // coordinates (tx, ty) from PDF transform are usually bottom-left
      const x = item.transform[4];
      const y = item.transform[5]; 
      
      const run = new window.PDFTools.TextModel.TextRun({
        id: 'run_' + i,
        pageNumber: pageNumber,
        text: item.str,
        bbox: {
          x: x,
          y: viewport.height - y - height, // Convert approx to top-left Y
          width: width,
          height: height
        },
        matrix: item.transform,
        baseline: viewport.height - y,
        font: {
          pdfFontName: item.fontName,
          family: fontFamily,
          baseFamily: fontFamily,
          size: fontSize,
          weight: weight,
          italic: italic,
          subset: subset
        },
        color: item.color ? `rgb(${item.color[0]},${item.color[1]},${item.color[2]})` : '#000000',
        rotation: rotation
      });
      
      runs.push(run);
    }
    
    return runs;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.TextExtractor = TextExtractor;
