import s from './FolderPrint.module.css'

const POS_COLOR = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }
const POS_LABEL = { primero: 'Primero',  segundo: 'Segundo',  tercero: 'Tercero'  }
const POS_IDX   = { primero: '1',        segundo: '2',        tercero: '3'        }

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Build a flat list of all crew slots across all payrolls
function buildCrewSlots(payrolls) {
  const slots = []
  payrolls.forEach(pr => {
    const baseDefs = ['primero', 'segundo', 'tercero'].map(pos => ({
      id: pos, posKey: pos, label: POS_LABEL[pos], color: POS_COLOR[pos], base: true,
    }))
    const extraDefs = (pr.extraSlots || [])

    ;[...baseDefs, ...extraDefs].forEach(slot => {
      const crewName = pr.crewNames?.[slot.id]
      if (!crewName) return
      const color = slot.color || POS_COLOR[slot.posKey] || '#3949ab'

      let subtotal, deductions, total
      if (slot.base) {
        const idx = POS_IDX[slot.id]
        subtotal   = pr[`subtotal${idx}`] || 0
        deductions = pr[`totalDisc${idx}`] || 0
        total      = pr[`total${idx}`] || 0
      } else {
        subtotal   = (pr.items || []).reduce((s, it) => s + (it.extraSlots?.[slot.id]?.amt || 0), 0)
        deductions = (pr.discounts?.[slot.id] || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
        total      = subtotal - deductions
      }
      if (!subtotal && !total) return

      slots.push({
        payrollId: pr.id, period: pr.period,
        slotId: slot.id, posKey: slot.posKey || slot.id,
        label: slot.label, color,
        crewName, subtotal, deductions, total,
        items: pr.items || [],
        discountLines: pr.discounts?.[slot.id] || [],
        isExtra: !slot.base,
      })
    })
  })
  return slots
}

function ItemsTable({ items, slotId, posKey, isExtra }) {
  const posIdx = POS_IDX[posKey] || '1'
  const rows = items.filter(it => {
    const qty = isExtra ? it.extraSlots?.[slotId]?.qty : it[`qty${posIdx}`]
    const amt = isExtra ? it.extraSlots?.[slotId]?.amt : it[`amt${posIdx}`]
    return (parseFloat(qty) || 0) !== 0 || (parseFloat(amt) || 0) !== 0
  })
  if (!rows.length) return <p className={s.noItems}>No items recorded.</p>

  return (
    <table className={s.itemsTable}>
      <thead>
        <tr>
          <th>Code</th>
          <th>Description</th>
          <th className={s.tr}>Rate</th>
          <th className={s.tr}>Qty</th>
          <th className={s.tr}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((it, i) => {
          const rate = it[`rate${posIdx}`]
          const qty  = isExtra ? it.extraSlots?.[slotId]?.qty : it[`qty${posIdx}`]
          const amt  = isExtra ? it.extraSlots?.[slotId]?.amt : it[`amt${posIdx}`]
          return (
            <tr key={i} className={i % 2 === 1 ? s.rowAlt : ''}>
              <td className={s.code}>{it.code || '—'}</td>
              <td>{it.label}</td>
              <td className={s.tr}>{rate != null ? fmtMoney(rate) : '—'}</td>
              <td className={s.tr}>{qty || '—'}</td>
              <td className={`${s.tr} ${s.amtCell}`}>{fmtMoney(amt)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function FolderPrint({ project, folder, payrolls, onClose }) {
  const crews = buildCrewSlots(payrolls)
  const grandTotal = crews.reduce((s, c) => s + c.total, 0)
  const hasAnyDisc = crews.some(c => c.deductions > 0)

  function handlePrint() { window.print() }

  if (!payrolls.length) return (
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <span className={s.toolbarTitle}>No payrolls to print</span>
        <button className={s.btnClose} onClick={onClose}>✕ Close</button>
      </div>
    </div>
  )

  return (
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <div className={s.toolbarTitle}>Full Report — {folder.name}</div>
        <div className={s.toolbarRight}>
          <button className={s.btnPrint} onClick={handlePrint}>🖨 Print</button>
          <button className={s.btnClose} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      <div className={s.pageWrap}>
        <div className={s.page}>

          {/* ── Header ── */}
          <div className={s.pageHeader}>
            <div className={s.headerLeft}>
              <div className={s.companyName}>DC <span>Cable</span></div>
              <div className={s.projectName}>{project.name}</div>
              <div className={s.folderName}>{folder.name}</div>
            </div>
            <div className={s.headerRight}>
              <div className={s.docTitle}>Full Payroll Report</div>
              <div className={s.docSub}>{payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''} · {crews.length} crew member{crews.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <hr className={s.rule} />

          {/* ── Summary table ── */}
          <div className={s.sectionLabel}>Summary</div>
          <table className={s.summaryTable}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Position</th>
                <th>Crew Member</th>
                {hasAnyDisc && <th className={s.tr}>Gross</th>}
                {hasAnyDisc && <th className={s.tr}>Deductions</th>}
                <th className={s.tr}>Net Pay</th>
              </tr>
            </thead>
            <tbody>
              {crews.map((c, i) => (
                <tr key={`${c.payrollId}-${c.slotId}`} className={i % 2 === 1 ? s.rowAlt : ''}>
                  <td className={s.periodCell}>{c.period || '—'}</td>
                  <td><span className={s.posBadge} style={{ color: c.color, borderColor: c.color }}>{c.label}</span></td>
                  <td className={s.crewCell}>{c.crewName}</td>
                  {hasAnyDisc && <td className={s.tr}>{fmtMoney(c.subtotal)}</td>}
                  {hasAnyDisc && <td className={`${s.tr} ${c.deductions > 0 ? s.discCell : ''}`}>{c.deductions > 0 ? `−${fmtMoney(c.deductions)}` : '—'}</td>}
                  <td className={`${s.tr} ${s.totalCell}`} style={{ color: c.color }}>{fmtMoney(c.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hasAnyDisc ? 3 : 3} className={s.sumLabel}>Total Payroll</td>
                {hasAnyDisc && <td className={`${s.tr} ${s.sumCell}`}>{fmtMoney(crews.reduce((s, c) => s + c.subtotal, 0))}</td>}
                {hasAnyDisc && <td className={`${s.tr} ${s.sumCell}`}>−{fmtMoney(crews.reduce((s, c) => s + c.deductions, 0))}</td>}
                <td className={`${s.tr} ${s.sumCell} ${s.grandTotal}`}>{fmtMoney(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>

          <hr className={s.rule} />

          {/* ── Individual payrolls ── */}
          <div className={s.sectionLabel}>Individual Payrolls</div>

          {crews.map((c, i) => (
            <div key={`detail-${c.payrollId}-${c.slotId}`} className={s.crewSection}>
              <div className={s.crewHeader}>
                <div className={s.crewHeaderLeft}>
                  <span className={s.crewPosBadge} style={{ background: c.color, color: '#fff' }}>{c.label}</span>
                  <span className={s.crewName}>{c.crewName}</span>
                </div>
                <div className={s.crewHeaderRight}>
                  {c.period && <span className={s.crewPeriod}>{c.period}</span>}
                </div>
              </div>

              <ItemsTable items={c.items} slotId={c.slotId} posKey={c.posKey} isExtra={c.isExtra} />

              {c.discountLines.length > 0 && (
                <div className={s.deductionsBlock}>
                  {c.discountLines.map((d, di) => (
                    <div key={di} className={s.deductionRow}>
                      <span>{d.label || 'Deduction'}</span>
                      <span className={s.deductionAmt}>−{fmtMoney(parseFloat(d.amount) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={s.crewTotals}>
                {c.deductions > 0 && (
                  <>
                    <div className={s.crewTotalLine}>
                      <span>Gross</span><span>{fmtMoney(c.subtotal)}</span>
                    </div>
                    <div className={s.crewTotalLine}>
                      <span>Deductions</span><span className={s.discCell}>−{fmtMoney(c.deductions)}</span>
                    </div>
                  </>
                )}
                <div className={s.crewNetLine}>
                  <span>Net Pay</span>
                  <span style={{ color: c.color }}>{fmtMoney(c.total)}</span>
                </div>
              </div>

              {i < crews.length - 1 && <div className={s.crewDivider} />}
            </div>
          ))}

          <div className={s.pageFooter}>
            <span>DC Cable — Payroll Manager</span>
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
