export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

/** Escape JSON for an HTML script text node, including closing-script sequences. */
export function inlineJson(value) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (char) =>
      ({
        '<': '\\u003c',
        '>': '\\u003e',
        '&': '\\u0026',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029',
      })[char],
  );
}
