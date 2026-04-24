import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import s from './PrintView.module.css'

const POS_COLOR = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }
const POS_IDX   = { primero: '1',       segundo: '2',       tercero: '3'       }

function fmtMoney(n) {
  if (n == null || n === '') return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeRows(rows, key) {
  if (!rows) return []
  if (Array.isArray(rows)) return key === 'primero' ? rows : []
  return rows[key] || []
}

async function downloadExcel({ project, folder, slot, payroll, posIdx, isExtra, crewName, period, activeItems, discounts, subtotal, total, columns, rows, color }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DC Cable Payroll Manager'

  const hexColor = (color || '#3949ab').replace('#', '').toUpperCase()
  const dark = '1A1A2E'
  const lightGray = 'F8F8F8'
  const headerText = 'B0BAD4'

  function applyBorder(cell, style = 'thin') {
    const b = { style, color: { argb: 'FFE0E0E0' } }
    cell.border = { top: b, left: b, bottom: b, right: b }
  }
  function darkHeader(row) {
    row.height = 22
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + dark } }
      cell.font = { bold: true, color: { argb: 'FF' + headerText }, size: 10, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      applyBorder(cell)
    })
  }

  // ── Payroll sheet ─────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Payroll')
  ws.columns = [
    { width: 10 }, { width: 34 }, { width: 8 }, { width: 10 }, { width: 14 }, { width: 16 },
  ]

  // Company title
  const r1 = ws.addRow(['DC Cable — Payroll Manager'])
  r1.height = 28
  r1.getCell(1).font = { bold: true, size: 18, color: { argb: 'FF' + dark }, name: 'Arial' }

  // Project / folder
  const r2 = ws.addRow([project.name])
  r2.getCell(1).font = { bold: true, size: 13, name: 'Arial' }
  const r3 = ws.addRow([folder.name])
  r3.getCell(1).font = { size: 11, color: { argb: 'FF888888' }, name: 'Arial' }

  ws.addRow([])

  // Meta info
  const meta = ws.addRow(['Position', slot.label, '', 'Period', period])
  meta.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
  meta.getCell(2).font = { bold: true, size: 10, color: { argb: 'FF' + hexColor }, name: 'Arial' }
  meta.getCell(4).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }

  const crewRow = ws.addRow(['Crew', crewName])
  crewRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
  crewRow.getCell(2).font = { bold: true, size: 11, name: 'Arial' }

  ws.addRow([])

  // Column headers
  darkHeader(ws.addRow(['Code', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']))

  // Item rows
  activeItems.forEach((it, i) => {
    const qty = isExtra ? it.extraSlots?.[slot.id]?.qty : it[`qty${posIdx}`]
    const amt = isExtra ? it.extraSlots?.[slot.id]?.amt : it[`amt${posIdx}`]
    const rate = it[`rate${posIdx}`]
    const row = ws.addRow([it.code || '', it.label, it.unit || '', parseFloat(qty) || 0, parseFloat(rate) || 0, parseFloat(amt) || 0])
    row.height = 18
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + lightGray } } })
    row.getCell(1).font = { bold: true, color: { argb: 'FF' + hexColor }, size: 10, name: 'Arial' }
    row.getCell(5).numFmt = '$#,##0.00'
    row.getCell(6).numFmt = '$#,##0.00'
    row.eachCell(c => applyBorder(c))
  })

  ws.addRow([])

  // Subtotal + discounts
  const medBorder = { style: 'medium', color: { argb: 'FF' + dark } }
  if (discounts.some(d => d.label || d.amount)) {
    const sr = ws.addRow(['', '', '', '', 'Subtotal', parseFloat(subtotal) || 0])
    sr.getCell(5).font = { size: 11, color: { argb: 'FF555555' }, name: 'Arial' }
    sr.getCell(6).numFmt = '$#,##0.00'
    discounts.filter(d => d.label || d.amount).forEach(d => {
      const dr = ws.addRow(['', '', '', '', d.label || 'Discount', -(parseFloat(d.amount) || 0)])
      dr.getCell(5).font = { size: 11, color: { argb: 'FFC0392B' }, name: 'Arial' }
      dr.getCell(6).font = { size: 11, color: { argb: 'FFC0392B' }, name: 'Arial' }
      dr.getCell(6).numFmt = '$#,##0.00'
    })
  }

  // Total row
  const tr = ws.addRow(['', '', '', '', `Total — ${slot.label}`, parseFloat(total) || 0])
  tr.height = 26
  tr.getCell(5).font = { bold: true, size: 13, name: 'Arial' }
  tr.getCell(5).border = { top: medBorder }
  tr.getCell(6).font = { bold: true, size: 16, color: { argb: 'FF' + hexColor }, name: 'Arial' }
  tr.getCell(6).numFmt = '$#,##0.00'
  tr.getCell(6).border = { top: medBorder }

  // ── Production Data sheet ─────────────────────────────────────────────────
  if (columns.length > 0 && rows.length > 0) {
    const ws2 = wb.addWorksheet('Production Data')
    ws2.columns = columns.map(c => ({ width: Math.max(14, c.name.length + 4) }))

    darkHeader(ws2.addRow(columns.map(c => c.name)))

    rows.forEach((row, i) => {
      const r = ws2.addRow(columns.map(c => {
        const v = row[c.id] ?? ''
        return v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : v
      }))
      r.height = 18
      if (i % 2 === 1) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + lightGray } } })
      r.eachCell(c => applyBorder(c))
    })

    // Sums row
    const sums = columns.map(col => {
      const nonempty = rows.filter(r => r[col.id] !== '' && r[col.id] != null)
      const nums = nonempty.map(r => parseFloat(r[col.id]))
      return nums.length > 0 && nums.every(n => !isNaN(n)) ? nums.reduce((a, b) => a + b, 0) : ''
    })
    const sumRow = ws2.addRow(sums)
    sumRow.height = 20
    sumRow.eachCell(cell => {
      cell.font = { bold: true, size: 11, name: 'Arial' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } }
      cell.border = { top: medBorder, bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }, left: { style: 'thin', color: { argb: 'FFE0E0E0' } }, right: { style: 'thin', color: { argb: 'FFE0E0E0' } } }
    })
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safePeriod = (period || '').replace(/[/\\:*?"<>|]/g, '-').trim() || 'payroll'
  a.href = url
  a.download = `${crewName}---${project.name}---${safePeriod}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// slot: { id, posKey, label, color, base }
export default function PrintView({ project, folder, slot, payroll, onClose }) {
  const posIdx  = POS_IDX[slot.posKey]
  const label   = slot.label
  const color   = slot.color || POS_COLOR[slot.posKey] || '#3949ab'
  const isExtra = !slot.base

  const crewName  = payroll?.crewNames?.[slot.id] || '—'
  const period    = payroll?.period || '—'

  const rawDisc   = payroll?.discounts
  const discounts = Array.isArray(rawDisc) ? rawDisc : (rawDisc?.[slot.id] || [])

  let subtotal, total
  if (isExtra) {
    subtotal = (payroll?.items || []).reduce((sum, it) => sum + (it.extraSlots?.[slot.id]?.amt || 0), 0)
    const disc = discounts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
    total = subtotal - disc
  } else {
    subtotal = payroll?.[`subtotal${posIdx}`] || 0
    total    = payroll?.[`total${posIdx}`]    || 0
  }

  const columns = project.columns || []
  const rows    = normalizeRows(payroll?.rows ?? folder.rows, slot.id)

  const activeItems = (payroll?.items || []).filter(it => {
    const q = isExtra ? it.extraSlots?.[slot.id]?.qty : it[`qty${posIdx}`]
    return q !== '' && q !== undefined && q !== null && parseFloat(q) !== 0
  })

  useEffect(() => {
    const prevTitle = document.title
    const safePeriod = (period || '').replace(/[/\\:*?"<>|]/g, '-').trim() || 'no-period'
    document.title = `${crewName}---${project.name}---${safePeriod}`
    document.body.classList.add('print-active')
    return () => {
      document.title = prevTitle
      document.body.classList.remove('print-active')
    }
  }, [])

  const content = (
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <span className={s.toolbarTitle}>{label} — {project.name} / {folder.name}</span>
        </div>
        <div className={s.toolbarRight}>
          <button className={s.btnExcel} onClick={() => downloadExcel({ project, folder, slot, payroll, posIdx, isExtra, crewName, period, activeItems, discounts, subtotal, total, columns, rows, color })}>⬇ Excel</button>
          <button className={s.btnPrint} onClick={() => window.print()}>🖨 Print / Save PDF</button>
          <button className={s.btnClose} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      <div className={s.pageWrap}>
        <div className={s.page}>

          {/* ── Header ── */}
          <div className={s.pageHeader}>
            <div className={s.headerLeft}>
              <div className={s.companyName}>DC Cable</div>
              <div className={s.projectName}>{project.name}</div>
              <div className={s.folderName}>{folder.name}</div>
            </div>
            <div className={s.headerRight}>
              <div className={s.positionBadge} style={{ color, borderColor: color }}>{label}</div>
              <div className={s.crewName}>{crewName}</div>
              <div className={s.period}>{period}</div>
            </div>
          </div>

          <div className={s.rule} />

          {/* ── Payroll ── */}
          <div className={s.sectionLabel}>Payroll</div>

          {activeItems.length === 0 ? (
            <p className={s.noData}>No payroll items entered for this position.</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.colCode}>Code</th>
                  <th>Description</th>
                  <th className={s.colCenter}>Unit</th>
                  <th className={s.colRight}>Qty</th>
                  <th className={s.colRight}>Rate</th>
                  <th className={s.colRight}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((it, i) => {
                  const qty = isExtra ? it.extraSlots?.[slot.id]?.qty : it[`qty${posIdx}`]
                  const amt = isExtra ? it.extraSlots?.[slot.id]?.amt : it[`amt${posIdx}`]
                  return (
                    <tr key={it.id || i} className={i % 2 === 1 ? s.rowAlt : ''}>
                      <td className={s.tdCode}>{it.code || '—'}</td>
                      <td>{it.label}</td>
                      <td className={s.tdCenter}>{it.unit || '—'}</td>
                      <td className={s.tdRight}>{qty}</td>
                      <td className={s.tdRight}>{fmtMoney(it[`rate${posIdx}`])}</td>
                      <td className={s.tdRight}>{fmtMoney(amt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className={s.totalsBlock}>
            {discounts.length > 0 && (
              <>
                <div className={s.totalLine}>
                  <span>Subtotal</span><span>{fmtMoney(subtotal)}</span>
                </div>
                {discounts.filter(d => d.label || d.amount).map((d, i) => (
                  <div key={i} className={s.totalLine} style={{ color: '#c0392b' }}>
                    <span>{d.label || 'Discount'}</span>
                    <span>−{fmtMoney(d.amount)}</span>
                  </div>
                ))}
              </>
            )}
            <div className={s.totalLineFinal}>
              <span>Total — {label}</span>
              <span style={{ color }}>{fmtMoney(total)}</span>
            </div>
          </div>

          <div className={s.rule} style={{ marginTop: 20 }} />

          {/* ── Production data ── */}
          <div className={s.sectionLabel}>Production Data — {label}</div>

          {rows.length === 0 ? (
            <p className={s.noData}>No production data entered for this position.</p>
          ) : (() => {
            const sumCols = {}
            columns.forEach(col => {
              const nonempty = rows.filter(r => r[col.id] !== '' && r[col.id] != null)
              if (nonempty.length === 0) return
              const nums = nonempty.map(r => parseFloat(r[col.id]))
              if (nums.every(n => !isNaN(n))) sumCols[col.id] = nums.reduce((a, b) => a + b, 0)
            })
            const hasSums = Object.keys(sumCols).length > 0
            return (
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>{columns.map(c => <th key={c.id}>{c.name}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id || i} className={i % 2 === 1 ? s.rowAlt : ''}>
                        {columns.map(c => <td key={c.id}>{row[c.id] ?? ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  {hasSums && (
                    <tfoot>
                      <tr>
                        {columns.map(c => (
                          <td key={c.id} className={s.sumCell}>
                            {sumCols[c.id] !== undefined ? Number(sumCols[c.id]).toLocaleString('en-US') : ''}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          })()}

          {/* ── Signature line ── */}
          <div className={s.signatureRow}>
            <div className={s.signatureBlock}>
              <div className={s.signatureLine} />
              <div className={s.signatureLabel}>Signature — {label}</div>
            </div>
            <div className={s.signatureBlock}>
              <div className={s.signatureLine} />
              <div className={s.signatureLabel}>Date</div>
            </div>
          </div>

          <div className={s.pageFooter}>
            <span>DC Cable Payroll Manager · {project.name}</span>
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
