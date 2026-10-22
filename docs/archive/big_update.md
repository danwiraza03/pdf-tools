# ROLE

Act as a **Senior PDF Rendering Engineer, PDF Specification Expert, JavaScript/TypeScript Architect, Font Engineer, and Professional Document Editor Engineer**.

You are improving my existing browser-based application **PDF Studio Pro**.

The highest priority is:

> EDITING A PDF MUST NOT CHANGE THE ORIGINAL APPEARANCE, LAYOUT, FONT, SIZE, SPACING, POSITION, OR FORMAT UNLESS THE USER EXPLICITLY CHANGES THEM.

The current problem is that after editing existing PDF text, the document becomes visually messy.

Fix this problem first.

Do NOT redesign unrelated features.

---

# PRIMARY OBJECTIVE

Implement a **Preserve Original Layout Editing Engine**.

When opening a PDF, the visual appearance before editing and after editing must remain as close as technically possible.

Example:

Original PDF:

```text
Nama       : Budi Santoso
Jabatan    : Project Manager
Nilai      : Rp 500.000.000
Tanggal    : 24 Agustus 2026
```

If the user changes only:

```text
Budi Santoso
```

into:

```text
Andi Santoso
```

then ONLY those characters may change.

The application MUST NOT accidentally change:

```text
position
font family
font size
font weight
font style
text color
character spacing
word spacing
line height
baseline
paragraph alignment
column position
table alignment
neighboring objects
page size
images
graphics
```

---

# MOST IMPORTANT RULE

Use:

```text
PRESERVE FIRST
```

instead of:

```text
REFLOW FIRST
```

The default editing mode must be:

```text
FIXED LAYOUT MODE
```

NOT:

```text
AUTO REFLOW MODE
```

---

# FIXED LAYOUT EDITING

For every text object extracted from the PDF, store its exact formatting and geometry.

Create:

```javascript
PDFTextRun {
    id,
    pageNumber,

    originalText,
    currentText,

    bbox: {
        x,
        y,
        width,
        height
    },

    transformMatrix,

    baseline,

    font: {
        pdfFontName,
        normalizedFamily,
        postScriptName,
        size,
        weight,
        bold,
        italic,
        embedded,
        subset
    },

    color,

    opacity,

    characterSpacing,
    wordSpacing,
    horizontalScale,

    lineHeight,

    rotation,

    alignment
}
```

When a user edits the text:

DO NOT recalculate these values automatically.

Preserve:

```text
x
y
width
height
baseline
font family
font size
font weight
italic
color
character spacing
word spacing
line height
rotation
alignment
```

unless the user manually changes that property.

---

# DO NOT AUTO REFLOW

This is critical.

If original text:

```text
Project Manager
```

is replaced by:

```text
Senior Project Engineering Manager
```

DO NOT automatically:

* move other text;
* enlarge the text box;
* reduce font size;
* increase line height;
* shift neighboring objects;
* change paragraph layout.

Instead calculate whether the new text still fits inside the original bounding box.

Create:

```javascript
measureEditedText()
```

Compare:

```javascript
newTextWidth <= originalBoxWidth
```

If YES:

render normally.

If NO:

show warning:

```text
Text exceeds original area.
```

Provide options:

```text
Keep Original Layout
Reduce Font Size
Expand Text Box
Enable Reflow
```

DEFAULT:

```text
Keep Original Layout
```

Never automatically choose another option.

---

# NO AUTOMATIC FONT RESIZING

Very important.

If the source text is:

```text
Arial
10 pt
Bold
```

the replacement must remain:

```text
Arial
10 pt
Bold
```

DO NOT automatically turn it into:

```text
Arial 9
Arial 8
Helvetica 10
Times 10
```

just because replacement text is longer.

Font size may change ONLY when the user changes it manually.

---

# PRESERVE FONT

Currently the editor often replaces existing text using Helvetica.

STOP THIS BEHAVIOR.

Do not use:

```javascript
StandardFonts.Helvetica
```

as a universal replacement font.

Determine the actual source font for every editable text object.

Read:

```javascript
page.getTextContent()
```

and inspect:

```javascript
textContent.items
textContent.styles

item.fontName
item.transform
item.width
item.height
```

Also inspect PDF font resources where technically possible.

---

# FONT NAME NORMALIZATION

PDF fonts may contain subset prefixes.

Examples:

```text
ABCDEE+ArialMT
BCDEFG+Calibri
GHJKLM+Calibri-Bold
ZXCVBN+TimesNewRomanPSMT
```

Normalize them.

Examples:

```text
ABCDEE+ArialMT
→ Arial

BCDEFG+Calibri
→ Calibri

GHJKLM+Calibri-Bold
→ Calibri Bold

ZXCVBN+TimesNewRomanPSMT
→ Times New Roman
```

