// Output encoders. Model text is untrusted: escape it for every target format.

/** HTML text and attribute values. */
export function html(v: unknown): string {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Markdown table cell: no pipes, no line breaks, no raw HTML. */
export function md(v: unknown): string {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '\\|')
    .replace(/[\r\n]+/g, ' ')
}

/**
 * CSV cell (RFC 4180) with spreadsheet formula-injection protection: cells that a spreadsheet
 * would evaluate (= + - @ tab CR) get a leading apostrophe.
 */
export function csv(v: unknown): string {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csv).join(',')
}

export function mdTable(head: string[], rows: unknown[][]): string {
  if (rows.length === 0) return '_None._\n'
  const line = (cells: unknown[]): string => `| ${cells.map(md).join(' | ')} |`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n') + '\n'
}
