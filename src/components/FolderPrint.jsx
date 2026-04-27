import s from './FolderPrint.module.css'

const POS_COLOR = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }
const POS_LABEL = { primero: 'Primero', segundo: 'Segundo', tercero: 'Tercero' }
const POS_IDX   = { primero: '1', segundo: '2', tercero: '3' }

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

// Flatten all payrolls into one crew row per slot
function buildCrewRows(payrolls) {
  const rows = []
  payrolls.forEach(pr => {
    const baseDefs = ['primero', 'segundo', 'tercero'].map(pos => ({
      id: pos, posKey: pos, label: POS_LABEL[pos], color: POS_COLOR[pos], base: true,
    }))
    const extraDefs = (pr.extraSlots || []).map(s => ({
      ...s, color: POS_COLOR[s.posKey] || '#3949ab', base: false,
    }))

    ;[...baseDefs, ...extraDefs].forEach(slot => {
      const crewName = pr.crewNames?.[slot.id]
      if (!crewName) return
      let total
      if (slot.base) {
        total = pr[`total${POS_IDX[slot.id]}`] || 0
      } else {
        const sub  = (pr.items || []).reduce((s, it) => s + (it.extraSlots?.[slot.id]?.amt || 0), 0)
        const disc = (pr.discounts?.[slot.id] || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
        total = sub - disc
      }
      if (!total && !crewName) return
      rows.push({ period: pr.period, label: slot.label, color: slot.color, crewName, total })
    })
  })
  return rows
}

export default function FolderPrint({ project, folder, payrolls, onClose }) {
  const crews       = buildCrewRows(payrolls)
  const payrollTotal = crews.reduce((s, c) => s + c.total, 0)

  const incomeLines  = folder.summary?.incomeLines || []
  const incomeTotal  = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const hasSummary   = incomeLines.some(l => l.amount)
  const pct          = incomeTotal > 0 ? (payrollTotal / incomeTotal) * 100 : null

  return (
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <span className={s.toolbarTitle}>Print — {folder.name}</span>
        <div className={s.toolbarRight}>
          <button className={s.btnPrint} onClick={() => window.print()}>🖨 Print</button>
          <button className={s.btnClose} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      <div className={s.pageWrap}>
        <div className={s.page}>

          <div className={s.pageHeader}>
            <div className={s.headerLeft}>
              <div className={s.companyName}>DC <span>Cable</span></div>
              <div className={s.projectName}>{project.name}</div>
              <div className={s.folderName}>{folder.name}</div>
            </div>
            <div className={s.headerRight}>
              <div className={s.docTitle}>Payroll Summary</div>
            </div>
          </div>

          <hr className={s.rule} />

          {/* Summary stats card — mirrors the one in FolderView */}
          <div className={s.statsCard}>
            <div className={s.statBlock}>
              <div className={s.statLabel}>Total Payroll</div>
              <div className={s.statVal}>{fmtMoney(payrollTotal)}</div>
              <div className={s.statSub}>{payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''}</div>
            </div>
            {hasSummary && (
              <>
                <div className={s.statDivider} />
                <div className={s.statBlock}>
                  <div className={s.statLabel}>Total Income</div>
                  <div className={s.statVal}>{fmtMoney(incomeTotal)}</div>
                  <div className={s.statSub}>
                    {incomeLines.filter(l => l.amount).map((l, i) => (
                      <div key={i}>{l.label ? `${l.label}: ` : ''}{fmtMoney(l.amount)}</div>
                    ))}
                  </div>
                </div>
                <div className={s.statDivider} />
                <div className={s.statBlock}>
                  <div className={s.statLabel}>Payroll %</div>
                  <div className={s.statValPct} style={{ color: pct > 40 ? '#c0392b' : pct > 30 ? '#e65100' : '#2e7d32' }}>
                    {pct !== null ? fmtPct(pct) : '—'}
                  </div>
                  <div className={s.statSub}>of income</div>
                </div>
              </>
            )}
          </div>

          <hr className={s.rule} />

          {/* One line per crew member */}
          <div className={s.crewList}>
            {crews.map((c, i) => (
              <div key={i} className={`${s.crewRow} ${i % 2 === 1 ? s.crewRowAlt : ''}`}>
                <span className={s.posBadge} style={{ color: c.color, borderColor: c.color }}>{c.label}</span>
                <span className={s.crewName}>{c.crewName}</span>
                {c.period && <span className={s.period}>{c.period}</span>}
                <span className={s.crewTotal} style={{ color: c.color }}>{fmtMoney(c.total)}</span>
              </div>
            ))}
            <div className={s.grandRow}>
              <span className={s.grandLabel}>Total</span>
              <span className={s.grandVal}>{fmtMoney(payrollTotal)}</span>
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
