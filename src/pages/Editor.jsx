import { useState, useMemo, useEffect } from 'react'
import { uid } from '../store/useStore'
import PayrollBuilder from '../components/PayrollBuilder'
import PrintView from '../components/PrintView'
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

// ── Editable row ──────────────────────────────────────────────────────────────
function EditableRow({ row, columns, onSave, onDelete, onDragStart, dragFill, onMouseEnter }) {
  const [vals, setVals] = useState(() => {
    const v = {}
    columns.forEach(c => { v[c.id] = row[c.id] ?? '' })
    return v
  })

  useEffect(() => {
    if (!dragFill) return
    const next = { ...vals, [dragFill.colId]: dragFill.value }
    setVals(next)
    onSave({ ...row, ...next })
  }, [dragFill])

  function handleBlur(colId) {
    const computed = evalFormula(vals[colId])
    const finalVals = { ...vals, [colId]: computed }
    if (computed !== vals[colId]) setVals(finalVals)
    onSave({ ...row, ...finalVals })
  }

  return (
    <tr className={s.dataRow} onMouseEnter={onMouseEnter}>
      {columns.map(c => (
        <td key={c.id} className={s.cellTd}>
          <input
            className={s.cellInput}
            value={vals[c.id] ?? ''}
            onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))}
            onBlur={() => handleBlur(c.id)}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          />
          <span
            className={s.dragHandle}
            onMouseDown={e => { e.preventDefault(); onDragStart(c.id, vals[c.id]) }}
          />
        </td>
      ))}
      <td className={s.actionsCell}>
        <button className={s.delRowBtn} onClick={onDelete}>✕</button>
      </td>
    </tr>
  )
}