Create:

```javascript
normalizePdfFontName()
```

Do not remove knowledge of the original PDF font name.

Store both:

```javascript
{
    pdfFontName: "ABCDEE+ArialMT",
    family: "Arial"
}
```

---

# BUILD A PROFESSIONAL FONT REGISTRY

Create:

```text
FontRegistry
```

and:

```text
FontResolver
```

The editor must support significantly more fonts.

Support these font families whenever available locally or supplied by the application.

## PDF Standard Fonts

```text
Helvetica
Helvetica Bold
Helvetica Oblique
Helvetica Bold Oblique

Times Roman
Times Bold
Times Italic
Times Bold Italic

Courier
Courier Bold
Courier Oblique
Courier Bold Oblique

Symbol
Zapf Dingbats
```

---

# COMMON OFFICE / WINDOWS FONTS

Support detection and use of:

```text
Arial
Arial Narrow
Arial Black

Calibri
Calibri Light

Cambria
Cambria Math

Times New Roman

Verdana

Tahoma

Trebuchet MS

Georgia

Century Gothic

Book Antiqua

Palatino Linotype

Garamond

Franklin Gothic

Segoe UI
Segoe UI Light
Segoe UI Semibold

Microsoft Sans Serif

Consolas

Lucida Console

Lucida Sans Unicode

Corbel

Candara

Constantia

Rockwell

Impact

Comic Sans MS
```

Do not bundle copyrighted commercial fonts without a proper license.

Use fonts installed on the user's device when legally and technically available.

---

# OPEN SOURCE FONT COLLECTION

Also support optional open-source fonts such as:

```text
Roboto
Roboto Condensed
Roboto Mono

Open Sans

Lato

Montserrat

Poppins

Inter

Noto Sans
Noto Serif
Noto Sans Mono

Liberation Sans
Liberation Serif
Liberation Mono

Source Sans
Source Serif
Source Code

DejaVu Sans
DejaVu Serif
DejaVu Sans Mono
```

Organize these as optional application fonts.

---

# USER CUSTOM FONT SUPPORT

Add:

```text
Add Font
```

or:

```text
Load Font
```

to the font selector.

Support:

```text
.ttf
.otf
```

The user should be able to import a font.

Create:

```javascript
registerCustomFont(file)
```

Store it during the current editing session.

If browser persistent storage is supported safely, optionally cache font metadata locally.

---

# FONT EMBEDDING

Where pdf-lib is used, integrate:

```text
@pdf-lib/fontkit
```

for TrueType/OpenType font embedding.

Architecture:

```text
Original PDF Font
        ↓
Can original font safely render new glyphs?
        ↓
       YES
        ↓
Use original / compatible font
```

Otherwise:

```text
Original PDF Font
        ↓
Exact local font available?
        ↓
YES → use it
```

Otherwise:

```text
Metric-compatible font
```

Only after all those fail:

```text
Generic fallback
```

Helvetica must be a LAST RESORT.

---

# FONT RESOLUTION PRIORITY

Use this exact order:

```text
1. Original embedded PDF font, if reusable
2. Exact font family available locally
3. User-supplied exact font
4. Application-provided exact font
5. Metric-compatible font
6. Similar font
7. Generic fallback
```

Do not immediately fallback to Helvetica.

---

# FONT METRIC MATCHING

If exact font is unavailable, compare fonts using:

```text
character width
x-height
cap height
ascender
descender
average glyph width
weight
italic angle
```

Create:

```javascript
findMetricCompatibleFont()
```

Example:

```text
Arial unavailable
↓
Liberation Sans
```

is preferable to an unrelated serif font.

---

# FONT SUBSTITUTION INDICATOR

If the exact original font cannot be used, display:

```text
Original font: Arial
Using: Liberation Sans
Status: Compatible substitute
```

Do not silently substitute fonts.

---

# ADD TEXT AUTO FONT MATCH

When the user activates:

```text
Add Text
```

and clicks somewhere on the PDF:

DO NOT automatically create:

```text
Helvetica 14
```

Instead run:

```javascript
FontIntelligenceEngine.inferStyleAtPoint(page, x, y)
```

Analyze surrounding text.

Priorities:

```text
1. same text line
2. same paragraph
3. same table cell
4. same text block
5. nearest text
6. dominant page style
7. dominant document style
```

Return:

```javascript
{
    fontFamily,
    fontSize,
    bold,
    italic,
    color,

    characterSpacing,
    wordSpacing,
    lineHeight,

    baseline,

    confidence
}
```

Example:

If user clicks next to:

```text
TOTAL NILAI : Rp 500.000.000
```

and existing style is:

```text
Arial
11 pt
Bold
#222222
```

new text must automatically become:

```text
Arial
11 pt
Bold
#222222
```

