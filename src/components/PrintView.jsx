import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
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

function downloadExcel({ project, folder, slot, payroll, posIdx, isExtra, crewName, period, activeItems, discounts, subtotal, total, columns, rows }) {
  const wb = XLSX.utils.book_new()

  // ── Payroll sheet ─────────────────────────────────────────────────────────
  const payrollData = []
  payrollData.push(['DC Cable — Payroll', '', '', '', '', ''])
  payrollData.push([project.name, '', '', '', '', ''])
  payrollData.push([folder.name, '', '', '', '', ''])
  payrollData.push(['Position', slot.label, '', 'Period', period, ''])
  payrollData.push(['Crew', crewName, '', '', '', ''])
  payrollData.push([])
  payrollData.push(['Code', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'])

  activeItems.forEach(it => {
    const qty = isExtra ? it.extraSlots?.[slot.id]?.qty : it[`qty${posIdx}`]
    const amt = isExtra ? it.extraSlots?.[slot.id]?.amt : it[`amt${posIdx}`]
    const rate = it[`rate${posIdx}`]
    payrollData.push([it.code || '', it.label, it.unit || '', parseFloat(qty) || 0, parseFloat(rate) || 0, parseFloat(amt) || 0])
  })

  payrollData.push([])
  if (discounts.length > 0) {
    payrollData.push(['', '', '', '', 'Subtotal', parseFloat(subtotal) || 0])
    discounts.filter(d => d.label || d.amount).forEach(d => {
      payrollData.push(['', '', '', '', d.label || 'Discount', -(parseFloat(d.amount) || 0)])
    })
  }
  payrollData.push(['', '', '', '', `Total — ${slot.label}`, parseFloat(total) || 0])

  const wsPayroll = XLSX.utils.aoa_to_sheet(payrollData)
  wsPayroll['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsPayroll, 'Payroll')

  // ── Production Data sheet ─────────────────────────────────────────────────
  if (columns.length > 0 && rows.length > 0) {
    const prodData = [columns.map(c => c.name)]
    rows.forEach(row => prodData.push(columns.map(c => row[c.id] ?? '')))

    // Sums row
    const sums = columns.map(col => {
      const nonempty = rows.filter(r => r[col.id] !== '' && r[col.id] != null)
      const nums = nonempty.map(r => parseFloat(r[col.id]))
      return nums.length > 0 && nums.every(n => !isNaN(n)) ? nums.reduce((a, b) => a + b, 0) : ''
    })
    prodData.push(sums)

    const wsProd = XLSX.utils.aoa_to_sheet(prodData)
    wsProd['!cols'] = columns.map(() => ({ wch: 14 }))
    XLSX.utils.book_append_sheet(wb, wsProd, 'Production Data')
  }

  const safePeriod = (period || '').replace(/[/\\:*?"<>|]/g, '-').trim() || 'payroll'
  XLSX.writeFile(wb, `${crewName}---${project.name}---${safePeriod}.xlsx`)
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
          <button className={s.btnExcel} onClick={() => downloadExcel({ project, folder, slot, payroll, posIdx, isExtra, crewName, period, activeItems, discounts, subtotal, total, columns, rows })}>⬇ Excel</button>
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
