import s from './SummaryPrint.module.css'

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SummaryPrint({ project, folder, summary, onClose }) {
  const { period, slots } = summary
  const grandTotal = slots.reduce((s, sl) => s + (sl.total || 0), 0)
  const grandSub   = slots.reduce((s, sl) => s + (sl.subtotal || 0), 0)
  const grandDisc  = slots.reduce((s, sl) => s + (sl.deductions || 0), 0)
  const hasAnyDisc = slots.some(sl => sl.deductions > 0)

  function handlePrint() { window.print() }

  return (
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <span className={s.toolbarTitle}>Summary — {folder.name}</span>
        </div>
        <div className={s.toolbarRight}>
          <button className={s.btnPrint} onClick={handlePrint}>🖨 Print</button>
          <button className={s.btnClose} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      <div className={s.pageWrap}>
        <div className={s.page}>
          {/* Header */}
          <div className={s.pageHeader}>
            <div className={s.headerLeft}>
              <div className={s.companyName}>DC <span>Cable</span></div>
              <div className={s.projectName}>{project.name}</div>
              <div className={s.folderName}>{folder.name}</div>
            </div>
            <div className={s.headerRight}>
              <div className={s.docTitle}>Payroll Summary</div>
              {period && <div className={s.period}>{period}</div>}
            </div>
          </div>

          <hr className={s.rule} />

          {/* Crew rows */}
          <table className={s.table}>
            <thead>
              <tr>
                <th>Position</th>
                <th>Crew Member</th>
                {hasAnyDisc && <th className={s.tr}>Gross</th>}
                {hasAnyDisc && <th className={s.tr}>Deductions</th>}
                <th className={s.tr}>Net Pay</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, i) => (
                <tr key={slot.id} className={i % 2 === 1 ? s.rowAlt : ''}>
                  <td>
                    <span className={s.posBadge} style={{ color: slot.color, borderColor: slot.color }}>
                      {slot.label}
                    </span>
                  </td>
                  <td className={s.crewCell}>
                    {slot.crewName || <span className={s.noName}>—</span>}
                  </td>
                  {hasAnyDisc && <td className={s.tr}>{fmtMoney(slot.subtotal)}</td>}
                  {hasAnyDisc && (
                    <td className={`${s.tr} ${slot.deductions > 0 ? s.discCell : ''}`}>
                      {slot.deductions > 0 ? `−${fmtMoney(slot.deductions)}` : '—'}
                    </td>
                  )}
                  <td className={`${s.tr} ${s.totalCell}`} style={{ color: slot.color }}>
                    {fmtMoney(slot.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hasAnyDisc ? 2 : 2} className={s.sumLabel}>Total Payroll</td>
                {hasAnyDisc && <td className={`${s.tr} ${s.sumCell}`}>{fmtMoney(grandSub)}</td>}
                {hasAnyDisc && <td className={`${s.tr} ${s.sumCell}`}>−{fmtMoney(grandDisc)}</td>}
                <td className={`${s.tr} ${s.sumCell} ${s.grandTotal}`}>{fmtMoney(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Deduction detail (if any) */}
          {hasAnyDisc && (
            <>
              <div className={s.sectionLabel}>Deduction Detail</div>
              <table className={s.detailTable}>
                <thead>
                  <tr>
                    <th>Crew Member</th>
                    <th>Description</th>
                    <th className={s.tr}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.filter(sl => sl.deductions > 0).map(slot =>
                    (slot.discountLines || []).map((d, di) => (
                      <tr key={`${slot.id}-${di}`}>
                        {di === 0 && (
                          <td rowSpan={(slot.discountLines || []).length} className={s.crewCell}>
                            {slot.crewName || slot.label}
                          </td>
                        )}
                        <td>{d.label || '—'}</td>
                        <td className={s.tr}>{fmtMoney(parseFloat(d.amount) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* Signature row */}
          <div className={s.signatureRow}>
            <div className={s.signatureBlock}>
              <div className={s.signatureLine} />
              <div className={s.signatureLabel}>Authorized Signature</div>
            </div>
            <div className={s.signatureBlock}>
              <div className={s.signatureLine} />
              <div className={s.signatureLabel}>Date</div>
            </div>
          </div>

          <div className={s.pageFooter}>
            <span>DC Cable — Payroll Manager</span>
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