// ── Data table (per-position) ─────────────────────────────────────────────────
function DataTable({ store, project, folder, position, addAll, addTwo, all2Target }) {
  const columns = project.columns || []
  const allRows  = normalizeRows(folder.rows)
  const rows     = allRows[position] || []

  const [filters,       setFilters]       = useState({})
  const [newRow,        setNewRow]        = useState(() => {
    const v = {}; columns.forEach(c => { v[c.id] = '' }); return v
  })
  const [delRowId,      setDelRowId]      = useState(null)
  const [dragState,     setDragState]     = useState(null)   // { colId, value }
  const [dragFilledRows, setDragFilledRows] = useState(() => new Set())

  useEffect(() => {
    if (!dragState) return
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    function onMouseUp() {
      setDragState(null)
      setDragFilledRows(new Set())
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragState])

  function handleDragStart(colId, value) {
    setDragState({ colId, value })
    setDragFilledRows(new Set())
  }

  function handleRowEnter(rowId) {
    if (!dragState || dragFilledRows.has(rowId)) return
    setDragFilledRows(prev => { const n = new Set(prev); n.add(rowId); return n })
  }


  const filterCols = columns.filter(c => c.filter)

  const filterOptions = useMemo(() => {
    const opts = {}
    filterCols.forEach(col => {
      const subset = rows.filter(row =>
        Object.entries(filters).every(([cid, val]) =>
          cid === col.id || !val || String(row[cid] ?? '') === val
        )
      )
      const vals = [...new Set(subset.map(r => String(r[col.id] ?? '')).filter(Boolean))].sort()
      if (vals.length >= 1) opts[col.id] = vals
    })
    return opts
  }, [filterCols, rows, filters])

  const filteredRows = useMemo(() =>
    rows.filter(row =>
      Object.entries(filters).every(([cid, val]) => !val || String(row[cid] ?? '') === val)
    ), [rows, filters])

  const totals = useMemo(() => {
    const t = {}
    columns.forEach(col => {
      const nonempty = filteredRows.filter(r => r[col.id] !== '' && r[col.id] != null)
      if (nonempty.length === 0) return
      const nums = nonempty.map(r => parseFloat(r[col.id]))
      if (nums.every(n => !isNaN(n))) t[col.id] = nums.reduce((a, b) => a + b, 0)
    })
    return t
  }, [columns, filteredRows])

  const activeFilters = Object.values(filters).some(Boolean)
  const showFilterBar = filterCols.length > 0 && rows.length > 0

  function submitNewRow() {
    if (!Object.values(newRow).some(v => String(v).trim())) return
    const evaluated = {}
    Object.entries(newRow).forEach(([k, v]) => { evaluated[k] = evalFormula(v) })
    const targets = addAll ? ['primero', 'segundo', 'tercero'] : addTwo ? ['primero', all2Target || 'segundo'] : [position]
    targets.forEach(pos => store.addFolderRow(project.id, folder.id, { id: uid(), ...evaluated }, pos))
    const reset = {}; columns.forEach(c => { reset[c.id] = '' }); setNewRow(reset)
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
      {showFilterBar && (
        <div className={s.filterBar}>
          {filterCols.filter(c => filterOptions[c.id]).map(col => (
            <div key={col.id} className={s.filterItem}>
              <span className={s.filterLabel}>{col.name}</span>
              <select
                className={s.filterSelect}
                value={filters[col.id] || ''}
                onChange={e => setFilters(f => ({ ...f, [col.id]: e.target.value }))}
              >
                <option value="">All</option>
                {filterOptions[col.id].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
          {activeFilters && (
            <button className={s.clearFilters} onClick={() => setFilters({})}>✕ Clear</button>
          )}
          <span className={s.rowCount}>{filteredRows.length}/{rows.length} rows</span>
        </div>
      )}

      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {columns.map(c => <th key={c.id}>{c.name}</th>)}
              <th className={s.actionsHead}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <EditableRow
                key={row.id}
                row={row}
                columns={columns}
                onSave={updated => store.updateFolderRow(project.id, folder.id, updated, position)}
                onDelete={() => setDelRowId(row.id)}
                onDragStart={handleDragStart}
                dragFill={dragFilledRows.has(row.id) && dragState ? dragState : null}
                onMouseEnter={() => handleRowEnter(row.id)}
              />
            ))}
            <tr className={s.inlineAddRow}>
              {columns.map((c, i) => (
                <td key={c.id} className={s.inlineAddCell}>
                  <input
                    className={s.inlineAddInput}
                    value={newRow[c.id] ?? ''}
                    onChange={e => setNewRow(r => ({ ...r, [c.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && submitNewRow()}
                    placeholder={c.name}
                    autoFocus={i === 0 && rows.length === 0}
                  />
                </td>
              ))}
              <td className={s.actionsCell}>
                <button className={s.addRowSubmit} onClick={submitNewRow} title="Add row (Enter)">+</button>
              </td>
            </tr>
          </tbody>
          {Object.keys(totals).length > 0 && (
            <tfoot>
              <tr className={s.totalsRow}>
                {columns.map(c => (
                  <td key={c.id} className={totals[c.id] !== undefined ? s.totalVal : ''}>
                    {totals[c.id] !== undefined ? Number(totals[c.id]).toLocaleString('en-US') : ''}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {rows.length > 0 && (
        <div className={s.tableFooter}>
          <span className={s.totalNote}>
            {rows.length} row{rows.length !== 1 ? 's' : ''}
            {activeFilters ? ` · ${filteredRows.length} shown` : ''}
          </span>
        </div>
      )}

      {delRowId && (
        <Modal title="Delete row?" onClose={() => setDelRowId(null)}>
          <p className={s.delMsg}>This row will be permanently removed.</p>
          <div className={s.delFooter}>
            <button className={s.btnCancel} onClick={() => setDelRowId(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => {
              store.deleteFolderRow(project.id, folder.id, delRowId, position)
              setDelRowId(null)
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Main Editor component ─────────────────────────────────────────────────────
export default function Editor({ store, project, folder, editPayroll, onBack }) {
  const [extraSlots, setExtraSlots] = useState(() => editPayroll?.extraSlots || [])
  const slots = buildSlots(extraSlots)
  const [activeSlotId, setActiveSlotId] = useState(editPayroll?.position || 'primero')
  const [addAll,       setAddAll]       = useState(false)
  const [addTwo,       setAddTwo]       = useState(false)
  const [all2Target,   setAll2Target]   = useState('segundo')

  const segundoSlots = slots.filter(s => s.posKey === 'segundo')
  const showAll2Target = segundoSlots.length > 1
  const [savedMsg,      setSavedMsg]      = useState(false)
  const [showClear,     setShowClear]     = useState(false)
  const [printSlot,     setPrintSlot]     = useState(null)
  const [showPrintPick, setShowPrintPick] = useState(false)
  const [showPrint,     setShowPrint]     = useState(false)
  const [draft,        setDraft]        = useState(editPayroll || null)
  const [showLeft,     setShowLeft]     = useState(true)
  const [showRight,    setShowRight]    = useState(true)

  const activeSlot = slots.find(s => s.id === activeSlotId) || slots[0]
  const posKey = activeSlot.posKey

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
            <div className={s.addBtnGroup}>
              <button
                className={`${s.addAllBtn} ${addTwo ? s.addAllBtnOn : ''}`}
                onClick={() => { setAddTwo(v => !v); setAddAll(false) }}
                title="Add new rows to Primero + target"
              >{addTwo ? '● All 2' : '○ All 2'}</button>
              {showAll2Target && (
                <select
                  className={`${s.addAllBtn} ${s.targetSelect}`}
                  value={all2Target}
                  onChange={e => setAll2Target(e.target.value)}
                  title="All 2 target slot"
                >
                  {segundoSlots.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              )}
              <button
                className={`${s.addAllBtn} ${addAll ? s.addAllBtnOn : ''}`}
                onClick={() => { setAddAll(v => !v); setAddTwo(false) }}
                title="Add new rows to all 3 positions"
              >{addAll ? '● All 3' : '○ All 3'}</button>
            </div>
            <button className={s.panelToggleBtnLight} onClick={() => setShowLeft(false)} title="Hide production data">◀ Hide</button>
          </div>
          <DataTable
            key={activeSlotId}
            store={store}
            project={project}
            folder={folder}
            position={activeSlotId}
            addAll={addAll}
            addTwo={addTwo}
            all2Target={all2Target}
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
          <PayrollBuilder
            config={{ items: project.items || [] }}
            editPayroll={draft}
            slots={slots}
            activeSlotId={activeSlotId}
            onSlotChange={setActiveSlotId}
            all2Target={all2Target}
            onAll2TargetChange={setAll2Target}
            onSave={handlePayrollSave}
            onClose={null}
          />
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
  </>
  )
}
