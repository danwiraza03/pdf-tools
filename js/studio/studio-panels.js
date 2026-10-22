/**
 * PDF Tools — PDF Studio Sidebar Panels (Bookmarks & Attachments)
 * Manages left sidebar panel switching, bookmarks tree hierarchy, and embedded attachments.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioPanels = (function () {
  let ctx = null;

  function init(context) {
    ctx = context;
    bindEventListeners();
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : (window.PDFTools.StudioApp ? window.PDFTools.StudioApp.currentDoc : null);
  }

  function scheduleRecovery() {
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
  }

  function navigateToPage(targetPageNum) {
    if (ctx && ctx.navigateToPage) {
      ctx.navigateToPage(targetPageNum);
    }
  }

  // --- Left Sidebar Switcher & Panel Toggles ---
  function setActiveSidebar(sidebarId) {
    const sidebars = [
      { id: 'thumbnails', el: document.getElementById('thumbnailSidebar'), btn: document.getElementById('toggleThumbStrip') },
      { id: 'bookmarks', el: document.getElementById('bookmarksSidebar'), btn: document.getElementById('toggleBookmarksStrip') },
      { id: 'attachments', el: document.getElementById('attachmentsSidebar'), btn: document.getElementById('toggleAttachmentsStrip') }
    ];

    sidebars.forEach(s => {
      if (s.id === sidebarId) {
        const isCurrentlyOpen = s.el && s.el.style.display !== 'none';
        if (isCurrentlyOpen) {
          if (s.el) s.el.style.display = 'none';
          s.btn?.classList.remove('active');
        } else {
          if (s.el) s.el.style.display = 'flex';
          s.btn?.classList.add('active');
        }
      } else {
        if (s.el) s.el.style.display = 'none';
        s.btn?.classList.remove('active');
      }
    });
  }

  // --- Bookmarks Logic ---
  function buildSidebarBookmarks() {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    if (!bookmarksContainer) return;
    bookmarksContainer.innerHTML = '';
    const currentDoc = getDoc();
    if (!currentDoc) return;

    if (!currentDoc.bookmarks || currentDoc.bookmarks.length === 0) {
      bookmarksContainer.innerHTML = `
        <div class="acrobat-empty-sidebar">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <div>
            <div style="font-weight: 700; color: var(--acrobat-text); margin-bottom: 4px;">No Bookmarks Found</div>
            <div style="font-size: 0.76rem; line-height: 1.4;">This document has no outline. You can bookmark any page for instant navigation.</div>
          </div>
          <button type="button" class="acrobat-btn" id="emptyAddBookmarkBtn" style="border: 1px solid var(--acrobat-border); background: var(--acrobat-sidebar-bg); padding: 6px 12px; border-radius: 4px; font-weight: 600;">
            + Add Bookmark for Page ${currentDoc.currentPage}
          </button>
        </div>
      `;
      document.getElementById('emptyAddBookmarkBtn')?.addEventListener('click', promptAddBookmark);
      return;
    }

    function deleteBookmarkById(list, id) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          list.splice(i, 1);
          return true;
        }
        if (list[i].items && list[i].items.length > 0) {
          if (deleteBookmarkById(list[i].items, id)) return true;
        }
      }
      return false;
    }

    function renderTree(items, container) {
      items.forEach(bm => {
        const itemEl = document.createElement('div');
        itemEl.className = 'acrobat-tree-item';

        const rowEl = document.createElement('div');
        rowEl.className = `acrobat-bookmark-row ${bm.pageNum === currentDoc.currentPage ? 'active' : ''}`;
        rowEl.dataset.page = bm.pageNum;
        rowEl.dataset.id = bm.id;

        const hasChildren = bm.items && bm.items.length > 0;
        const expandIcon = hasChildren ? '▾' : '•';

        const safeTitle = (bm.title || 'Untitled').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        rowEl.innerHTML = `
          <span class="acrobat-bm-expand" style="font-size: 0.72rem; width: 12px; color: var(--acrobat-text-muted); cursor: pointer; text-align: center;">${expandIcon}</span>
          <span class="acrobat-bookmark-icon" style="display: flex; align-items: center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
          </span>
          <span class="acrobat-bookmark-title" title="${safeTitle}">${safeTitle}</span>
          <span class="acrobat-bookmark-page-badge">p.${bm.pageNum || 1}</span>
          <div class="acrobat-bookmark-actions">
            <button type="button" class="acrobat-bookmark-btn bm-edit" title="Rename Bookmark">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="acrobat-bookmark-btn bm-delete" title="Delete Bookmark">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;

        rowEl.addEventListener('click', (e) => {
          if (e.target.closest('.acrobat-bookmark-actions')) return;
          if (e.target.classList.contains('acrobat-bm-expand') && hasChildren) {
            const subTree = itemEl.querySelector('.acrobat-sub-tree');
            if (subTree) {
              const isHidden = subTree.style.display === 'none';
              subTree.style.display = isHidden ? 'flex' : 'none';
              e.target.textContent = isHidden ? '▾' : '▸';
            }
            return;
          }
          navigateToPage(bm.pageNum || 1);
          updateBookmarkActiveState();
        });

        rowEl.querySelector('.bm-edit')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          let newTitle = bm.title;
          if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.prompt) {
            newTitle = await window.PDFTools.Modal.prompt('Edit Bookmark Title:', bm.title, { title: 'Edit Bookmark' });
          }
          if (newTitle && newTitle.trim()) {
            bm.title = newTitle.trim();
            scheduleRecovery();
            buildSidebarBookmarks();
          }
        });

        // Delete
        rowEl.querySelector('.bm-delete')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          let ok = true;
          if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.confirm) {
            ok = await window.PDFTools.Modal.confirm(`Delete bookmark "${bm.title}"?`, { isDanger: true });
          }
          if (ok) {
            deleteBookmarkById(currentDoc.bookmarks, bm.id);
            scheduleRecovery();
            buildSidebarBookmarks();
            if (window.PDFTools && window.PDFTools.Toast) {
              window.PDFTools.Toast.info('Bookmark deleted.');
            }
          }
        });

        itemEl.appendChild(rowEl);

        if (hasChildren) {
          const subTree = document.createElement('div');
          subTree.className = 'acrobat-sub-tree';
          renderTree(bm.items, subTree);
          itemEl.appendChild(subTree);
        }

        container.appendChild(itemEl);
      });
    }

    renderTree(currentDoc.bookmarks, bookmarksContainer);
  }

  function updateBookmarkActiveState() {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const currentDoc = getDoc();
    if (!bookmarksContainer || !currentDoc) return;
    bookmarksContainer.querySelectorAll('.acrobat-bookmark-row').forEach(row => {
      const pageNum = parseInt(row.dataset.page, 10);
      row.classList.toggle('active', pageNum === currentDoc.currentPage);
    });
  }

  async function promptAddBookmark() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error('Please open a PDF document first.');
      }
      return;
    }
    const curPage = currentDoc.currentPage || 1;
    let title = `Page ${curPage} - Bookmark`;
    if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.prompt) {
      title = await window.PDFTools.Modal.prompt(`Enter title for Bookmark on Page ${curPage}:`, `Page ${curPage} - Bookmark`, { title: 'Add Bookmark' });
    }
    if (title && title.trim()) {
      currentDoc.bookmarks = currentDoc.bookmarks || [];
      currentDoc.bookmarks.push({
        id: 'bm_' + Math.random().toString(36).substr(2, 9),
        title: title.trim(),
        pageNum: curPage,
        items: []
      });
      currentDoc.bookmarks.sort((a, b) => (a.pageNum || 1) - (b.pageNum || 1));
      scheduleRecovery();
      buildSidebarBookmarks();
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success(`Bookmark added for Page ${curPage}!`);
      }
    }
  }

  // --- Attachments Logic ---
  function formatAttachmentSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getAttachmentFileIcon(filename) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  }

  function buildSidebarAttachments() {
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    if (!attachmentsContainer) return;
    attachmentsContainer.innerHTML = '';
    const currentDoc = getDoc();
    if (!currentDoc) return;

    if (!currentDoc.attachments || currentDoc.attachments.length === 0) {
      attachmentsContainer.innerHTML = `
        <div class="acrobat-empty-sidebar">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          <div>
            <div style="font-weight: 700; color: var(--acrobat-text); margin-bottom: 4px;">No File Attachments</div>
            <div style="font-size: 0.76rem; line-height: 1.4;">This document has no embedded files. You can attach any files to this PDF.</div>
          </div>
          <button type="button" class="acrobat-btn" id="emptyAddAttachmentBtn" style="border: 1px solid var(--acrobat-border); background: var(--acrobat-sidebar-bg); padding: 6px 12px; border-radius: 4px; font-weight: 600;">
            + Attach File to PDF
          </button>
        </div>
      `;
      document.getElementById('emptyAddAttachmentBtn')?.addEventListener('click', () => {
        document.getElementById('attachmentFileInput')?.click();
      });
      return;
    }

    currentDoc.attachments.forEach(att => {
      const card = document.createElement('div');
      card.className = 'acrobat-attachment-card';
      const formattedSize = formatAttachmentSize(att.size);
      const icon = getAttachmentFileIcon(att.name);
      const safeName = (att.name || 'file').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      card.innerHTML = `
        <div class="acrobat-attachment-info">
          <span class="acrobat-attachment-icon">${icon}</span>
          <div class="acrobat-attachment-details">
            <span class="acrobat-attachment-name" title="${safeName}">${safeName}</span>
            <span class="acrobat-attachment-size">${formattedSize}</span>
          </div>
        </div>
        <div class="acrobat-attachment-actions">
          <button type="button" class="acrobat-btn att-download-btn" title="Download & Save Attachment" style="padding: 4px 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </button>
          <button type="button" class="acrobat-btn att-delete-btn" title="Delete Attachment" style="padding: 4px 6px; color: #ef4444;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Download Action
      card.querySelector('.att-download-btn').addEventListener('click', () => {
        try {
          const blob = new Blob([att.data], { type: att.mimeType || 'application/octet-stream' });
          if (window.saveAs) {
            window.saveAs(blob, att.name);
          } else if (PDFTools.FileUtils && PDFTools.FileUtils.downloadBlob) {
            PDFTools.FileUtils.downloadBlob(blob, att.name);
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.success(`Downloaded "${att.name}"`);
          }
        } catch (err) {
          console.error('Download error:', err);
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.error('Failed to download attachment');
          }
        }
      });

      // Delete Action
      card.querySelector('.att-delete-btn').addEventListener('click', async () => {
        let ok = true;
        if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.confirm) {
          ok = await window.PDFTools.Modal.confirm(`Remove attachment "${att.name}" from this PDF?`, { isDanger: true });
        }
        if (ok) {
          currentDoc.attachments = currentDoc.attachments.filter(a => a.id !== att.id);
          scheduleRecovery();
          buildSidebarAttachments();
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info(`Attachment "${att.name}" removed.`);
          }
        }
      });

      attachmentsContainer.appendChild(card);
    });
  }

  function bindEventListeners() {
    const toggleThumbStrip = document.getElementById('toggleThumbStrip');
    const toggleBookmarksStrip = document.getElementById('toggleBookmarksStrip');
    const toggleAttachmentsStrip = document.getElementById('toggleAttachmentsStrip');
    const bookmarksSidebar = document.getElementById('bookmarksSidebar');
    const attachmentsSidebar = document.getElementById('attachmentsSidebar');
    const thumbnailSidebar = document.getElementById('thumbnailSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const closeBookmarksBtn = document.getElementById('closeBookmarksBtn');
    const closeAttachmentsBtn = document.getElementById('closeAttachmentsBtn');
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');
    const expandBookmarksBtn = document.getElementById('expandBookmarksBtn');
    const collapseBookmarksBtn = document.getElementById('collapseBookmarksBtn');
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const addAttachmentBtn = document.getElementById('addAttachmentBtn');
    const attachmentFileInput = document.getElementById('attachmentFileInput');

    toggleThumbStrip?.addEventListener('click', () => setActiveSidebar('thumbnails'));
    toggleBookmarksStrip?.addEventListener('click', () => {
      setActiveSidebar('bookmarks');
      if (bookmarksSidebar && bookmarksSidebar.style.display !== 'none') {
        buildSidebarBookmarks();
      }
    });
    toggleAttachmentsStrip?.addEventListener('click', () => {
      setActiveSidebar('attachments');
      if (attachmentsSidebar && attachmentsSidebar.style.display !== 'none') {
        buildSidebarAttachments();
      }
    });

    closeSidebarBtn?.addEventListener('click', () => {
      if (thumbnailSidebar) thumbnailSidebar.style.display = 'none';
      toggleThumbStrip?.classList.remove('active');
    });
    closeBookmarksBtn?.addEventListener('click', () => {
      if (bookmarksSidebar) bookmarksSidebar.style.display = 'none';
      toggleBookmarksStrip?.classList.remove('active');
    });
    closeAttachmentsBtn?.addEventListener('click', () => {
      if (attachmentsSidebar) attachmentsSidebar.style.display = 'none';
      toggleAttachmentsStrip?.classList.remove('active');
    });

    addBookmarkBtn?.addEventListener('click', promptAddBookmark);
    expandBookmarksBtn?.addEventListener('click', () => {
      if (!bookmarksContainer) return;
      bookmarksContainer.querySelectorAll('.acrobat-sub-tree').forEach(t => t.style.display = 'flex');
      bookmarksContainer.querySelectorAll('.acrobat-bm-expand').forEach(e => {
        if (e.textContent !== '•') e.textContent = '▾';
      });
    });
    collapseBookmarksBtn?.addEventListener('click', () => {
      if (!bookmarksContainer) return;
      bookmarksContainer.querySelectorAll('.acrobat-sub-tree').forEach(t => t.style.display = 'none');
      bookmarksContainer.querySelectorAll('.acrobat-bm-expand').forEach(e => {
        if (e.textContent !== '•') e.textContent = '▸';
      });
    });

    addAttachmentBtn?.addEventListener('click', () => {
      attachmentFileInput?.click();
    });

    attachmentFileInput?.addEventListener('change', async (e) => {
      const currentDoc = getDoc();
      if (!currentDoc || !e.target.files || e.target.files.length === 0) return;
      for (const file of Array.from(e.target.files)) {
        const arrayBuffer = await file.arrayBuffer();
        currentDoc.attachments = currentDoc.attachments || [];
        currentDoc.attachments.push({
          id: 'att_' + Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          data: new Uint8Array(arrayBuffer),
          creationDate: new Date(file.lastModified || Date.now())
        });
      }
      attachmentFileInput.value = '';
      scheduleRecovery();
      buildSidebarAttachments();
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success('File attached successfully!');
      }
    });
  }

  return {
    init,
    setActiveSidebar,
    buildSidebarBookmarks,
    updateBookmarkActiveState,
    promptAddBookmark,
    buildSidebarAttachments
  };
})();
