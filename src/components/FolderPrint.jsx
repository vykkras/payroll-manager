import { useEffect } from 'react'
import { createPortal } from 'react-dom'
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

async function downloadFolderExcel({ project, folder, payrolls }) {
  const crews        = buildCrewRows(payrolls)
  const payrollTotal = crews.reduce((s, c) => s + c.total, 0)
  const incomeLines  = folder.summary?.incomeLines || []
  const incomeTotal  = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const hasSummary   = incomeLines.some(l => l.amount)
  const pct          = incomeTotal > 0 ? (payrollTotal / incomeTotal) * 100 : null

  const ExcelJS  = (await import('exceljs')).default
  const wb       = new ExcelJS.Workbook()
  wb.creator     = 'DC Cable Payroll Manager'

  const dark      = '1A1A2E'
  const lightGray = 'F8F8F8'
  const headerTxt = 'B0BAD4'
  const medBorder = { style: 'medium', color: { argb: 'FF' + dark } }
  const thinB     = { style: 'thin',   color: { argb: 'FFE0E0E0' } }

  function applyBorder(cell) { cell.border = { top: thinB, left: thinB, bottom: thinB, right: thinB } }
  function darkHeader(row) {
    row.height = 22
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + dark } }
      cell.font = { bold: true, color: { argb: 'FF' + headerTxt }, size: 10, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      applyBorder(cell)
    })
  }

  const ws = wb.addWorksheet('Week Summary')
  ws.columns = [{ width: 14 }, { width: 26 }, { width: 18 }, { width: 16 }]

  // Title block
  const r1 = ws.addRow(['DC Cable — Payroll Summary'])
  r1.height = 28
  r1.getCell(1).font = { bold: true, size: 18, color: { argb: 'FF' + dark }, name: 'Arial' }

  const r2 = ws.addRow([project.name])
  r2.getCell(1).font = { bold: true, size: 13, name: 'Arial' }
  const r3 = ws.addRow([folder.name])
  r3.getCell(1).font = { size: 11, color: { argb: 'FF888888' }, name: 'Arial' }

  ws.addRow([])

  // Stats block
  const s1 = ws.addRow(['Total Payroll', payrollTotal])
  s1.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
  s1.getCell(2).font = { bold: true, size: 13, name: 'Arial' }
  s1.getCell(2).numFmt = '$#,##0.00'

  if (hasSummary) {
    const s2 = ws.addRow(['Total Income', incomeTotal])
    s2.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
    s2.getCell(2).numFmt = '$#,##0.00'

    if (pct !== null) {
      const s3 = ws.addRow(['Payroll %', pct / 100])
      s3.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
      s3.getCell(2).numFmt = '0.0%'
      s3.getCell(2).font = { bold: true, color: { argb: pct > 40 ? 'FFC0392B' : pct > 30 ? 'FFE65100' : 'FF2E7D32' }, name: 'Arial' }
    }
  }

  ws.addRow([])

  // Crew rows
  darkHeader(ws.addRow(['Position', 'Crew Member', 'Period', 'Total']))

  const dataStartRow = ws.rowCount + 1
  crews.forEach((c, i) => {
    const hex = (c.color || '#3949ab').replace('#', '').toUpperCase()
    const row = ws.addRow([c.label, c.crewName, c.period || '', c.total])
    row.height = 18
    row.getCell(1).font = { bold: true, color: { argb: 'FF' + hex }, size: 10, name: 'Arial' }
    row.getCell(4).numFmt = '$#,##0.00'
    if (i % 2 === 1) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + lightGray } } })
    row.eachCell(c => applyBorder(c))
  })
  const dataEndRow = ws.rowCount

  // Total row with SUM formula
  const totRow = ws.addRow(['', 'Total', '', 0])
  totRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${dataEndRow})`, result: payrollTotal }
  totRow.getCell(2).font = { bold: true, size: 12, name: 'Arial' }
  totRow.getCell(2).border = { top: medBorder }
  totRow.getCell(4).font = { bold: true, size: 14, color: { argb: 'FF' + dark }, name: 'Arial' }
  totRow.getCell(4).numFmt = '$#,##0.00'
  totRow.getCell(4).border = { top: medBorder }
  totRow.height = 26

  // Income detail if present
  if (hasSummary && incomeLines.filter(l => l.amount).length > 0) {
    ws.addRow([])
    ws.addRow([])
    const sec = ws.addRow(['Income Detail'])
    sec.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF' + dark }, name: 'Arial' }
    darkHeader(ws.addRow(['Description', 'Amount']))
    incomeLines.filter(l => l.amount).forEach(l => {
      const dr = ws.addRow([l.label || '—', parseFloat(l.amount) || 0])
      dr.getCell(2).numFmt = '$#,##0.00'
      dr.height = 18
      dr.eachCell(c => applyBorder(c))
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `WeekSummary---${project.name}---${folder.name}.xlsx`.replace(/[/\\:*?"<>|]/g, '-')
  a.click()
  URL.revokeObjectURL(url)
}

export default function FolderPrint({ project, folder, payrolls, onClose }) {
  useEffect(() => {
    document.body.classList.add('print-active')
    return () => document.body.classList.remove('print-active')
  }, [])

  const crews       = buildCrewRows(payrolls)
  const payrollTotal = crews.reduce((s, c) => s + c.total, 0)

  const incomeLines  = folder.summary?.incomeLines || []
  const incomeTotal  = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const hasSummary   = incomeLines.some(l => l.amount)
  const pct          = incomeTotal > 0 ? (payrollTotal / incomeTotal) * 100 : null

  return createPortal(
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <span className={s.toolbarTitle}>Print — {folder.name}</span>
        <div className={s.toolbarRight}>
          <button className={s.btnExcel} onClick={() => downloadFolderExcel({ project, folder, payrolls })}>⬇ Excel</button>
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
  , document.body)
}
