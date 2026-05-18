import s from './SummaryPrint.module.css'

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function downloadSummaryExcel({ project, folder, summary }) {
  const { period, slots } = summary
  const hasAnyDisc = slots.some(sl => sl.deductions > 0)

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DC Cable Payroll Manager'

  const dark      = '1A1A2E'
  const lightGray = 'F8F8F8'
  const headerText = 'B0BAD4'
  const medBorder = { style: 'medium', color: { argb: 'FF' + dark } }

  function applyBorder(cell) {
    const b = { style: 'thin', color: { argb: 'FFE0E0E0' } }
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

  const ws = wb.addWorksheet('Summary')
  ws.columns = hasAnyDisc
    ? [{ width: 14 }, { width: 26 }, { width: 16 }, { width: 16 }, { width: 16 }]
    : [{ width: 14 }, { width: 26 }, { width: 16 }]

  // Title block
  const r1 = ws.addRow(['DC Cable — Payroll Summary'])
  r1.height = 28
  r1.getCell(1).font = { bold: true, size: 18, color: { argb: 'FF' + dark }, name: 'Arial' }

  const r2 = ws.addRow([project.name])
  r2.getCell(1).font = { bold: true, size: 13, name: 'Arial' }
  const r3 = ws.addRow([folder.name])
  r3.getCell(1).font = { size: 11, color: { argb: 'FF888888' }, name: 'Arial' }

  ws.addRow([])

  if (period) {
    const pr = ws.addRow(['Period', period])
    pr.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
    pr.getCell(2).font = { size: 10, name: 'Arial' }
  }

  ws.addRow([])

  // Column headers
  const headers = hasAnyDisc
    ? ['Position', 'Crew Member', 'Gross', 'Deductions', 'Net Pay']
    : ['Position', 'Crew Member', 'Net Pay']
  darkHeader(ws.addRow(headers))

  const money = '$#,##0.00'
  const netCol = hasAnyDisc ? 'E' : 'C'
  const dataStartRow = ws.rowCount + 1

  // Slot rows
  slots.forEach((slot, i) => {
    const row = hasAnyDisc
      ? ws.addRow([slot.label, slot.crewName || '—', slot.subtotal || 0, slot.deductions || 0, 0])
      : ws.addRow([slot.label, slot.crewName || '—', slot.total || 0])
    const rn = row.number
    if (hasAnyDisc) {
      row.getCell(5).value = { formula: `C${rn}-D${rn}`, result: slot.total || 0 }
      row.getCell(3).numFmt = money
      row.getCell(4).numFmt = money
      row.getCell(5).numFmt = money
    } else {
      row.getCell(3).numFmt = money
    }
    row.height = 18
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + lightGray } } })
    row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF' + (slot.color || '#3949ab').replace('#', '').toUpperCase() }, name: 'Arial' }
    row.eachCell(c => applyBorder(c))
  })

  const dataEndRow = ws.rowCount

  // Grand total row with SUM formulas
  const totRow = hasAnyDisc
    ? ws.addRow(['', 'Total Payroll', 0, 0, 0])
    : ws.addRow(['', 'Total Payroll', 0])
  totRow.height = 26
  totRow.getCell(2).font = { bold: true, size: 12, name: 'Arial' }
  const grandTotal = slots.reduce((acc, sl) => acc + (sl.total      || 0), 0)
  const grandSub   = slots.reduce((acc, sl) => acc + (sl.subtotal   || 0), 0)
  const grandDisc  = slots.reduce((acc, sl) => acc + (sl.deductions || 0), 0)
  if (hasAnyDisc) {
    totRow.getCell(3).value = { formula: `SUM(C${dataStartRow}:C${dataEndRow})`, result: grandSub }
    totRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${dataEndRow})`, result: grandDisc }
    totRow.getCell(5).value = { formula: `SUM(E${dataStartRow}:E${dataEndRow})`, result: grandTotal }
    totRow.getCell(3).numFmt = money
    totRow.getCell(4).numFmt = money
    totRow.getCell(5).numFmt = money
    totRow.getCell(5).font = { bold: true, size: 14, color: { argb: 'FF' + dark }, name: 'Arial' }
    totRow.getCell(5).border = { top: medBorder }
  } else {
    totRow.getCell(3).value = { formula: `SUM(C${dataStartRow}:C${dataEndRow})`, result: grandTotal }
    totRow.getCell(3).numFmt = money
    totRow.getCell(3).font = { bold: true, size: 14, color: { argb: 'FF' + dark }, name: 'Arial' }
    totRow.getCell(3).border = { top: medBorder }
  }
  totRow.getCell(2).border = { top: medBorder }

  // Deduction detail section
  if (hasAnyDisc) {
    ws.addRow([])
    ws.addRow([])

    const secLabel = ws.addRow(['Deduction Detail'])
    secLabel.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF' + dark }, name: 'Arial' }

    darkHeader(ws.addRow(['Crew Member', 'Description', 'Amount']))

    slots.filter(sl => sl.deductions > 0).forEach(slot => {
      (slot.discountLines || []).forEach((d, di) => {
        const dr = ws.addRow([di === 0 ? (slot.crewName || slot.label) : '', d.label || '—', parseFloat(d.amount) || 0])
        dr.getCell(3).numFmt = money
        dr.height = 18
        dr.eachCell(c => applyBorder(c))
      })
    })
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safePeriod = (period || '').replace(/[/\\:*?"<>|]/g, '-').trim() || 'summary'
  a.href     = url
  a.download = `Summary---${project.name}---${safePeriod}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
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
          <button className={s.btnExcel} onClick={() => downloadSummaryExcel({ project, folder, summary })}>⬇ Excel</button>
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
