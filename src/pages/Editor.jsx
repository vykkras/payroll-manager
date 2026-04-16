import { useState, useMemo } from 'react'
import { uid } from '../store/useStore'
import PayrollBuilder from '../components/PayrollBuilder'
import PrintView from '../components/PrintView'
import Modal from '../components/Modal'
import s from './Editor.module.css'

const POSITIONS = [
  { key: 'primero', label: 'Primero', color: '#3949ab' },
  { key: 'segundo', label: 'Segundo', color: '#2e7d32' },
  { key: 'tercero', label: 'Tercero', color: '#e65100' },
]

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
function EditableRow({ row, columns, onSave, onDelete }) {
  const [vals, setVals] = useState(() => {
    const v = {}
    columns.forEach(c => { v[c.id] = row[c.id] ?? '' })
    return v
  })

  function handleBlur(colId) {
    const computed = evalFormula(vals[colId])
    const finalVals = { ...vals, [colId]: computed }
    if (computed !== vals[colId]) setVals(finalVals)
    onSave({ ...row, ...finalVals })
  }

  return (
    <tr className={s.dataRow}>
      {columns.map(c => (
        <td key={c.id} className={s.cellTd}>
          <input
            className={s.cellInput}
            value={vals[c.id] ?? ''}
            onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))}
            onBlur={() => handleBlur(c.id)}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
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
function DataTable({ store, project, folder, position, addAll, addTwo }) {
  const columns = project.columns || []
  const allRows  = normalizeRows(folder.rows)
  const rows     = allRows[position] || []

  const [filters,  setFilters] = useState({})
  const [newRow,   setNewRow]  = useState(() => {
    const v = {}; columns.forEach(c => { v[c.id] = '' }); return v
  })
  const [delRowId, setDelRowId] = useState(null)

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
    const targets = addAll ? ['primero', 'segundo', 'tercero'] : addTwo ? ['primero', 'segundo'] : [position]
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

// ── Draft helpers ─────────────────────────────────────────────────────────────
function draftKey(pid, fid) { return `payroll_draft_${pid}_${fid}` }
function loadDraft(pid, fid) {
  try { return JSON.parse(localStorage.getItem(draftKey(pid, fid))) || null } catch { return null }
}
function saveDraft(pid, fid, payroll) {
  localStorage.setItem(draftKey(pid, fid), JSON.stringify(payroll))
}
function clearDraft(pid, fid) {
  localStorage.removeItem(draftKey(pid, fid))
}

// ── Main Editor component ─────────────────────────────────────────────────────
export default function Editor({ store, project, folder, onBack }) {
  const [position,   setPosition]   = useState('primero')
  const [addAll,     setAddAll]     = useState(false)   // all 3
  const [addTwo,     setAddTwo]     = useState(false)   // primero + segundo only
  const [savedMsg,   setSavedMsg]   = useState(false)
  const [showClear,  setShowClear]  = useState(false)
  const [showPrint,  setShowPrint]  = useState(false)
  const [draft,      setDraft]      = useState(() => loadDraft(project.id, folder.id))

  const posInfo = POSITIONS.find(p => p.key === position)

  function handlePayrollSave(payroll) {
    store.savePayroll(project.id, folder.id, payroll)
    saveDraft(project.id, folder.id, payroll)
    setDraft(payroll)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2200)
  }

  function handleClear() {
    store.clearFolderRows(project.id, folder.id)
    setShowClear(false)
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>←</button>
        <div className={s.breadcrumb}>
          <span className={s.projName}>{project.name}</span>
          <span className={s.sep}>/</span>
          <span>{folder.name}</span>
        </div>
        <button className={s.printBtn} onClick={() => setShowPrint(true)}>🖨 Print</button>
        <button className={s.clearBtn} onClick={() => setShowClear(true)}>⊘ Clear All</button>
      </header>

      <div className={s.body}>
        {/* Left: per-position data table */}
        <div className={s.leftPanel}>
          {/* Position tabs */}
          <div className={s.posTabs}>
            {POSITIONS.map(p => (
              <button
                key={p.key}
                className={`${s.posTab} ${position === p.key ? s.posTabActive : ''}`}
                style={position === p.key ? { '--tab-color': p.color, borderBottomColor: p.color, color: p.color } : {}}
                onClick={() => setPosition(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className={s.panelTitle}>
            <span style={{ color: posInfo?.color }}>{posInfo?.label} — Production Data</span>
            <div className={s.addBtnGroup}>
              <button
                className={`${s.addAllBtn} ${addTwo ? s.addAllBtnOn : ''}`}
                onClick={() => { setAddTwo(v => !v); setAddAll(false) }}
                title="Add new rows to Primero + Segundo only"
              >{addTwo ? '● All 2' : '○ All 2'}</button>
              <button
                className={`${s.addAllBtn} ${addAll ? s.addAllBtnOn : ''}`}
                onClick={() => { setAddAll(v => !v); setAddTwo(false) }}
                title="Add new rows to all 3 positions"
              >{addAll ? '● All 3' : '○ All 3'}</button>
            </div>
          </div>
          <DataTable
            key={position}
            store={store}
            project={project}
            folder={folder}
            position={position}
            addAll={addAll}
            addTwo={addTwo}
          />
        </div>

        {/* Right: payroll builder */}
        <div className={s.rightPanel}>
          {savedMsg && <div className={s.savedBanner}>✓ Saved to {folder.name}!</div>}
          <PayrollBuilder
            config={{ items: project.items || [] }}
            editPayroll={draft}
            position={position}
            onPositionChange={setPosition}
            onSave={handlePayrollSave}
            onClose={null}
          />
        </div>
      </div>

      {showPrint && (
        <PrintView
          project={project}
          folder={folder}
          position={position}
          payroll={draft}
          onClose={() => setShowPrint(false)}
        />
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
  )
}
