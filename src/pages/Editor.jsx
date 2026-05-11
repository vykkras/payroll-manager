import { useState, useMemo, useEffect, useRef } from 'react'
import { uid } from '../store/useStore'
import PayrollBuilder from '../components/PayrollBuilder'
import PrintView from '../components/PrintView'
import SummaryPrint from '../components/SummaryPrint'
import Modal from '../components/Modal'
import s from './Editor.module.css'

const BASE_POSITIONS = [
  { id: 'primero', posKey: 'primero', label: 'Primero', color: '#3949ab' },
  { id: 'segundo', posKey: 'segundo', label: 'Segundo', color: '#2e7d32' },
  { id: 'tercero', posKey: 'tercero', label: 'Tercero', color: '#e65100' },
]
const POS_COLORS  = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }
const POS_LABELS  = { primero: 'Primero', segundo: 'Segundo', tercero: 'Tercero' }

function buildSlots(extraSlots) {
  const result = []
  BASE_POSITIONS.forEach(base => {
    result.push({ ...base, base: true })
    extraSlots.filter(e => e.posKey === base.posKey).forEach(e =>
      result.push({ id: e.id, posKey: e.posKey, label: e.label, color: POS_COLORS[e.posKey], base: false })
    )
  })
  return result
}

// Evaluate =expr formulas (only digits and + - * / . ( ) allowed)
function evalFormula(str) {
  if (typeof str !== 'string' || !str.startsWith('=')) return str
  const expr = str.slice(1).replace(/\s/g, '')
  if (!expr) return str
  if (!/^[\d.+\-*/()]+$/.test(expr)) return str
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return (' + expr + ')')()
    if (typeof result === 'number' && isFinite(result)) {
      return String(parseFloat(result.toFixed(10)))
    }
  } catch { /* bad expression */ }
  return str
}

function normalizeRows(rows) {
  if (!rows) return { primero: [], segundo: [], tercero: [] }
  if (Array.isArray(rows)) return { primero: rows, segundo: [], tercero: [] }
  return { primero: [], segundo: [], tercero: [], ...rows }
}

// ── Data grid (fixed 30-row spreadsheet) ─────────────────────────────────────
const GRID_ROWS = 30

function initGrid(columns, folderRows, position) {
  const existing = normalizeRows(folderRows)[position] || []
  return Array.from({ length: GRID_ROWS }, (_, i) => {
    const ex = existing[i]
    const row = { id: ex?.id || uid() }
    columns.forEach(c => { row[c.id] = ex?.[c.id] ?? '' })
    return row
  })
}

function flattenFolders(folders, depth = 0, result = []) {
  for (const f of folders) {
    result.push({ folder: f, depth })
    flattenFolders(f.folders || [], depth + 1, result)
  }
  return result
}

