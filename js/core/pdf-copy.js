/**
 * PDF Tools — PdfCopy Post-Processing Utility
 *
 * Provides PDFTools.PdfCopy.finalize(destDoc, pageMap, options) which must
 * be called after every copyPages-based operation (Merge, Remove Pages,
 * Split/Extract, Reorder, Unlock).
 *
 * It solves three fundamental issues in pdf-lib's copyPages:
 *   1. Ghost Pages & Content Leaks: When copying a page with link annotations
 *      pointing to other pages, pdf-lib recursively copies those target pages
 *      as unattached /Page objects in the destination context. This module
 *      temporarily neutralizes internal link targets during copyPages so that
 *      zero ghost pages are created and no secret content leaks.
 *   2. Link Remapping: Internal link annotations whose targets survive are
 *      remapped to point to the new page ref in the destination document;
 *      links whose targets were discarded are cleanly removed.
 *   3. Bookmarks & Metadata: Outlines (bookmarks) are rebuilt pointing to the
 *      new pages (nested under parent file names in Merge mode), and document
 *      metadata (Title, Author, Subject, Keywords, Creator) is preserved.
 *
 * The purgeUnreachableObjects function is SHARED with js/editor/redaction-engine.js
 * to eliminate dead indirect objects after manipulation.
 *
 * pageMap schema:
 *   Map<PDFDocument_source, Map<srcPageIndex(number), destPageRef(PDFRef)>>
 *
 * options:
 *   {
 *     primarySource?: PDFDocument,   // source to copy metadata from (default: first key of pageMap)
 *     mergeMode?: boolean,           // if true, wrap each source in a parent bookmark
 *     sourceNames?: Map<PDFDocument, string>,  // display name per source for merge bookmarks
 *   }
 */

