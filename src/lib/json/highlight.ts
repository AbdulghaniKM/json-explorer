const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TOKENS =
  /("(?:\\u[\dA-Fa-f]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;

export const HIGHLIGHT_LIMIT = 150_000;

export const highlightJson = (text: string): string =>
  escapeHtml(text).replace(TOKENS, (match, str, colon, keyword, num) => {
    if (str) {
      if (colon) return `<span class="tok-key">${str}</span>${colon}`;
      return `<span class="tok-str">${str}</span>`;
    }
    if (keyword)
      return `<span class="tok-${keyword === 'null' ? 'null' : 'bool'}">${keyword}</span>`;
    if (num) return `<span class="tok-num">${num}</span>`;
    return match;
  });
