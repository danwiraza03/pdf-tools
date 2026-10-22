# 🤖 AGENTS.md — Mandatory Instructions for AI Coding Assistants

> **CRITICAL INSTRUCTION FOR ALL AI AGENTS & ASSISTANTS:**
> Before inspecting, modifying, generating, or refactoring ANY code in this repository, you **MUST** first view and strictly adhere to:
> 
> 👉 **[PROJECT_RULES.md](PROJECT_RULES.md)**
> 
> `PROJECT_RULES.md` is the **Single Source of Truth** for:
> 1. **Zero-Server Client-Side Guarantee**: All processing must remain 100% offline in browser (PDF-Lib, PDF.js, JSZip).
> 2. **Strict Icon Standard**: **NO crude emojis** (`📁`, `📄`, `🗑️`, `🔄`, `✂️`, `🔒`, `✨`, `✓`, etc.) in buttons, headers, dropzones, badges, or modals. **ALWAYS** use inline vector SVGs with `viewBox="0 0 24 24"` and `stroke="currentColor"`.
> 3. **Design Tokens & Theme Colors**: Maintain exact `--tool-color` HEX codes and dual-theme compatibility (Sleek Slate Dark & Clean Light).
> 4. **PDF Studio In-Memory Workflow**: All document tools inside `pages/viewer.html` must apply directly to `currentDoc` in-memory with live canvas refresh. Never trigger intermediate downloads. The only download must occur on the final "Save PDF" button.
> 5. **Bilingual i18n Rules**: Never place emojis inside `js/utils/i18n.js` translation strings. Always update both English (`en`) and Indonesian (`id`) dictionaries.
> 6. **Consistent Standalone Page Structure**: Header -> Tool Hero with SVG badge -> Dropzone with SVG Cloud -> Workspace State -> Action Bar -> Result with SVG checkmark -> "Open in PDF Studio" secondary action.

Any agent failing to adhere to `PROJECT_RULES.md` will produce inconsistent UI that violates the project standards.