not Helvetica.

---

# PRESERVE ORIGINAL BASELINE

This is extremely important.

Do NOT position replacement text simply using:

```javascript
x
y
```

from HTML coordinates.

Preserve the original PDF text transformation.

Read:

```javascript
item.transform
```

and preserve:

```text
translation
scale
rotation
baseline
```

Respect PDF coordinate conversion:

```text
Browser:
top-left origin

PDF:
bottom-left origin
```

Create one centralized coordinate utility.

For example:

```text
PDFCoordinateEngine
```

Do not scatter coordinate conversions throughout the code.

---

# PRESERVE ROTATED TEXT

If source text is rotated:

```text
90°
180°
270°
custom angle
```

replacement must use exactly the same rotation.

Do not normalize it to zero degrees.

---

# PRESERVE TEXT COLOR

Extract actual source text color where technically possible from PDF graphics operators.

Do not assume:

```text
#000000
```

for every text run.

Store:

```javascript
fillColor
strokeColor
opacity
```

where available.

---

# PRESERVE CHARACTER SPACING

Capture and preserve:

```text
Tc = character spacing
Tw = word spacing
Tz = horizontal scaling
TL = leading
Ts = text rise
```

where supported by the PDF engine.

Do not assume normal CSS spacing.

---

# DO NOT MODIFY NEIGHBORING CONTENT

Editing one object must not rebuild the entire page.

Wrong:

```text
User edits one sentence
↓
application regenerates entire PDF page
```

Correct:

```text
User edits one text run/block
↓
only corresponding content is changed
```

Other objects must remain untouched:

```text
images
vectors
lines
tables
other text
annotations
background graphics
```

---

# AVOID WHITE RECTANGLES

The current technique:

```text
draw white rectangle
↓
write replacement text
```

causes visible damage.

Remove this as the default editing implementation.

Especially never assume background is white.

PDF pages may contain:

```text
colored backgrounds
tables
patterns
gradients
photographs
vector drawings
company letterhead
```

---

# IF TRUE CONTENT STREAM EDITING IS NOT AVAILABLE

If the current library cannot safely modify the actual existing PDF text object:

DO NOT pretend that true editing is occurring.

Implement a safe compatibility strategy.

Possible order:

```text
1. Low-level content stream modification
2. Object-level PDF engine modification
3. Visually safe overlay as compatibility fallback
```

Overlay mode must be explicitly marked internally as:

```text
compatibilityMode
```

If overlay is unavoidable, preserve underlying appearance by reconstructing only the minimum affected region, not an arbitrary white rectangle.

---

# TEXT BOX BEHAVIOR

Every existing editable text block gets:

```text
Original Bounds
```

Keep them fixed by default.

Do not automatically change:

```text
left
top
width
height
```

when editing.

Only when user manually drags/resizes the box should geometry change.

---

# TABLE SAFETY

Detect text that appears inside table cells.

If text is inside a cell:

```text
lock to cell bounds
```

Do not allow automatic paragraph expansion beyond the cell.

Preserve:

```text
column width
row height
cell alignment
```

---

# DOCUMENT VISUAL LOCK

Create global mode:

```text
Preserve Original Formatting
```

DEFAULT:

```text
ON
```

When enabled:

Lock automatic modifications to:

```text
font family
font size
font weight
italic
line height
paragraph spacing
character spacing
alignment
rotation
bounding box
```

Show this in toolbar:

```text
☑ Preserve Original Formatting
```

---

# PROPERTY PANEL

When existing text is selected, show:

```text
Font
Size
Bold
Italic
Color
Character spacing
Line spacing
Alignment
Rotation
```

Display the actual properties of the source PDF.

Example:

```text
Font: Arial
Size: 9.5 pt
Weight: Regular
Color: #1F1F1F
Rotation: 0°
```

Do not replace these values with application defaults.

---

# TEXT OVERFLOW DETECTION

Create:

```javascript
TextFitEngine
```

Calculate actual glyph width using selected font metrics.

States:

```text
FIT
NEAR_LIMIT
OVERFLOW
```

Example UI:

```text
Original width : 142.3 pt
Edited width   : 138.7 pt

Status:
✓ Fits original area
```

If overflow:

```text
Original width : 142.3 pt
Edited width   : 177.5 pt

⚠ Text exceeds original area.
```

Do not automatically modify formatting.

---

# OPTIONAL FIT MODES

User may explicitly select:

```text
Original Size
Fit Text
Expand Box
Reflow Paragraph
```

DEFAULT:

```text
Original Size
```

---

# SAVE REQUIREMENT

Saving a PDF must preserve as much original document data as possible.

Do NOT unnecessarily:

```text
rasterize pages
rebuild all pages
change page size
change image resolution
remove vectors
replace fonts globally
rewrite unrelated text
```

