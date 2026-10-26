# Merge Size Optimization Benchmark

## Problem Summary
When merging multi-page PDFs (such as a 202-page thesis totaling 5.28 MB with a 0.22 MB appendix), the output file exploded to 107–136 MB.
The root cause was calling `await targetDoc.copyPages(sourceDoc, [pageIndex])` one page at a time inside a loop. Because `pdf-lib` copies all transitively referenced indirect objects (fonts, embedded images, stream dictionaries) on every independent `copyPages` invocation, shared objects were duplicated for every single page instead of being shared.

## Solution Architecture
1. **`PDFTools.Merge.assemble(items, options)`**:
   - Analyzes the ordered list of items (`{ doc/file, pageIndex, rotation }`).
   - Groups requested page indices by unique source document.
   - Executes a single batched `copyPages(sourceDoc, requestedIndices)` per unique source document.
   - Maps the returned copied page instances back into the target document in exact requested order and applies individual page rotations.
2. **`useObjectStreams: true`**:
   - Packs indirect objects into compressed object streams during final serialization.

## Benchmark Results (65 Pages Fixture)
Fixture specifications:
- **Document A**: 60 pages, each referencing the same ~300 KB noise PNG + unique text (`HAL-A-01` through `HAL-A-60`).
- **Document B**: 5 pages, unique text (`HAL-B-01` through `HAL-B-05`).
- **Merge Order**: Interleaved (A1, B1, A2, B2...), partial shuffle, 1 rotated page (90°), and 1 duplicated page.

| Metric | Before Fix (Single-page loop) | After Fix (`PDFTools.Merge.assemble`) | Improvement |
| :--- | :--- | :--- | :--- |
| **Source Doc A (60 pages)** | 335.7 KB (343,767 bytes) | 335.7 KB (343,767 bytes) | - |
| **Source Doc B (5 pages)** | 2.5 KB (2,538 bytes) | 2.5 KB (2,538 bytes) | - |
| **Sum of Source Files** | 338.2 KB (346,305 bytes) | 338.2 KB (346,305 bytes) | - |
| **Merged Output Size (Node)** | **18,785,339 bytes (~17.92 MB)** | **337,904 bytes (~329.9 KB)** | **-98.2% reduction** |
| **Merged Output Size (Browser UI)** | Failed / crashed browser | **329.7 KB** | Instant, zero lag |
| **Embedded Image XObjects** | 60 duplicated copies | 1 shared stream | No redundant copies |
| **Page Integrity & Rotation** | Passed | 100% Passed (PDF.js verified) | Preserved |
