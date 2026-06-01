const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export const escapeHTML = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPE[ch]);