Only save actual modifications.

---

# BEFORE / AFTER VISUAL TEST

Implement a visual regression test.

Before modification:

```text
render original page → original.png
```

After save:

```text
render modified page → edited.png
```

Mask only the intentionally edited bounding box.

Compare every other pixel region.

Target:

```text
Outside edited region:
visual difference ≈ 0
```

If unrelated parts of the page change:

TEST FAILS.

---

# STRICT ACCEPTANCE TEST 1

Original:

```text
Jabatan : Senior Manager Engineering
```

Style:

```text
Arial
10 pt
Bold
dark gray
```

Replace only:

```text
Senior
```

with:

```text
Project
```

PASS only if:

```text
Arial remains Arial
10 pt remains 10 pt
Bold remains Bold
color unchanged
baseline unchanged
neighbor text unchanged
line position unchanged
```

---

# STRICT ACCEPTANCE TEST 2

Original table:

```text
| No | Description       | Amount      |
| 1  | Engineering Work  | 500,000,000 |
```

Change:

```text
500,000,000
```

into:

```text
550,000,000
```

PASS only if:

```text
cell width unchanged
row height unchanged
font unchanged
font size unchanged
table borders unchanged
alignment unchanged
```

---

# STRICT ACCEPTANCE TEST 3 — ADD TEXT

Existing:

```text
Prepared by:
Project Manager
```

If user clicks below:

```text
Project Manager
```

Add Text must inherit nearby formatting.

If nearby style:

```text
Calibri 10 pt
```

new Add Text must start as:

```text
Calibri 10 pt
```

not:

```text
Helvetica 14 pt
```

---

# FONT SELECTOR UI

Replace the tiny current font list with a searchable font selector.

Categories:

```text
Document Fonts
Recently Used
System Fonts
Application Fonts
Custom Fonts
PDF Standard Fonts
```

Example:

```text
Font
────────────────────
Document Fonts
  Arial
  Arial Bold
  Calibri
  Times New Roman

System Fonts
  Segoe UI
  Verdana
  Tahoma
  Georgia

Application Fonts
  Inter
  Roboto
  Open Sans
  Noto Sans

PDF Standard
  Helvetica
  Times
  Courier

+ Add Custom Font
```

Font names in the dropdown should preview themselves when feasible.

---

# FILE ARCHITECTURE

Move font and text behavior out of the large viewer file.

Create:

```text
js/editor/
    pdf-text-extractor.js
    pdf-coordinate-engine.js

    font-registry.js
    font-normalizer.js
    font-resolver.js
    font-intelligence.js

    text-fit-engine.js
    text-block-engine.js
    text-edit-engine.js
```

Do not keep all editor logic inside:

```text
viewer.html
```

---

# IMPORTANT CODING RULES

Do not provide:

```text
pseudo-code
TODO
placeholder
mock
fake success message
```

Implement real working code.

Do not change unrelated working modules.

Do not break:

```text
OCR
merge
split
rotate
reorder
watermark
compression
page numbers
signatures
```

---

# IMPLEMENTATION ORDER

Work in this order:

## STEP 1

Audit current existing-text extraction.

## STEP 2

Fix coordinate mapping.

## STEP 3

Build PDFTextRun model.

## STEP 4

Build FontNormalizer.

## STEP 5

Build FontRegistry.

## STEP 6

Build FontResolver.

## STEP 7

Build FontIntelligenceEngine.

## STEP 8

Fix Add Text auto font matching.

## STEP 9

Implement TextFitEngine.

## STEP 10

Implement Preserve Original Formatting mode.

## STEP 11

Fix existing-text replacement.

## STEP 12

Add visual regression tests.

Do not skip directly to UI enhancements before the core text engine is stable.

---

# VERY IMPORTANT

Do not optimize for:

```text
making edited text fit at any cost
```

Optimize for:

```text
preserving the source document exactly
```

If an edit cannot fit without changing the layout, tell the user.

Never silently change the document formatting.

---

# FIRST EXECUTION TASK

Inspect the actual current:

```text
pages/viewer.html
js/core/pdf-studio.js
```

Find every place where:

```text
Helvetica
fontSize: 14
#000000
white rectangle
drawText
drawRectangle
contentEditable
textContent.items
```

are used.

Then report:

```text
1. Source of layout corruption
2. Source of font changes
3. Source of font-size changes
4. Source of baseline changes
5. Source of background corruption
```

After the audit, implement the fixes.

Required final report:

```text
A. Root causes
B. Files modified
C. New modules created
D. Font system implemented
E. Layout preservation implemented
F. Before/after behavior
G. Tests passed
H. Remaining technical limitations
```

The final objective is simple:

> If I edit only one word in the PDF, every other visual element in the document must remain exactly where it was and retain exactly the same formatting.