(function () {
  'use strict';

  const globalObj = typeof window !== 'undefined' ? window
    : typeof global !== 'undefined' ? global
    : globalThis;

  globalObj.PDFTools = globalObj.PDFTools || {};

  // ============================================================================
  // Helper: resolve PDFLib
  // ============================================================================
  function getPdfLib() {
    if (globalObj.PDFLib) return globalObj.PDFLib;
    if (typeof PDFLib !== 'undefined') return PDFLib; // eslint-disable-line no-undef
    try {
      return require('../lib/pdf-lib.min.js');
    } catch (e) {
      return null;
    }
  }

  // ============================================================================
  // Link Target Neutralization (Pre-copy & Post-copy)
  //
  // During pdf-lib's copyPages, any PDFRef pointing to a /Page object will be
  // recursively copied as a full /Page indirect object, creating a ghost page
  // with full content streams.
  //
  // sanitizeLinkTargets replaces page refs in /Dest and /A /GoTo /D with a
  // placeholder PDFName '__TARGET_PAGE_<index>__'. Because PDFName is a primitive
  // value, copyPages clones it without traversing or copying any page objects!
  //
  // The returned restore() function restores the original PDFRefs in the source doc.
  // ============================================================================
  const TARGET_PAGE_PREFIX = '/__TARGET_PAGE_';

  function sanitizeLinkTargets(srcDoc) {
    const L = getPdfLib();
    if (!L || !srcDoc || typeof srcDoc.getPageCount !== 'function') {
      return () => {};
    }
    const { PDFName, PDFArray, PDFDict, PDFRef } = L;
    const ctx = srcDoc.context;

    // Map each page's PDFRef tag -> pageIndex (0-based)
    const pageCount = srcDoc.getPageCount();
    const refTagToIdx = new Map();
    for (let i = 0; i < pageCount; i++) {
      try {
        const p = srcDoc.getPage(i);
        if (p && p.ref) refTagToIdx.set(p.ref.tag, i);
      } catch (e) {}
    }

    const restorations = [];

    for (let pi = 0; pi < pageCount; pi++) {
      let page;
      try { page = srcDoc.getPage(pi); } catch (e) { continue; }
      if (!page || !page.node) continue;

      const annotsVal = page.node.get(PDFName.of('Annots'));
      if (!annotsVal) continue;
      const annotsArr = ctx.lookup(annotsVal);
      if (!(annotsArr instanceof PDFArray)) continue;

      for (let ai = 0; ai < annotsArr.size(); ai++) {
        const annotRef = annotsArr.get(ai);
        const annot = ctx.lookup(annotRef);
        if (!(annot instanceof PDFDict)) continue;

        const sub = annot.get(PDFName.of('Subtype'));
        if (!sub || sub.toString() !== '/Link') continue;

        // 1. Direct /Dest array
        const dest = annot.get(PDFName.of('Dest'));
        if (dest) {
          const destArr = ctx.lookup(dest);
          if (destArr instanceof PDFArray && destArr.size() > 0) {
            const first = destArr.get(0);
            if (first instanceof PDFRef && refTagToIdx.has(first.tag)) {
              const targetIdx = refTagToIdx.get(first.tag);
              destArr.set(0, PDFName.of(`__TARGET_PAGE_${targetIdx}__`));
              restorations.push(() => destArr.set(0, first));
            }
          }
        }

        // 2. Action /A << /S /GoTo /D [targetPageRef ...] >>
        const aAct = annot.get(PDFName.of('A'));
        if (aAct) {
          const aDict = ctx.lookup(aAct);
          if (aDict instanceof PDFDict) {
            const s = aDict.get(PDFName.of('S'));
            if (s && s.toString() === '/GoTo') {
              const d = aDict.get(PDFName.of('D'));
              if (d) {
                const dArr = ctx.lookup(d);
                if (dArr instanceof PDFArray && dArr.size() > 0) {
                  const first = dArr.get(0);
                  if (first instanceof PDFRef && refTagToIdx.has(first.tag)) {
                    const targetIdx = refTagToIdx.get(first.tag);
                    dArr.set(0, PDFName.of(`__TARGET_PAGE_${targetIdx}__`));
                    restorations.push(() => dArr.set(0, first));
                  }
                }
              }
            }
          }
        }
      }
    }

    return function restore() {
      for (let i = 0; i < restorations.length; i++) {
        try { restorations[i](); } catch (e) {}
      }
    };
  }

  // ============================================================================
  // Safe copyPages Monkey-Patch
  //
  // Transparently wrap PDFDocument.prototype.copyPages so that NO call to
  // copyPages anywhere in the app can pull in ghost pages or content leaks.
  // ============================================================================
  function installCopyPagesHook() {
    const L = getPdfLib();
    if (!L || !L.PDFDocument || !L.PDFDocument.prototype) return;
    const proto = L.PDFDocument.prototype;

    if (proto._copyPagesSafeHookInstalled) return;

    const originalCopyPages = proto.copyPages;
    proto.copyPages = async function (srcDoc, indices) {
      const restore = sanitizeLinkTargets(srcDoc);
      try {
        return await originalCopyPages.call(this, srcDoc, indices);
      } finally {
        restore();
      }
    };
    proto._copyPagesSafeHookInstalled = true;
  }

  installCopyPagesHook();

  // ============================================================================
  // SHARED: purgeUnreachableObjects
  // Delete every indirect object that is no longer reachable from the trailer
  // (Root / Info / Encrypt). pdf-lib writes ALL context objects on save, so
  // without this, ghost /Page objects and their content streams remain in the file.
  //
  // @param {PDFDocument} pdfDoc
  // @returns {number} count of removed objects
  // ============================================================================
  function purgeUnreachableObjects(pdfDoc) {
    const L = getPdfLib();
    const { PDFRef, PDFDict, PDFArray, PDFStream } = L;
    const ctx = pdfDoc.context;
    const reachable = new Set();
    const seenDirect = new Set();
    const stack = [];
    const ti = ctx.trailerInfo || {};
    [ti.Root, ti.Info, ti.Encrypt].forEach(o => { if (o) stack.push(o); });

    while (stack.length) {
      const o = stack.pop();
      if (!o) continue;
      if (o instanceof PDFRef) {
        if (reachable.has(o.tag)) continue;
        reachable.add(o.tag);
        const target = ctx.lookup(o);
        if (target) stack.push(target);
      } else if (o instanceof PDFStream) {
        stack.push(o.dict);
      } else if (o instanceof PDFDict) {
        if (seenDirect.has(o)) continue;
        seenDirect.add(o);
        for (const [, v] of o.entries()) stack.push(v);
      } else if (o instanceof PDFArray) {
        if (seenDirect.has(o)) continue;
        seenDirect.add(o);
        for (const v of o.asArray()) stack.push(v);
      }
    }

    let removed = 0;
    const all = ctx.enumerateIndirectObjects().slice();
    for (const [ref] of all) {
      if (!reachable.has(ref.tag)) {
        ctx.delete(ref);
        removed++;
      }
    }
    return removed;
  }

  // ============================================================================
  // Internal: Remap link annotations on pages in destDoc
  // ============================================================================
  function remapPageAnnotations(destDoc, pageMap, options) {
    const L = getPdfLib();
    const { PDFRef, PDFDict, PDFArray, PDFName } = L;
    const ctx = destDoc.context;
    const pageCount = destDoc.getPageCount();

    // Map destPageRef.tag -> { srcDoc, srcIdx }
    const destRefToSrc = new Map();
    for (const [sDoc, innerMap] of pageMap.entries()) {
      for (const [srcIdx, destRef] of innerMap.entries()) {
        if (destRef && destRef.tag) {
          destRefToSrc.set(destRef.tag, { srcDoc: sDoc, srcIdx });
        }
      }
    }

    const fallbackSrc = options.primarySource || Array.from(pageMap.keys())[0];

    for (let pi = 0; pi < pageCount; pi++) {
      const page = destDoc.getPage(pi);
      const annotsVal = page.node.get(PDFName.of('Annots'));
      if (!annotsVal) continue;

      let annotsArr;
      if (annotsVal instanceof PDFRef) annotsArr = ctx.lookup(annotsVal);
      else annotsArr = annotsVal;

      if (!(annotsArr instanceof PDFArray)) continue;

      const pageInfo = destRefToSrc.get(page.ref.tag);
      const srcDoc = pageInfo ? pageInfo.srcDoc : fallbackSrc;
      const innerMap = (srcDoc && pageMap.get(srcDoc)) || new Map();

      const kept = [];
      for (const annotRef of annotsArr.asArray()) {
        let annotDict;
        if (annotRef instanceof PDFRef) annotDict = ctx.lookup(annotRef);
        else annotDict = annotRef;

        if (!(annotDict instanceof PDFDict)) {
          kept.push(annotRef);
          continue;
        }

        const subtype = annotDict.get(PDFName.of('Subtype'));
        if (!subtype || subtype.toString() !== '/Link') {
          kept.push(annotRef);
          continue;
        }

        let discard = false;

        // Check direct /Dest
        const destVal = annotDict.get(PDFName.of('Dest'));
        if (destVal) {
          const destArr = ctx.lookup(destVal);
          if (destArr instanceof PDFArray && destArr.size() > 0) {
            const first = destArr.get(0);
            const firstStr = first ? first.toString() : '';
            if (firstStr.startsWith(TARGET_PAGE_PREFIX)) {
              const tidx = parseInt(firstStr.slice(TARGET_PAGE_PREFIX.length, -2), 10);
              if (innerMap.has(tidx)) {
                destArr.set(0, innerMap.get(tidx));
              } else {
                discard = true;
              }
            } else if (first instanceof PDFRef) {
              // Direct ref fallback
              let foundTarget = false;
              for (const [sIdx, dRef] of innerMap.entries()) {
                if (first.tag === dRef.tag) {
                  foundTarget = true;
                  break;
                }
              }
              // If not found in kept pages, discard
              if (!foundTarget) {
                // Check if it's already a valid page in destDoc
                let inDestTree = false;
                for (let d = 0; d < pageCount; d++) {
                  if (destDoc.getPage(d).ref.tag === first.tag) { inDestTree = true; break; }
                }
                if (!inDestTree) discard = true;
              }
            }
          }
        }

        // Check action /A << /S /GoTo /D ... >>
        const actionVal = annotDict.get(PDFName.of('A'));
        if (actionVal && !discard) {
          const actionDict = ctx.lookup(actionVal);
          if (actionDict instanceof PDFDict) {
            const s = actionDict.get(PDFName.of('S'));
            if (s && s.toString() === '/GoTo') {
              const d = actionDict.get(PDFName.of('D'));
              if (d) {
                const dArr = ctx.lookup(d);
                if (dArr instanceof PDFArray && dArr.size() > 0) {
                  const first = dArr.get(0);
                  const firstStr = first ? first.toString() : '';
                  if (firstStr.startsWith(TARGET_PAGE_PREFIX)) {
                    const tidx = parseInt(firstStr.slice(TARGET_PAGE_PREFIX.length, -2), 10);
                    if (innerMap.has(tidx)) {
                      dArr.set(0, innerMap.get(tidx));
                    } else {
                      discard = true;
                    }
                  } else if (first instanceof PDFRef) {
                    let inDestTree = false;
                    for (let d = 0; d < pageCount; d++) {
                      if (destDoc.getPage(d).ref.tag === first.tag) { inDestTree = true; break; }
                    }
                    if (!inDestTree) discard = true;
                  }
                }
              }
            }
          }
        }

        if (!discard) {
          kept.push(annotRef);
        }
      }

      if (kept.length !== annotsArr.size()) {
        if (kept.length === 0) {
          page.node.delete(PDFName.of('Annots'));
        } else {
          page.node.set(PDFName.of('Annots'), ctx.obj(kept));
        }
      }
    }
  }

  // ============================================================================
  // Internal: Rebuild Outlines (Bookmarks)
  // ============================================================================
  function remapOutlines(destDoc, pageMap, options) {
    const L = getPdfLib();
    const { PDFRef, PDFDict, PDFName } = L;
    const ctx = destDoc.context;

    const sources = Array.from(pageMap.keys());
    if (sources.length === 0) return;

    if (options.mergeMode) {
      // Merge mode: nest each document's bookmarks under a parent named after the file
      const allTopItems = [];
      for (let s = 0; s < sources.length; s++) {
        const srcDoc = sources[s];
        const innerMap = pageMap.get(srcDoc);
        const srcName = (options.sourceNames && options.sourceNames.get(srcDoc)) || `Document ${s + 1}`;

        const outlinesRef = srcDoc.catalog.get(PDFName.of('Outlines'));
        if (!outlinesRef) continue;
        const srcOutlines = srcDoc.context.lookup(outlinesRef);
        if (!srcOutlines || !(srcOutlines instanceof PDFDict)) continue;

        const childItems = collectOutlineItems(srcDoc, srcOutlines, innerMap, L);
        if (childItems.length === 0) continue;

        allTopItems.push({ title: srcName, destRef: null, children: childItems });
      }

      if (allTopItems.length > 0) {
        const written = writeOutlineItems(destDoc, allTopItems, null, L);
        if (written.length > 0) {
          const count = countAllOutlineItems(allTopItems);
          const outlinesDict = ctx.obj({
            Type: 'Outlines',
            Count: count,
            First: written[0].ref,
            Last: written[written.length - 1].ref
          });
          const newOutlinesRef = ctx.register(outlinesDict);
          for (const w of written) ctx.lookup(w.ref).set(PDFName.of('Parent'), newOutlinesRef);
          destDoc.catalog.set(PDFName.of('Outlines'), newOutlinesRef);
        }
      }
    } else {
      // Single source mode (or flat merge): rebuild from primary source
      const primarySource = options.primarySource || sources[0];
      const innerMap = pageMap.get(primarySource);
      if (!innerMap) return;

      const outlinesRef = primarySource.catalog.get(PDFName.of('Outlines'));
      if (!outlinesRef) return;
      const srcOutlines = primarySource.context.lookup(outlinesRef);
      if (!srcOutlines || !(srcOutlines instanceof PDFDict)) return;

      const items = collectOutlineItems(primarySource, srcOutlines, innerMap, L);
      if (items.length === 0) return;

      const written = writeOutlineItems(destDoc, items, null, L);
      if (written.length === 0) return;

      const count = countAllOutlineItems(items);
      const outlinesDict = ctx.obj({
        Type: 'Outlines',
        Count: count,
        First: written[0].ref,
        Last: written[written.length - 1].ref
      });
      const newOutlinesRef = ctx.register(outlinesDict);
      for (const w of written) ctx.lookup(w.ref).set(PDFName.of('Parent'), newOutlinesRef);
      destDoc.catalog.set(PDFName.of('Outlines'), newOutlinesRef);
    }
  }

  function countAllOutlineItems(items) {
    let n = 0;
    for (const item of items) {
      n++;
      if (item.children && item.children.length > 0) {
        n += countAllOutlineItems(item.children);
      }
    }
    return n;
  }

  function collectOutlineItems(srcDoc, outlinesDict, innerMap, L) {
    const { PDFRef, PDFDict, PDFArray, PDFName } = L;
    const ctx = srcDoc.context;

    // Build map from srcDoc's page ref.tag -> srcPageIndex
    const srcRefTagToIdx = new Map();
    for (let i = 0; i < srcDoc.getPageCount(); i++) {
      try {
        srcRefTagToIdx.set(srcDoc.getPage(i).ref.tag, i);
      } catch (e) {}
    }

    const items = [];
    let itemRef = outlinesDict.get(PDFName.of('First'));

    while (itemRef instanceof PDFRef) {
      const item = ctx.lookup(itemRef);
      if (!item || !(item instanceof PDFDict)) break;

      const titleVal = item.get(PDFName.of('Title'));
      let title = '';
      if (titleVal) {
        title = titleVal.toString();
        if (title.startsWith('(') && title.endsWith(')')) title = title.slice(1, -1);
        if (title.startsWith('<') && title.endsWith('>')) {
          const hex = title.slice(1, -1);
          const decoded = Buffer.from(hex, 'hex').toString('latin1');
          if (decoded.startsWith('\xfe\xff')) {
            const chars = [];
            for (let i = 2; i < decoded.length; i += 2) {
              chars.push(String.fromCharCode((decoded.charCodeAt(i) << 8) | decoded.charCodeAt(i + 1)));
            }
            title = chars.join('');
          } else {
            title = decoded;
          }
        }
      }

      // Resolve destination
      let destRef = null;
      const destVal = item.get(PDFName.of('Dest'));
      if (destVal) {
        const destArr = ctx.lookup(destVal);
        if (destArr instanceof PDFArray && destArr.size() > 0) {
          const first = destArr.get(0);
          if (first instanceof PDFRef && srcRefTagToIdx.has(first.tag)) {
            const targetIdx = srcRefTagToIdx.get(first.tag);
            if (innerMap.has(targetIdx)) {
              destRef = innerMap.get(targetIdx);
            }
          }
        }
      }

      // Check /A action if /Dest is absent
      if (!destRef) {
        const aVal = item.get(PDFName.of('A'));
        if (aVal) {
          const aDict = ctx.lookup(aVal);
          if (aDict instanceof PDFDict) {
            const s = aDict.get(PDFName.of('S'));
            if (s && s.toString() === '/GoTo') {
              const d = aDict.get(PDFName.of('D'));
              if (d) {
                const dArr = ctx.lookup(d);
                if (dArr instanceof PDFArray && dArr.size() > 0) {
                  const first = dArr.get(0);
                  if (first instanceof PDFRef && srcRefTagToIdx.has(first.tag)) {
                    const targetIdx = srcRefTagToIdx.get(first.tag);
                    if (innerMap.has(targetIdx)) {
                      destRef = innerMap.get(targetIdx);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Collect children
      const childItems = [];
      const firstChild = item.get(PDFName.of('First'));
      if (firstChild instanceof PDFRef) {
        const fakeSub = ctx.obj({ Type: 'Outlines', First: firstChild });
        const sub = collectOutlineItems(srcDoc, fakeSub, innerMap, L);
        childItems.push(...sub);
      }

      if (destRef !== null || childItems.length > 0) {
        items.push({ title, destRef, children: childItems });
      }

      itemRef = item.get(PDFName.of('Next'));
    }

    return items;
  }

  function writeOutlineItems(destDoc, items, parentRef, L) {
    const { PDFName, PDFString } = L;
    const ctx = destDoc.context;
    const written = [];

    for (const item of items) {
      if (!item.title) continue;

      const entryData = {
        Title: PDFString.of(item.title)
      };

      if (item.destRef) {
        entryData.Dest = ctx.obj([item.destRef, PDFName.of('Fit')]);
      }

      const entryDict = ctx.obj(entryData);
      const entryRef = ctx.register(entryDict);
      written.push({ ref: entryRef, dict: entryDict, item });
    }

    for (let i = 0; i < written.length; i++) {
      if (i > 0) written[i].dict.set(PDFName.of('Prev'), written[i - 1].ref);
      if (i < written.length - 1) written[i].dict.set(PDFName.of('Next'), written[i + 1].ref);
      if (parentRef) written[i].dict.set(PDFName.of('Parent'), parentRef);

      if (written[i].item.children && written[i].item.children.length > 0) {
        const childWritten = writeOutlineItems(destDoc, written[i].item.children, written[i].ref, L);
        if (childWritten.length > 0) {
          const cnt = countAllOutlineItems(written[i].item.children);
          written[i].dict.set(PDFName.of('Count'), ctx.obj(cnt));
          written[i].dict.set(PDFName.of('First'), childWritten[0].ref);
          written[i].dict.set(PDFName.of('Last'), childWritten[childWritten.length - 1].ref);
        }
      }
    }

    return written;
  }

  // ============================================================================
  // Internal: Copy metadata from source to dest
  // ============================================================================
  function copyMetadata(destDoc, srcDoc) {
    if (!srcDoc) return;
    try {
      const title = srcDoc.getTitle();
      if (title) destDoc.setTitle(title);
    } catch (e) {}
    try {
      const author = srcDoc.getAuthor();
      if (author) destDoc.setAuthor(author);
    } catch (e) {}
    try {
      const subject = srcDoc.getSubject();
      if (subject) destDoc.setSubject(subject);
    } catch (e) {}
    try {
      const keywords = srcDoc.getKeywords();
      if (keywords) destDoc.setKeywords(keywords);
    } catch (e) {}
    try {
      const creator = srcDoc.getCreator();
      if (creator) destDoc.setCreator(creator);
    } catch (e) {}
    try {
      const producer = srcDoc.getProducer();
      if (producer) destDoc.setProducer(producer);
    } catch (e) {}
  }

  // ============================================================================
  // PUBLIC: PDFTools.PdfCopy.finalize(destDoc, pageMap, options)
  //
  // pageMap: Map<PDFDocument_source, Map<srcPageIndex(number), destPageRef(PDFRef)>>
  // options:
  //   primarySource: PDFDocument  — source to copy metadata from
  //   mergeMode: boolean          — nest per-source bookmarks under a file-named parent
  //   sourceNames: Map<PDFDocument, string>  — display names for merge parent bookmarks
  // ============================================================================
  async function finalize(destDoc, pageMap, options = {}) {
    installCopyPagesHook();

    // 1. Remap internal link annotations
    remapPageAnnotations(destDoc, pageMap, options);

    // 2. Rebuild bookmarks (Outlines)
    remapOutlines(destDoc, pageMap, options);

    // 3. Copy metadata from primary source
    const primarySource = options.primarySource || Array.from(pageMap.keys())[0];
    if (primarySource) {
      copyMetadata(destDoc, primarySource);
    }

    // 4. Purge unreachable objects to ensure 0 ghost pages
    const removedCount = purgeUnreachableObjects(destDoc);

    return { removedObjects: removedCount };
  }

  // ============================================================================
  // Expose
  // ============================================================================
  globalObj.PDFTools.PdfCopy = {
    finalize,
    purgeUnreachableObjects,
    sanitizeLinkTargets,
    installCopyPagesHook
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFTools.PdfCopy;
}
