// Shared ExcelJS helpers for the payroll .xlsx exports.
// Goal: every column/cell fully visible (auto-fit widths) and a clean table layout.

function colLetter(n) {
  let s = ''
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}

// Approximate the rendered text of a cell (handles formulas, rich text, currency/percent formats).
function cellText(cell) {
  let v = cell.value
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('richText' in v)      v = v.richText.map(t => t.text).join('')
    else if ('result' in v)   v = v.result
    else if ('formula' in v)  v = v.result ?? ''
    else if ('text' in v)     v = v.text
    else                      return ''
  }
  if (v == null) return ''
  const fmt = cell.numFmt || ''
  if (typeof v === 'number') {
    if (fmt.includes('%')) {
      return (v * 100).toFixed(fmt.includes('0.0') ? 1 : 0) + '%'
    }
    if (fmt.includes('#,##0') || fmt.includes('$')) {
      const dec = fmt.includes('.00') ? 2 : 0
      let t = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: 2 })
      if (fmt.includes('$')) t = '$' + t
      if (v < 0) t = '-' + t
      return t
    }
  }
  return String(v)
}

// Resize every column so its widest (non-merged) cell is fully visible.
// Widths are font-size aware and clamped to [min, max].
export function autoFitColumns(ws, { min = 8, max = 70, padding = 2 } = {}) {
  const widths = {}
  ws.eachRow({ includeEmpty: false }, row => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (cell.isMerged) return            // skip merged title/banner cells
      const text = cellText(cell)
      if (!text) return
      const longest = Math.max(...String(text).split('\n').map(l => l.length))
      const size = (cell.font && cell.font.size) || 11
      let len = longest * (size / 11)
      if (cell.font && cell.font.bold) len *= 1.06
      widths[colNumber] = Math.max(widths[colNumber] || 0, len)
    })
  })
  Object.entries(widths).forEach(([col, len]) => {
    ws.getColumn(Number(col)).width = Math.min(max, Math.max(min, Math.ceil(len) + padding))
  })
}

// Merge a row's cells across the full table width (used for title / section banners).
export function mergeAcross(ws, rowNumber, colCount) {
  if (colCount < 2) return
  ws.mergeCells(`A${rowNumber}:${colLetter(colCount)}${rowNumber}`)
}

// Turn a header+body region into a filterable Excel table region and freeze the header.
export function makeTableRegion(ws, headerRow, dataEndRow, colCount) {
  if (dataEndRow < headerRow) return
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to:   { row: dataEndRow, column: colCount },
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow }]
}
