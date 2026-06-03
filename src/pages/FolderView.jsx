import { useState } from 'react'
import { treePath, uid } from '../store/useStore'
import Modal from '../components/Modal'
import PrintView from '../components/PrintView'
import FolderPrint from '../components/FolderPrint'
import { autoFitColumns, mergeAcross, makeTableRegion } from '../utils/excel'
import s from './FolderView.module.css'

function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const POS = [
  { key: 'primero', label: 'Primero', color: '#3949ab', bg: '#e8eaf6', idx: '1' },
  { key: 'segundo', label: 'Segundo', color: '#2e7d32', bg: '#e8f5e9', idx: '2' },
  { key: 'tercero', label: 'Tercero', color: '#e65100', bg: '#fff3e0', idx: '3' },
]
const POS_COLOR = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }
const POS_BG    = { primero: '#e8eaf6', segundo: '#e8f5e9', tercero: '#fff3e0' }
const POS_IDX   = { primero: '1',       segundo: '2',       tercero: '3'       }

function normalizeRows(rows, key) {
  if (!rows) return []
  if (Array.isArray(rows)) return key === 'primero' ? rows : []
  return rows[key] || []
}

async function downloadSlotExcel({ project, folder, payroll, slot }) {
  const posIdx   = POS_IDX[slot.posKey]
  const isExtra  = !slot.base
  const crewName = payroll.crewNames?.[slot.id] || '—'
  const period   = payroll.period || ''
  const color    = slot.color || POS_COLOR[slot.posKey] || '#3949ab'

  const rawDisc  = payroll.discounts
  const discounts = Array.isArray(rawDisc) ? rawDisc : (rawDisc?.[slot.id] || [])

  let subtotal, total
  if (isExtra) {
    subtotal = (payroll.items || []).reduce((sum, it) => sum + (it.extraSlots?.[slot.id]?.amt || 0), 0)
    const disc = discounts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
    total = subtotal - disc
  } else {
    subtotal = payroll[`subtotal${posIdx}`] || 0
    total    = payroll[`total${posIdx}`]    || 0
  }

  const columns = project.columns || []
  const rows    = normalizeRows(payroll.rows ?? folder.rows, slot.id)
  const activeItems = (payroll.items || []).filter(it => {
    const q = isExtra ? it.extraSlots?.[slot.id]?.qty : it[`qty${posIdx}`]
    return q !== '' && q !== undefined && q !== null && parseFloat(q) !== 0
  })

  const ExcelJS   = (await import('exceljs')).default
  const wb        = new ExcelJS.Workbook()
  wb.creator      = 'DC Cable Payroll Manager'
  const hexColor  = color.replace('#', '').toUpperCase()
  const dark      = '1A1A2E'
  const lightGray = 'F8F8F8'
  const headerTxt = 'B0BAD4'

  function applyBorder(cell) {
    const b = { style: 'thin', color: { argb: 'FFE0E0E0' } }
    cell.border = { top: b, left: b, bottom: b, right: b }
  }
  function darkHeader(row) {
    row.height = 22
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + dark } }
      cell.font = { bold: true, color: { argb: 'FF' + headerTxt }, size: 10, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      applyBorder(cell)
    })
  }

  const COLS = 6
  const ws = wb.addWorksheet('Payroll')

  const r1 = ws.addRow(['DC Cable — Payroll Manager'])
  r1.height = 28
  r1.getCell(1).font = { bold: true, size: 18, color: { argb: 'FF' + dark }, name: 'Arial' }
  const r2 = ws.addRow([project.name])
  r2.getCell(1).font = { bold: true, size: 13, name: 'Arial' }
  const r3 = ws.addRow([folder.name])
  r3.getCell(1).font = { size: 11, color: { argb: 'FF888888' }, name: 'Arial' }
  mergeAcross(ws, r1.number, COLS)
  mergeAcross(ws, r2.number, COLS)
  mergeAcross(ws, r3.number, COLS)
  ws.addRow([])

  const meta = ws.addRow(['Position', slot.label, '', 'Period', period])
  meta.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
  meta.getCell(2).font = { bold: true, size: 10, color: { argb: 'FF' + hexColor }, name: 'Arial' }
  meta.getCell(4).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
  const crewRow = ws.addRow(['Crew', crewName])
  crewRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFAAAAAA' }, name: 'Arial' }
  crewRow.getCell(2).font = { bold: true, size: 11, name: 'Arial' }
  ws.addRow([])

  darkHeader(ws.addRow(['Code', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']))
  const headerRow = ws.rowCount

  const itemStartRow = ws.rowCount + 1
  activeItems.forEach((it, i) => {
    const qty     = isExtra ? it.extraSlots?.[slot.id]?.qty : it[`qty${posIdx}`]
    const qtyNum  = parseFloat(qty)             || 0
    const rateNum = parseFloat(it[`rate${posIdx}`]) || 0
    const row = ws.addRow([it.code || '', it.label, it.unit || '', qtyNum, rateNum, 0])
    row.getCell(6).value = { formula: `D${row.number}*E${row.number}`, result: qtyNum * rateNum }
    row.height = 18
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + lightGray } } })
    row.getCell(1).font = { bold: true, color: { argb: 'FF' + hexColor }, size: 10, name: 'Arial' }
    row.getCell(5).numFmt = '$#,##0.00'
    row.getCell(6).numFmt = '$#,##0.00'
    row.eachCell(c => applyBorder(c))
  })
  const itemEndRow = ws.rowCount
  ws.addRow([])

  const medBorder   = { style: 'medium', color: { argb: 'FF' + dark } }
  const hasDiscounts = discounts.some(d => d.label || d.amount)
  let subtotalRowNum = null, discRowStart = null, discRowEnd = null

  if (hasDiscounts) {
    const sr = ws.addRow(['', '', '', '', 'Subtotal', 0])
    subtotalRowNum = sr.number
    sr.getCell(6).value  = { formula: `SUM(F${itemStartRow}:F${itemEndRow})`, result: parseFloat(subtotal) || 0 }
    sr.getCell(5).font   = { size: 11, color: { argb: 'FF555555' }, name: 'Arial' }
    sr.getCell(6).numFmt = '$#,##0.00'
    discounts.filter(d => d.label || d.amount).forEach((d, i) => {
      const dr = ws.addRow(['', '', '', '', d.label || 'Discount', -(parseFloat(d.amount) || 0)])
      if (i === 0) discRowStart = dr.number
      discRowEnd = dr.number
      dr.getCell(5).font = { size: 11, color: { argb: 'FFC0392B' }, name: 'Arial' }
      dr.getCell(6).font = { size: 11, color: { argb: 'FFC0392B' }, name: 'Arial' }
      dr.getCell(6).numFmt = '$#,##0.00'
    })
  }

  const tr = ws.addRow(['', '', '', '', `Total — ${slot.label}`, 0])
  tr.getCell(6).value = hasDiscounts && subtotalRowNum != null && discRowStart != null
    ? { formula: `F${subtotalRowNum}+SUM(F${discRowStart}:F${discRowEnd})`, result: parseFloat(total) || 0 }
    : { formula: `SUM(F${itemStartRow}:F${itemEndRow})`,                    result: parseFloat(total) || 0 }
  tr.height = 26
  tr.getCell(5).font = { bold: true, size: 13, name: 'Arial' }
  tr.getCell(5).border = { top: medBorder }
  tr.getCell(6).font = { bold: true, size: 16, color: { argb: 'FF' + hexColor }, name: 'Arial' }
  tr.getCell(6).numFmt = '$#,##0.00'
  tr.getCell(6).border = { top: medBorder }

  makeTableRegion(ws, headerRow, itemEndRow, COLS)
  autoFitColumns(ws)

  // Production Data sheet
  const activeExcelCols = columns.filter(col => rows.some(r => r[col.id] !== '' && r[col.id] != null))
  if (activeExcelCols.length > 0 && rows.length > 0) {
    const ws2 = wb.addWorksheet('Production Data')
    darkHeader(ws2.addRow(activeExcelCols.map(c => c.name)))
    const ws2HeaderRow = ws2.rowCount
    const dataStartRow = ws2.rowCount + 1
    rows.forEach((row, i) => {
      const r = ws2.addRow(activeExcelCols.map(c => {
        const v = row[c.id] ?? ''
        return v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : v
      }))
      r.height = 18
      if (i % 2 === 1) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + lightGray } } })
      r.eachCell(c => applyBorder(c))
    })
    const dataEndRow = ws2.rowCount
    const sumRow = ws2.addRow(activeExcelCols.map(() => 0))
    sumRow.height = 20
    activeExcelCols.forEach((col, colIdx) => {
      const isNumCol = rows.some(r => r[col.id] !== '' && r[col.id] != null && !isNaN(parseFloat(r[col.id])))
      const cell   = sumRow.getCell(colIdx + 1)
      const letter = String.fromCharCode(65 + colIdx)
      const colSum = isNumCol ? rows.reduce((acc, r) => acc + (parseFloat(r[col.id]) || 0), 0) : 0
      cell.value  = isNumCol ? { formula: `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`, result: colSum } : ''
      cell.font   = { bold: true, size: 11, name: 'Arial' }
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } }
      cell.border = { top: medBorder, bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }, left: { style: 'thin', color: { argb: 'FFE0E0E0' } }, right: { style: 'thin', color: { argb: 'FFE0E0E0' } } }
      if (isNumCol) cell.numFmt = '#,##0.##'
    })
    makeTableRegion(ws2, ws2HeaderRow, dataEndRow, activeExcelCols.length)
    autoFitColumns(ws2)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  const safePeriod = (period || '').replace(/[/\\:*?"<>|]/g, '-').trim() || 'payroll'
  a.href = url
  a.download = `${crewName}---${project.name}---${safePeriod}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function fmtPct(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

const STATUS_OPTIONS = [
  { key: 'paid',    label: 'Paid',    color: '#2e7d32', bg: '#e8f5e9', cardBg: '#f0faf0', rank: 1 },
  { key: 'on-hold', label: 'On Hold', color: '#e65100', bg: '#fff3e0', cardBg: '#fffbf0', rank: 2 },
  { key: 'error',   label: 'Error',   color: '#c0392b', bg: '#ffebee', cardBg: '#fff5f5', rank: 3 },
]

function cardStatusStyle(pr) {
  const statuses = Object.values(pr.slotStatuses || {}).filter(Boolean)
  if (!statuses.length) return {}
  const worst = STATUS_OPTIONS.reduce((top, opt) =>
    statuses.includes(opt.key) && opt.rank > (top?.rank || 0) ? opt : top, null)
  return worst ? { background: worst.cardBg, borderColor: worst.color + '55' } : {}
}

export default function FolderView({ store, project, folder, onBack, onOpenFolder, onOpenEditor, onEditPayroll }) {
  const [showNewFolder, setShowNewFolder]   = useState(false)
  const [folderName, setFolderName]         = useState('')
  const [delFolder,    setDelFolder]        = useState(null)
  const [delPayroll,   setDelPayroll]       = useState(null)
  const [printPayroll, setPrintPayroll]     = useState(null)
  const [printSlot,    setPrintSlot]        = useState(null)
  const [showFullPrint, setShowFullPrint]   = useState(false)
  const [openStatusId,  setOpenStatusId]   = useState(null)

  function setSlotStatus(pr, slotId, statusKey) {
    const current = pr.slotStatuses?.[slotId]
    const updated = { ...pr.slotStatuses, [slotId]: current === statusKey ? null : statusKey }
    store.savePayroll(project.id, folder.id, { ...pr, slotStatuses: updated })
    setOpenStatusId(null)
  }

  // Summary
  const [showSummary, setShowSummary] = useState(false)
  const [localSummary, setLocalSummary] = useState(folder.summary || null)
  const [incomeLines, setIncomeLines] = useState(() => {
    const saved = folder.summary?.incomeLines
    return saved?.length ? saved : [{ id: uid(), label: '', amount: '' }]
  })

  const subFolders = folder.folders  || []
  const payrolls   = folder.payrolls || []
  const breadcrumb = treePath(project.folders || [], folder.id) || []

  // Compute payroll total across all saved payrolls in this folder
  const payrollTotal = payrolls.reduce((sum, pr) =>
    sum + (parseFloat(pr.total1) || 0) + (parseFloat(pr.total2) || 0) + (parseFloat(pr.total3) || 0), 0)

  const savedIncomeLines = (localSummary ?? folder.summary)?.incomeLines || []
  const incomeTotal = savedIncomeLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
  const pct = incomeTotal > 0 ? (payrollTotal / incomeTotal) * 100 : null
  const hasSummary = savedIncomeLines.length > 0 && savedIncomeLines.some(l => l.amount)

  function openSummary() {
    const saved = folder.summary?.incomeLines
    setIncomeLines(saved?.length ? saved.map(l => ({ ...l })) : [{ id: uid(), label: '', amount: '' }])
    setShowSummary(true)
  }

  function handleSaveSummary() {
    const filtered = incomeLines.filter(l => l.label.trim() || l.amount)
    store.saveFolderSummary(project.id, folder.id, filtered)
    setLocalSummary({ incomeLines: filtered })
    setShowSummary(false)
  }

  function updateLine(id, field, value) {
    setIncomeLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  function addLine() {
    setIncomeLines(ls => [...ls, { id: uid(), label: '', amount: '' }])
  }

  function removeLine(id) {
    setIncomeLines(ls => ls.length > 1 ? ls.filter(l => l.id !== id) : ls)
  }

  function handleCreateFolder() {
    if (!folderName.trim()) return
    store.createFolder(project.id, folder.id, folderName.trim())
    setFolderName('')
    setShowNewFolder(false)
  }

  return (
    <>
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>←</button>
        <div className={s.breadcrumb}>
          <span className={s.projName}>{project.name}</span>
          {breadcrumb.map(f => (
            <span key={f.id} className={s.bcItem}>
              <span className={s.sep}>/</span>
              <span>{f.name}</span>
            </span>
          ))}
        </div>
        <button className={s.btnSummary} onClick={openSummary}>Summary</button>
        {payrolls.length > 0 && <button className={s.btnPrintAll} onClick={() => setShowFullPrint(true)}>🖨 Print All</button>}
        <button className={s.btnEditor} onClick={onOpenEditor}>Open Editor ✏</button>
      </header>

      <main className={s.main}>
        <div className={s.ph}>
          <div>
            <h2>{folder.name}</h2>
            <p>{subFolders.length} folder{subFolders.length !== 1 ? 's' : ''} · {payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''}</p>
          </div>
          <button className={s.btnAdd} onClick={() => setShowNewFolder(true)}>+ New Folder</button>
        </div>

        {hasSummary && (
          <div className={s.summaryPanel}>
            <div className={s.summaryPanelTitle}>Week Summary</div>
            <div className={s.summaryGrid}>
              <div className={s.summaryBlock}>
                <div className={s.summaryBlockLabel}>Total Payroll</div>
                <div className={s.summaryBlockVal}>{fmtMoney(payrollTotal)}</div>
                <div className={s.summaryBlockSub}>{payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''}</div>
              </div>
              <div className={s.summaryBlock}>
                <div className={s.summaryBlockLabel}>Total Income</div>
                <div className={s.summaryBlockVal}>{fmtMoney(incomeTotal)}</div>
                <div className={s.summaryBlockSub}>
                  {savedIncomeLines.filter(l => l.amount).map(l => (
                    <span key={l.id} className={s.summaryLine}>
                      {l.label ? `${l.label}: ` : ''}{fmtMoney(l.amount)}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`${s.summaryBlock} ${s.summaryBlockPct}`}>
                <div className={s.summaryBlockLabel}>Payroll %</div>
                <div className={s.summaryBlockValPct} style={{ color: pct > 40 ? '#c0392b' : pct > 30 ? '#e65100' : '#2e7d32' }}>
                  {pct !== null ? fmtPct(pct) : '—'}
                </div>
                <div className={s.summaryBlockSub}>of income</div>
              </div>
            </div>
            <button className={s.summaryEditBtn} onClick={openSummary}>Edit</button>
          </div>
        )}

        {subFolders.length > 0 && (
          <div className={s.section}>
            <div className={s.sectionLabel}>Folders</div>
            <div className={s.grid}>
              {subFolders.map(f => (
                <div key={f.id} className={s.folderCard} onClick={() => onOpenFolder(f.id)}>
                  <span className={s.cardIcon}>📁</span>
                  <div className={s.cardName}>{f.name}</div>
                  <div className={s.cardMeta}>
                    {(f.folders || []).length} folder{(f.folders || []).length !== 1 ? 's' : ''} · {(f.payrolls || []).length} payroll{(f.payrolls || []).length !== 1 ? 's' : ''} · {relDate(f.createdAt)}
                  </div>
                  <button className={s.delBtn} onClick={e => { e.stopPropagation(); setDelFolder(f.id) }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {payrolls.length > 0 && (
          <div className={s.section}>
            <div className={s.sectionLabel}>Payrolls</div>
            <div className={s.payrollList}>
              {payrolls.map(pr => (
                <div key={pr.id} className={s.payrollCard} style={cardStatusStyle(pr)} onClick={() => onEditPayroll(pr)}>
                  {/* Period + actions */}
                  <div className={s.payrollCardHeader}>
                    <span className={s.payrollPeriod}>{pr.period || 'No period'}</span>
                    <div className={s.payrollCardActions}>
                      <button className={s.printPayrollBtn} onClick={e => {
                        e.stopPropagation()
                        setPrintPayroll(pr)
                        const defPos = pr.position || 'primero'
                        setPrintSlot({ id: defPos, posKey: defPos, label: POS.find(p => p.key === defPos)?.label || defPos, color: POS_COLOR[defPos], base: true })
                      }}>🖨</button>
                      <button className={s.delBtn} onClick={e => { e.stopPropagation(); setDelPayroll(pr.id) }}>✕</button>
                    </div>
                  </div>
                  {/* Per-position rows */}
                  <div className={s.payrollPositions}>
                    {POS.map(p => {
                      const crew  = pr.crewNames?.[p.key]
                      const total = pr[`total${p.idx}`]
                      if (!crew && !total) return null
                      const slotStatus = STATUS_OPTIONS.find(o => o.key === pr.slotStatuses?.[p.key])
                      return (
                        <div key={p.key} className={s.payrollPosRow}>
                          <span className={s.posBadge} style={{ color: p.color, background: p.bg }}>{p.label}</span>
                          <span className={s.payrollCrew}>{crew || '—'}</span>
                          <span className={s.payrollTotal} style={{ color: p.color }}>{fmtMoney(total)}</span>
                          <div className={s.statusWrap} onClick={e => e.stopPropagation()}>
                            <button
                              className={s.statusBtn}
                              style={slotStatus ? { color: slotStatus.color, borderColor: slotStatus.color + '88', background: slotStatus.bg } : {}}
                              onClick={e => { e.stopPropagation(); setOpenStatusId(openStatusId === `${pr.id}-${p.key}` ? null : `${pr.id}-${p.key}`) }}
                            >{slotStatus ? slotStatus.label : '●'} ▾</button>
                            {openStatusId === `${pr.id}-${p.key}` && (
                              <div className={s.statusMenu}>
                                {STATUS_OPTIONS.map(opt => (
                                  <button key={opt.key}
                                    className={`${s.statusMenuItem} ${pr.slotStatuses?.[p.key] === opt.key ? s.statusMenuItemOn : ''}`}
                                    style={{ color: opt.color }}
                                    onClick={() => setSlotStatus(pr, p.key, opt.key)}
                                  >{opt.label}</button>
                                ))}
                                {pr.slotStatuses?.[p.key] && (
                                  <button className={s.statusMenuClear} onClick={() => setSlotStatus(pr, p.key, pr.slotStatuses[p.key])}>Clear</button>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            className={s.xlsBtn}
                            title="Download Excel"
                            onClick={e => { e.stopPropagation(); downloadSlotExcel({ project, folder, payroll: pr, slot: { id: p.key, posKey: p.key, label: p.label, color: p.color, base: true } }) }}
                          >XLS</button>
                        </div>
                      )
                    })}
                    {(pr.extraSlots || []).map(slot => {
                      const crew  = pr.crewNames?.[slot.id]
                      const sub   = (pr.items || []).reduce((sum, it) => sum + (it.extraSlots?.[slot.id]?.amt || 0), 0)
                      const disc  = (pr.discounts?.[slot.id] || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
                      const total = sub - disc
                      if (!crew && !total) return null
                      const color = POS_COLOR[slot.posKey] || '#3949ab'
                      const bg    = POS_BG[slot.posKey]    || '#e8eaf6'
                      const slotStatus = STATUS_OPTIONS.find(o => o.key === pr.slotStatuses?.[slot.id])
                      return (
                        <div key={slot.id} className={s.payrollPosRow}>
                          <span className={s.posBadge} style={{ color, background: bg }}>{slot.label}</span>
                          <span className={s.payrollCrew}>{crew || '—'}</span>
                          <span className={s.payrollTotal} style={{ color }}>{fmtMoney(total)}</span>
                          <div className={s.statusWrap} onClick={e => e.stopPropagation()}>
                            <button
                              className={s.statusBtn}
                              style={slotStatus ? { color: slotStatus.color, borderColor: slotStatus.color + '88', background: slotStatus.bg } : {}}
                              onClick={e => { e.stopPropagation(); setOpenStatusId(openStatusId === `${pr.id}-${slot.id}` ? null : `${pr.id}-${slot.id}`) }}
                            >{slotStatus ? slotStatus.label : '●'} ▾</button>
                            {openStatusId === `${pr.id}-${slot.id}` && (
                              <div className={s.statusMenu}>
                                {STATUS_OPTIONS.map(opt => (
                                  <button key={opt.key}
                                    className={`${s.statusMenuItem} ${pr.slotStatuses?.[slot.id] === opt.key ? s.statusMenuItemOn : ''}`}
                                    style={{ color: opt.color }}
                                    onClick={() => setSlotStatus(pr, slot.id, opt.key)}
                                  >{opt.label}</button>
                                ))}
                                {pr.slotStatuses?.[slot.id] && (
                                  <button className={s.statusMenuClear} onClick={() => setSlotStatus(pr, slot.id, pr.slotStatuses[slot.id])}>Clear</button>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            className={s.xlsBtn}
                            title="Download Excel"
                            onClick={e => { e.stopPropagation(); downloadSlotExcel({ project, folder, payroll: pr, slot: { ...slot, color: POS_COLOR[slot.posKey] || '#3949ab', base: false } }) }}
                          >XLS</button>
                        </div>
                      )
                    })}
                  </div>
                  <div className={s.payrollCardHint}>Click to edit</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subFolders.length === 0 && payrolls.length === 0 && (
          <div className={s.empty}>
            <span className={s.emptyIcon}>📁</span>
            <h3>This folder is empty</h3>
            <p>Create sub-folders to organise your work, or open the editor to add payrolls</p>
            <div className={s.emptyBtns}>
              <button className={s.btnAdd} onClick={() => setShowNewFolder(true)}>+ New Folder</button>
              <button className={s.btnEditorAlt} onClick={onOpenEditor}>Open Editor ✏</button>
            </div>
          </div>
        )}
      </main>

      {showNewFolder && (
        <Modal title="New Folder" onClose={() => { setShowNewFolder(false); setFolderName('') }}>
          <div className={s.field}>
            <label>Folder Name</label>
            <input
              autoFocus
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              placeholder="e.g. Week of Apr 7, East Dallas"
            />
          </div>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => { setShowNewFolder(false); setFolderName('') }}>Cancel</button>
            <button className={s.btnOk} onClick={handleCreateFolder} disabled={!folderName.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {delFolder && (
        <Modal title="Delete folder?" onClose={() => setDelFolder(null)}>
          <p className={s.delMsg}>This will permanently delete the folder and all its contents.</p>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setDelFolder(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deleteFolder(project.id, delFolder); setDelFolder(null) }}>Delete</button>
          </div>
        </Modal>
      )}

      {delPayroll && (
        <Modal title="Delete payroll?" onClose={() => setDelPayroll(null)}>
          <p className={s.delMsg}>This payroll will be permanently removed.</p>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setDelPayroll(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deletePayroll(project.id, folder.id, delPayroll); setDelPayroll(null) }}>Delete</button>
          </div>
        </Modal>
      )}

      {printPayroll && !printPayroll._printMode && (
        <Modal title="Print — select position" onClose={() => setPrintPayroll(null)}>
          <div className={s.printPosRow}>
            {POS.map(p => (
              <button
                key={p.key}
                className={`${s.printPosBtn} ${printSlot?.id === p.key ? s.printPosBtnOn : ''}`}
                style={printSlot?.id === p.key ? { background: p.color, borderColor: p.color } : {}}
                onClick={() => setPrintSlot({ id: p.key, posKey: p.key, label: p.label, color: p.color, base: true })}
              >{p.label}</button>
            ))}
            {(printPayroll.extraSlots || []).map(slot => (
              <button
                key={slot.id}
                className={`${s.printPosBtn} ${printSlot?.id === slot.id ? s.printPosBtnOn : ''}`}
                style={printSlot?.id === slot.id ? { background: POS_COLOR[slot.posKey], borderColor: POS_COLOR[slot.posKey] } : {}}
                onClick={() => setPrintSlot({ ...slot, color: POS_COLOR[slot.posKey], base: false })}
              >{slot.label}</button>
            ))}
          </div>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setPrintPayroll(null)}>Cancel</button>
            <button className={s.btnOk} onClick={() => setPrintPayroll({ ...printPayroll, _printMode: true })}>Open Print Preview</button>
          </div>
        </Modal>
      )}

      {showSummary && (
        <Modal title="Week Summary — Income" onClose={() => setShowSummary(false)}>
          <p className={s.summaryModalHint}>Enter what you were supposed to get paid this week. Add as many lines as needed.</p>
          <div className={s.summaryLines}>
            {incomeLines.map((line, i) => (
              <div key={line.id} className={s.summaryLineRow}>
                <input
                  className={s.summaryLineLabel}
                  value={line.label}
                  onChange={e => updateLine(line.id, 'label', e.target.value)}
                  placeholder={`Line ${i + 1} (e.g. Invoice #12)`}
                  autoFocus={i === 0}
                />
                <input
                  className={s.summaryLineAmount}
                  type="number"
                  value={line.amount}
                  onChange={e => updateLine(line.id, 'amount', e.target.value)}
                  placeholder="0.00"
                />
                <button className={s.summaryLineRemove} onClick={() => removeLine(line.id)} disabled={incomeLines.length === 1}>✕</button>
              </div>
            ))}
          </div>
          <button className={s.summaryAddLine} onClick={addLine}>+ Add line</button>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setShowSummary(false)}>Cancel</button>
            <button className={s.btnOk} onClick={handleSaveSummary}>Done</button>
          </div>
        </Modal>
      )}

      {printPayroll?._printMode && printSlot && (
        <PrintView
          project={project}
          folder={folder}
          slot={printSlot}
          payroll={printPayroll}
          onClose={() => setPrintPayroll(null)}
        />
      )}

    </div>

    {showFullPrint && (
      <FolderPrint
        project={project}
        folder={folder}
        payrolls={payrolls}
        onClose={() => setShowFullPrint(false)}
      />
    )}
    </>
  )
}
