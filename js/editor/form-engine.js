/**
 * Form Engine (AcroForms)
 * Manages detection, creation, updating, and serialization of interactive PDF Form Fields.
 */

class FormEngine {
  /**
   * Create a new form field descriptor
   * @param {string} type 'text'|'checkbox'|'radio'|'dropdown'|'button'|'signature'
   * @param {Object} data Field properties
   */
  static createField(type, data = {}) {
    return {
      id: data.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: data.name || `Field_${type}_${Date.now().toString().slice(-4)}`,
      type: type,
      pageNumber: data.pageNumber || 1,
      x: data.x || 50,
      y: data.y || 50,
      width: data.width || (type === 'checkbox' || type === 'radio' ? 20 : (type === 'signature' ? 140 : 120)),
      height: data.height || (type === 'checkbox' || type === 'radio' ? 20 : (type === 'signature' ? 40 : 26)),
      value: data.value !== undefined ? data.value : (type === 'checkbox' ? false : ''),
      defaultValue: data.defaultValue || '',
      options: data.options || (type === 'dropdown' ? ['Option 1', 'Option 2', 'Option 3'] : []),
      required: !!data.required,
      readOnly: !!data.readOnly,
      fontSize: data.fontSize || 12,
      fontFamily: data.fontFamily || 'Helvetica',
      color: data.color || '#1F2937',
      backgroundColor: data.backgroundColor || '#F9FAFB',
      borderColor: data.borderColor || '#9CA3AF'
    };
  }

  /**
   * Apply form fields into PDF-Lib document during export
   * @param {Object} pdfDoc PDFDocument
   * @param {Array<Object>} formFields
   */
  static async bakeFormFields(pdfDoc, formFields) {
    if (!formFields || formFields.length === 0) return;
    try {
      const form = pdfDoc.getForm();
      const pages = pdfDoc.getPages();

      for (const field of formFields) {
        const pageIndex = Math.max(0, (field.pageNumber || 1) - 1);
        if (pageIndex >= pages.length) continue;
        const page = pages[pageIndex];
        const { height: pdfHeight } = page.getSize();

        // Convert coordinates (top-left to bottom-left)
        const fx = field.x;
        const fy = pdfHeight - (field.y + field.height);

        try {
          if (field.type === 'text') {
            const tf = form.createTextField(field.name);
            tf.setText(field.value ? String(field.value) : '');
            tf.addToPage(page, { x: fx, y: fy, width: field.width, height: field.height });
            if (field.readOnly) tf.enableReadOnly();
            if (field.required) tf.enableRequired();
          } else if (field.type === 'checkbox') {
            const cb = form.createCheckBox(field.name);
            if (field.value === true || field.value === 'true') cb.check();
            cb.addToPage(page, { x: fx, y: fy, width: field.width, height: field.height });
            if (field.readOnly) cb.enableReadOnly();
          } else if (field.type === 'dropdown') {
            const dd = form.createDropdown(field.name);
            dd.setOptions(field.options || ['Option 1']);
            if (field.value) dd.select(field.value);
            dd.addToPage(page, { x: fx, y: fy, width: field.width, height: field.height });
            if (field.readOnly) dd.enableReadOnly();
          } else if (field.type === 'button') {
            const btn = form.createButton(field.name);
            btn.addToPage(page, { x: fx, y: fy, width: field.width, height: field.height });
          }
        } catch (fErr) {
          console.warn('Field creation warning for:', field.name, fErr);
        }
      }
    } catch (err) {
      console.warn('Form baking warning:', err);
    }
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.FormEngine = FormEngine;
