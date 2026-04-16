import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import s from './PrintView.module.css'

const POS_LABEL = { primero: 'Primero', segundo: 'Segundo', tercero: 'Tercero' }
const POS_COLOR = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }

function fmtMoney(n) {
  if (n == null || n === '') return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeRows(rows, pos) {
  if (!rows) return []
  if (Array.isArray(rows)) return pos === 'primero' ? rows : []
  return rows[pos] || []
}

export default function PrintView({ project, folder, position, payroll, onClose }) {
  const posIdx   = { primero: '1', segundo: '2', tercero: '3' }[position]
  const label    = POS_LABEL[position]
  const color    = POS_COLOR[position]

  const crewName = payroll?.crewNames?.[position] || '—'
  const period   = payroll?.period || '—'
  // Support both per-position object and legacy flat array
  const rawDisc  = payroll?.discounts
  const discounts = Array.isArray(rawDisc) ? rawDisc : (rawDisc?.[position] || [])
  const subtotal     = payroll?.[`subtotal${posIdx}`] || 0
  const total        = payroll?.[`total${posIdx}`] || 0

  const columns = project.columns || []
  const rows    = normalizeRows(folder.rows, position)

  const activeItems = (payroll?.items || []).filter(it => {
    const q = it[`qty${posIdx}`]
    return q !== '' && q !== undefined && q !== null && parseFloat(q) !== 0
  })

  // Add/remove body class so @media print hides #root
  // Also set document.title so the browser uses it as the PDF filename
  useEffect(() => {
    const prevTitle = document.title
    const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    document.title = `${crewName}---${project.name}---${dateStr}`
    document.body.classList.add('print-active')
    return () => {
      document.title = prevTitle
      document.body.classList.remove('print-active')
    }
  }, [])

  const content = (
    <div className={s.overlay}>
      {/* Toolbar — hidden when printing */}
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <span className={s.toolbarTitle}>{label} — {project.name} / {folder.name}</span>
        </div>
        <div className={s.toolbarRight}>
          <button className={s.btnPrint} onClick={() => window.print()}>🖨 Print / Save PDF</button>
          <button className={s.btnClose} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      {/* Scrollable preview area */}
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
                {activeItems.map((it, i) => (
                  <tr key={it.id || i} className={i % 2 === 1 ? s.rowAlt : ''}>
                    <td className={s.tdCode}>{it.code || '—'}</td>
                    <td>{it.label}</td>
                    <td className={s.tdCenter}>{it.unit || '—'}</td>
                    <td className={s.tdRight}>{it[`qty${posIdx}`]}</td>
                    <td className={s.tdRight}>{fmtMoney(it[`rate${posIdx}`])}</td>
                    <td className={s.tdRight}>{fmtMoney(it[`amt${posIdx}`])}</td>
                  </tr>
                ))}
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
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  {columns.map(c => <th key={c.id}>{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id || i} className={i % 2 === 1 ? s.rowAlt : ''}>
                    {columns.map(c => <td key={c.id}>{row[c.id] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

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