function DataGrid({ store, project, folder, position, mirrorPositions, onRowSelChange, deleteSignal }) {
  const columns = project.columns || []

  const [grid, setGridState] = useState(() => initGrid(columns, folder.rows, position))
  const gridRef = useRef(grid)
  function setGrid(updater) {
    const next = typeof updater === 'function' ? updater(gridRef.current) : updater
    gridRef.current = next
    setGridState(next)
  }

  // ── History (undo) ───────────────────────────────────────────────────────────
  const historyRef = useRef([])
  const folderRef  = useRef(folder)
  useEffect(() => { folderRef.current = folder }, [folder])

  function commitGrid(newGrid) {
    historyRef.current = [...historyRef.current.slice(-29), gridRef.current.map(r => ({ ...r }))]
    setGrid(newGrid)
    const nonEmpty = newGrid.filter(row => columns.some(c => row[c.id] !== '' && row[c.id] != null))
    const base = normalizeRows(folderRef.current.rows)
    const update = { ...base, [position]: nonEmpty }
    if (mirrorPositions?.length) mirrorPositions.forEach(p => { update[p] = nonEmpty })
    store.setFolderRows(project.id, folderRef.current.id, update)
  }

  // ── Cell selection ───────────────────────────────────────────────────────────
  const [sel, setSel] = useState(null)         // { r1, c1, r2, c2 } normalised
  const selRef        = useRef(null)
  const dragStart     = useRef(null)
  const mouseDown     = useRef(false)

  // ── Grid filter (must be declared before totals) ─────────────────────────────
  const [gridFilter, setGridFilter] = useState({})

  // ── Row selection (copy-to-crew) ─────────────────────────────────────────────
  const [rowSel, setRowSelInner] = useState(new Set())
  const rowSelRef    = useRef(new Set())
  const lastRowClick = useRef(null)

  function setRowSel(next) {
    rowSelRef.current = next
    setRowSelInner(new Set(next))
    onRowSelChange?.([...next], [...next].map(i => gridRef.current[i]).filter(Boolean))
  }

  function handleRowNumClick(e, rowIdx) {
    e.stopPropagation()
    if (e.shiftKey && lastRowClick.current !== null) {
      const lo = Math.min(lastRowClick.current, rowIdx)
      const hi = Math.max(lastRowClick.current, rowIdx)
      const next = new Set(rowSelRef.current)
      for (let i = lo; i <= hi; i++) next.add(i)
      setRowSel(next)
    } else {
      const next = new Set(rowSelRef.current)
      if (next.has(rowIdx)) { next.delete(rowIdx) } else { next.add(rowIdx); lastRowClick.current = rowIdx }
      setRowSel(next)
    }
  }

  function normSel(r1, c1, r2, c2) {
    return { r1: Math.min(r1,r2), c1: Math.min(c1,c2), r2: Math.max(r1,r2), c2: Math.max(c1,c2) }
  }

  function startSel(e, rowIdx, colIdx) {
    mouseDown.current = true
    if (e.shiftKey && selRef.current) {
      const ns = normSel(selRef.current.r1, selRef.current.c1, rowIdx, colIdx)
      setSel(ns); selRef.current = ns
    } else {
      dragStart.current = { row: rowIdx, col: colIdx }
      const ns = normSel(rowIdx, colIdx, rowIdx, colIdx)
      setSel(ns); selRef.current = ns
    }
  }

  function extendSel(rowIdx, colIdx) {
    if (!mouseDown.current || !dragStart.current) return
    const ns = normSel(dragStart.current.row, dragStart.current.col, rowIdx, colIdx)
    setSel(ns); selRef.current = ns
  }

  useEffect(() => {
    const onUp = () => { mouseDown.current = false; dragStart.current = null }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])

  // ── Delete selected rows (triggered by button signal) ───────────────────────
  useEffect(() => {
    if (!deleteSignal) return
    const indices = rowSelRef.current
    if (indices.size === 0) return
    const kept = gridRef.current.filter((_, i) => !indices.has(i))
    const blanks = Array.from({ length: indices.size }, () => {
      const row = { id: uid() }
      columns.forEach(c => { row[c.id] = '' })
      return row
    })
    setRowSel(new Set())
    lastRowClick.current = null
    commitGrid([...kept, ...blanks])
  }, [deleteSignal])

  // ── Copy / Paste / Undo ──────────────────────────────────────────────────────
  useEffect(() => {
    async function onKey(e) {
      if (!(e.ctrlKey || e.metaKey)) return

      if (e.key === 'z') {
        e.preventDefault()
        const prev = historyRef.current.pop()
        if (!prev) return
        setGrid(prev)
        const nonEmpty = prev.filter(row => columns.some(c => row[c.id] !== '' && row[c.id] != null))
        const base = normalizeRows(folderRef.current.rows)
        store.setFolderRows(project.id, folderRef.current.id, { ...base, [position]: nonEmpty })
        return
      }

      const s = selRef.current
      if (!s) return

      if (e.key === 'c') {
        e.preventDefault()
        const lines = []
        for (let r = s.r1; r <= s.r2; r++) {
          const row = gridRef.current[r]
          lines.push(columns.slice(s.c1, s.c2 + 1).map(c => row[c.id] ?? '').join('\t'))
        }
        try { await navigator.clipboard.writeText(lines.join('\n')) } catch {}
      }

      if (e.key === 'v') {
        e.preventDefault()
        try {
          const text = await navigator.clipboard.readText()
          if (!text) return
          const pasteRows = text.split('\n').map(r => r.split('\t'))
          const newGrid = gridRef.current.map(r => ({ ...r }))
          pasteRows.forEach((cells, ri) => {
            const rowIdx = s.r1 + ri
            if (rowIdx >= GRID_ROWS) return
            cells.forEach((val, ci) => {
              const colIdx = s.c1 + ci
              if (colIdx >= columns.length) return
              newGrid[rowIdx] = { ...newGrid[rowIdx], [columns[colIdx].id]: val }
            })
          })
          commitGrid(newGrid)
        } catch {}
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [columns, position, mirrorPositions, store, project])

  // ── Totals (respects active filter) ─────────────────────────────────────────
  const totals = useMemo(() => {
    const filterCols = columns.filter(c => c.filter)
    const visibleRows = grid.filter(row =>
      filterCols.every(c => !gridFilter[c.id] || row[c.id] === gridFilter[c.id])
    )
    const t = {}
    columns.forEach(col => {
      if (!col.sum) return
      const nums = visibleRows.map(r => parseFloat(r[col.id])).filter(n => !isNaN(n))
      if (nums.length > 0) t[col.id] = nums.reduce((a, b) => a + b, 0)
    })
    return t
  }, [grid, columns, gridFilter])

  function handleChange(rowIdx, colId, val) {
    setGrid(prev => prev.map((r, i) => i === rowIdx ? { ...r, [colId]: val } : r))
  }

  function handleBlur(rowIdx, colId) {
    const current = gridRef.current
    const val = current[rowIdx][colId]
    const computed = evalFormula(val)
    const finalGrid = computed !== val
      ? current.map((r, i) => i === rowIdx ? { ...r, [colId]: computed } : r)
      : current
    commitGrid(finalGrid)
  }

  function focusCell(tbody, rowIdx, colIdx) {
    const rows = tbody?.querySelectorAll('tr')
    const inputs = rows?.[rowIdx]?.querySelectorAll('input')
    const input = inputs?.[colIdx]
    if (input) { input.focus(); input.select() }
  }

  function handleKeyDown(e, rowIdx, colIdx) {
    const tbody = e.target.closest('tbody')
    const { selectionStart, selectionEnd, value } = e.target
    const atStart = selectionStart === 0 && selectionEnd === 0
    const atEnd   = selectionStart === value.length && selectionEnd === value.length

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (rowIdx + 1 < GRID_ROWS) focusCell(tbody, rowIdx + 1, colIdx)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx > 0) focusCell(tbody, rowIdx - 1, colIdx)
    } else if (e.key === 'ArrowLeft' && atStart) {
      e.preventDefault()
      if (colIdx > 0) focusCell(tbody, rowIdx, colIdx - 1)
      else if (rowIdx > 0) focusCell(tbody, rowIdx - 1, columns.length - 1)
    } else if (e.key === 'ArrowRight' && atEnd) {
      e.preventDefault()
      if (colIdx < columns.length - 1) focusCell(tbody, rowIdx, colIdx + 1)
      else if (rowIdx + 1 < GRID_ROWS) focusCell(tbody, rowIdx + 1, 0)
    }
  }

  // ── Grid filter ──────────────────────────────────────────────────────────────
  const filterCols = columns.filter(c => c.filter)
  const hasActiveFilter = filterCols.some(c => gridFilter[c.id])

  // Unique values per filter column (from non-empty rows)
  const filterOptions = {}
  filterCols.forEach(c => {
    filterOptions[c.id] = [...new Set(
      grid.map(r => r[c.id]).filter(v => v !== '' && v != null)
    )].sort()
  })

  function isRowVisible(row) {
    if (!hasActiveFilter) return true
    return filterCols.every(c => !gridFilter[c.id] || row[c.id] === gridFilter[c.id])
  }

  if (columns.length === 0) {
    return (
      <div className={s.tableWrap}>
        <div className={s.noColsPrompt}>
          <span>No columns defined.</span>
          <span>Go to project Settings → Columns tab.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.tableWrap}>
      {filterCols.length > 0 && (
        <div className={s.filterBar}>
          {filterCols.map(c => (
            <div key={c.id} className={s.filterItem}>
              <span className={s.filterLabel}>{c.name}</span>
              <select
                className={s.filterSelect}
                value={gridFilter[c.id] || ''}
                onChange={e => setGridFilter(f => ({ ...f, [c.id]: e.target.value }))}
              >
                <option value="">All</option>
                {filterOptions[c.id].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
          {hasActiveFilter && (
            <button className={s.filterClear} onClick={() => setGridFilter({})}>✕ Clear</button>
          )}
        </div>
      )}
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.rowNumHead}>#</th>
              {columns.map(c => <th key={c.id}>{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIdx) => {
              const visible = isRowVisible(row)
              return (
              <tr key={row.id} className={`${s.dataRow} ${rowIdx % 2 === 1 ? s.rowAlt : ''} ${rowSel.has(rowIdx) ? s.rowSelected : ''} ${!visible ? s.rowDimmed : ''}`}>
                <td
                  className={`${s.rowNum} ${rowSel.has(rowIdx) ? s.rowNumSel : ''}`}
                  onClick={e => handleRowNumClick(e, rowIdx)}
                  title="Click to select row"
                >
                  {rowSel.has(rowIdx) ? '✓' : rowIdx + 1}
                </td>
                {columns.map((c, colIdx) => {
                  const selected = sel && rowIdx >= sel.r1 && rowIdx <= sel.r2 && colIdx >= sel.c1 && colIdx <= sel.c2
                  return (
                    <td
                      key={c.id}
                      className={`${s.cellTd} ${selected ? s.cellSelected : ''}`}
                      onMouseDown={e => startSel(e, rowIdx, colIdx)}
                      onMouseEnter={() => extendSel(rowIdx, colIdx)}
                    >
                      <span className={s.cellSizer}>{row[c.id] || ' '}</span>
                      <input
                        className={s.cellInput}
                        value={row[c.id] ?? ''}
                        onChange={e => handleChange(rowIdx, c.id, e.target.value)}
                        onBlur={() => handleBlur(rowIdx, c.id)}
                        onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                      />
                    </td>
                  )
                })}
              </tr>
            )})}

          </tbody>
          {Object.keys(totals).length > 0 && (
            <tfoot>
              <tr className={s.totalsRow}>
                <td />
                {columns.map(c => (
                  <td key={c.id} className={totals[c.id] !== undefined ? s.totalVal : ''}>
                    {totals[c.id] !== undefined ? Number(totals[c.id]).toLocaleString('en-US') : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Main Editor component ─────────────────────────────────────────────────────
export default function Editor({ store, project, folder, editPayroll, onBack }) {
  const [extraSlots, setExtraSlots] = useState(() => editPayroll?.extraSlots || [])
  const slots = buildSlots(extraSlots)
  const [activeSlotId, setActiveSlotId] = useState(editPayroll?.position || 'primero')
  const [all2Target,   setAll2Target]   = useState('segundo')
  const [addTwo,       setAddTwo]       = useState(false)
  const [addAll,       setAddAll]       = useState(false)
  const [clearKey,     setClearKey]     = useState(0)
  const [savedMsg,      setSavedMsg]      = useState(false)
  const [showClear,     setShowClear]     = useState(false)
  const [printSlot,     setPrintSlot]     = useState(null)
  const [showPrintPick, setShowPrintPick] = useState(false)
  const [showPrint,     setShowPrint]     = useState(false)
  const [summaryData,   setSummaryData]   = useState(null)
  const [draft,        setDraft]        = useState(editPayroll || null)
  const [showLeft,     setShowLeft]     = useState(true)
  const [showRight,    setShowRight]    = useState(true)
  const [copyRows,      setCopyRows]      = useState([])
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTarget,    setCopyTarget]    = useState(null)
  const [copyToPos,     setCopyToPos]     = useState('primero')
  const [copiedMsg,     setCopiedMsg]     = useState('')
  const [deleteSignal,  setDeleteSignal]  = useState(0)

  const activeSlot = slots.find(s => s.id === activeSlotId) || slots[0]
  const posKey = activeSlot.posKey

  useEffect(() => { setCopyRows([]) }, [activeSlotId])

  function handleRowSelChange(indices, rows) {
    setCopyRows(rows)
  }

  const columnSums = useMemo(() => {
    const rows = normalizeRows(folder.rows)
    const result = {}
    ;['primero', 'segundo', 'tercero'].forEach(pos => {
      const posRows = rows[pos] || []
      const sums = {}
      ;(project.columns || []).forEach(col => {
        const nums = posRows.map(r => parseFloat(r[col.id])).filter(n => !isNaN(n))
        if (nums.length > 0) sums[col.name.trim().toLowerCase()] = nums.reduce((a, b) => a + b, 0)
      })
      result[pos] = sums
    })
    return result
  }, [folder.rows, project.columns])

  function handleAddSlot(posKey) {
    const slotId = uid()
    const existing = extraSlots.filter(s => s.posKey === posKey).length
    const label = `${POS_LABELS[posKey]} ${existing + 2}`
    setExtraSlots(prev => [...prev, { id: slotId, posKey, label }])
    setActiveSlotId(slotId)
  }

  function handleRemoveSlot(slotId) {
    setExtraSlots(prev => prev.filter(s => s.id !== slotId))
    const slot = extraSlots.find(s => s.id === slotId)
    setActiveSlotId(slot ? slot.posKey : 'primero')
  }

  function handlePayrollSave(payroll) {
    // Snapshot current production rows + active extra slots into the payroll
    const payrollWithRows = { ...payroll, rows: folder.rows, extraSlots }
    store.savePayroll(project.id, folder.id, payrollWithRows)
    setDraft(payrollWithRows)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2200)
  }

  function handleClear() {
    store.clearFolderRows(project.id, folder.id)
    setClearKey(k => k + 1)
    setShowClear(false)
  }

  return (
  <>
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>←</button>
        <div className={s.breadcrumb}>
          <span className={s.projName}>{project.name}</span>
          <span className={s.sep}>/</span>
          <span>{folder.name}</span>
        </div>
        <button className={s.printBtn} onClick={() => { setPrintSlot(activeSlot); setShowPrintPick(true) }}>🖨 Print</button>
        <button className={s.clearBtn} onClick={() => setShowClear(true)}>⊘ Clear All</button>
      </header>

      <div className={s.body}>
        {/* Left: per-position data table */}
        {showLeft && <div className={`${s.leftPanel} ${!showRight ? s.panelFull : ''}`}>
          {/* Position tabs */}
          <div className={s.posTabs}>
            {slots.map(slot => (
              <div key={slot.id} className={s.posTabWrap}>
                <button
                  className={`${s.posTab} ${activeSlotId === slot.id ? s.posTabActive : ''}`}
                  style={activeSlotId === slot.id ? { '--tab-color': slot.color, borderBottomColor: slot.color, color: slot.color } : {}}
                  onClick={() => setActiveSlotId(slot.id)}
                >
                  {slot.label}
                  {!slot.base && (
                    <span className={s.slotClose} onClick={e => { e.stopPropagation(); handleRemoveSlot(slot.id) }}>×</span>
                  )}
                </button>
                {slot.base && (
                  <button className={s.slotAdd} onClick={() => handleAddSlot(slot.posKey)} title={`Add another ${slot.label}`}>+</button>
                )}
              </div>
            ))}
          </div>
          <div className={s.panelTitle}>
            <span style={{ color: activeSlot?.color }}>{activeSlot?.label} — Production Data</span>
            <div className={s.panelTitleRight}>
              <button
                className={`${s.addAllBtn} ${addTwo && !addAll ? s.addAllBtnOn : ''}`}
                onClick={() => { setAddTwo(v => !v); setAddAll(false) }}
                title="Mirror edits to Segundo"
              >{addTwo && !addAll ? '● All 2' : '○ All 2'}</button>
              <button
                className={`${s.addAllBtn} ${addAll ? s.addAllBtnOn : ''}`}
                onClick={() => { setAddAll(v => !v); setAddTwo(false) }}
                title="Mirror edits to all positions"
              >{addAll ? '● All 3' : '○ All 3'}</button>
              {copyRows.length > 0 && (
                <>
                  <button
                    className={s.copyRowsBtn}
                    onClick={() => { setCopyTarget(null); setCopyToPos(posKey); setShowCopyModal(true) }}
                    title="Copy selected rows to another crew"
                  >
                    Copy {copyRows.length} row{copyRows.length !== 1 ? 's' : ''} →
                  </button>
                  <button
                    className={s.deleteRowsBtn}
                    onClick={() => setDeleteSignal(v => v + 1)}
                    title="Delete selected rows"
                  >
                    Delete {copyRows.length}
                  </button>
                </>
              )}
              <button className={s.panelToggleBtnLight} onClick={() => setShowLeft(false)} title="Hide production data">◀ Hide</button>
            </div>
          </div>
          {copiedMsg && <div className={s.copiedBanner}>{copiedMsg}</div>}
          <DataGrid
            key={activeSlotId + '-' + clearKey}
            store={store}
            project={project}
            folder={folder}
            position={activeSlotId}
            mirrorPositions={addAll ? ['segundo', 'tercero'] : addTwo ? ['segundo'] : []}
            onRowSelChange={handleRowSelChange}
            deleteSignal={deleteSignal}
          />
        </div>}

        {/* Show-left button when left is hidden */}
        {!showLeft && (
          <button className={s.revealBtn} onClick={() => setShowLeft(true)} title="Show production data">▶ Data</button>
        )}

        {/* Right: payroll builder */}
        {showRight && <div className={`${s.rightPanel} ${!showLeft ? s.panelFull : ''}`}>
          {savedMsg && <div className={s.savedBanner}>✓ Saved to {folder.name}!</div>}
          <div className={s.payrollPanelTitle}>
            <span>Payroll Builder</span>
            <button className={s.panelToggleBtnLight} onClick={() => setShowRight(false)} title="Hide payroll">Hide ▶</button>
          </div>
          <div className={s.payrollWrap}>
            <PayrollBuilder
              config={{ items: project.items || [] }}
              editPayroll={draft}
              defaultPeriod={folder.name}
              columnSums={columnSums}
              slots={slots}
              activeSlotId={activeSlotId}
              onSlotChange={setActiveSlotId}
              all2Target={all2Target}
              onAll2TargetChange={setAll2Target}
              onSave={handlePayrollSave}
              onClose={null}
              onPrintSummary={setSummaryData}
            />
          </div>
        </div>}

        {/* Show-right button when right is hidden */}
        {!showRight && (
          <button className={s.revealBtn} style={{ marginLeft: 'auto' }} onClick={() => setShowRight(true)} title="Show payroll">◀ Payroll</button>
        )}
      </div>

      {showPrintPick && (
        <Modal title="Print — select position" onClose={() => setShowPrintPick(false)}>
          <div className={s.printPosRow}>
            {slots.map(slot => (
              <button
                key={slot.id}
                className={`${s.printPosBtn} ${printSlot?.id === slot.id ? s.printPosBtnOn : ''}`}
                style={printSlot?.id === slot.id ? { background: slot.color, borderColor: slot.color } : {}}
                onClick={() => setPrintSlot(slot)}
              >{slot.label}</button>
            ))}
          </div>
          <div className={s.delFooter}>
            <button className={s.btnCancel} onClick={() => setShowPrintPick(false)}>Cancel</button>
            <button className={s.btnDel} style={{ background: '#1a1a2e' }} onClick={() => { setShowPrintPick(false); setShowPrint(true) }}>Open Print Preview</button>
          </div>
        </Modal>
      )}

      {showClear && (
        <Modal title="Clear everything?" onClose={() => setShowClear(false)}>
          <p className={s.delMsg}>This deletes all production rows for all positions. The payroll builder and saved payrolls are not affected.</p>
          <div className={s.delFooter}>
            <button className={s.btnCancel} onClick={() => setShowClear(false)}>Cancel</button>
            <button className={s.btnDel} onClick={handleClear}>Clear All</button>
          </div>
        </Modal>
      )}
    </div>

    {showPrint && printSlot && (
      <PrintView
        project={project}
        folder={folder}
        slot={printSlot}
        payroll={draft}
        onClose={() => setShowPrint(false)}
      />
    )}

    {summaryData && (
      <SummaryPrint
        project={project}
        folder={folder}
        summary={summaryData}
        onClose={() => setSummaryData(null)}
      />
    )}

    {showCopyModal && (() => {
      const posOpt = BASE_POSITIONS.find(b => b.posKey === copyToPos) || BASE_POSITIONS[0]

      // Build flat list: folder headers + individual payroll rows
      const items = []
      function buildItems(folders, depth) {
        for (const f of folders) {
          items.push({ type: 'header', folder: f, depth })
          for (const pr of (f.payrolls || [])) {
            items.push({ type: 'payroll', folder: f, payroll: pr, depth: depth + 1 })
          }
          buildItems(f.folders || [], depth + 1)
        }
      }
      buildItems(project.folders || [], 0)

      const payrollItems = items.filter(i => i.type === 'payroll')

      return (
        <Modal
          title={`Copy ${copyRows.length} row${copyRows.length !== 1 ? 's' : ''} to crew`}
          onClose={() => setShowCopyModal(false)}
          wide
        >
          {/* Which position in the target to land in */}
          <div className={s.copyPosRow}>
            <span className={s.copyPosLabel}>Into:</span>
            {BASE_POSITIONS.map(base => (
              <button
                key={base.posKey}
                className={`${s.copyPosBtn} ${copyToPos === base.posKey ? s.copyPosBtnOn : ''}`}
                style={copyToPos === base.posKey ? { background: base.color, borderColor: base.color } : {}}
                onClick={() => { setCopyToPos(base.posKey); setCopyTarget(null) }}
              >
                {base.label}
              </button>
            ))}
          </div>

          {/* Crew list — one row per payroll, folder names as section headers */}
          <div className={s.crewList}>
            {payrollItems.length === 0
              ? <p className={s.crewItemEmpty}>No saved payrolls in this project yet.</p>
              : items.map(item => {
                  if (item.type === 'header') {
                    const hasChildren = items.some(i => i.type === 'payroll' && i.folder.id === item.folder.id)
                      || (item.folder.folders || []).length > 0
                    if (!hasChildren) return null
                    return (
                      <div key={item.folder.id} className={s.crewHeader}
                        style={{ paddingLeft: `${12 + item.depth * 16}px` }}>
                        {item.folder.name}
                      </div>
                    )
                  }
                  // type === 'payroll'
                  const crewName = item.payroll.crewNames?.[copyToPos] || ''
                  const isCurrent = item.payroll.id === editPayroll?.id
                  if (isCurrent) {
                    return (
                      <div key={item.payroll.id} className={s.crewItemCurrent}
                        style={{ paddingLeft: `${20 + item.depth * 16}px` }}>
                        {crewName || item.folder.name}
                        <span className={s.crewItemSub}> — current</span>
                      </div>
                    )
                  }
                  const isSelected = copyTarget?.payroll?.id === item.payroll.id
                  return (
                    <button key={item.payroll.id}
                      className={`${s.crewItem} ${isSelected ? s.crewItemSel : ''}`}
                      style={{ paddingLeft: `${20 + item.depth * 16}px` }}
                      onClick={() => setCopyTarget({ folder: item.folder, payroll: item.payroll })}
                    >
                      {crewName
                        ? <><strong>{crewName}</strong><span className={s.crewItemSub}> — {item.folder.name}</span></>
                        : item.folder.name}
                    </button>
                  )
                })
            }
          </div>

          <div className={s.delFooter}>
            <button className={s.btnCancel} onClick={() => setShowCopyModal(false)}>Cancel</button>
            <button
              className={s.btnSaveRow}
              style={!copyTarget ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              onClick={() => {
                if (!copyTarget) return
                const freshRows = copyRows.map(r => ({ ...r, id: uid() }))
                store.appendPayrollRows(project.id, copyTarget.folder.id, copyTarget.payroll.id, freshRows, copyToPos)
                setShowCopyModal(false)
                const name = copyTarget.payroll.crewNames?.[copyToPos] || copyTarget.folder.name
                setCopiedMsg(`✓ Copied to ${name} (${posOpt.label})!`)
                setTimeout(() => setCopiedMsg(''), 2500)
              }}
            >
              {copyTarget
                ? `Copy → ${copyTarget.payroll.crewNames?.[copyToPos] || copyTarget.folder.name}`
                : `Copy to ${posOpt.label} →`}
            </button>
          </div>
        </Modal>
      )
    })()}
  </>
  )
}
