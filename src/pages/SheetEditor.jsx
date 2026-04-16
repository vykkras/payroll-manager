import { useState, useMemo } from 'react'
import PayrollBuilder from '../components/PayrollBuilder'
import Modal from '../components/Modal'
import s from './SheetEditor.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const cleaned = String(val).replace(/[$,\s]/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function normalize(str) {
  return String(str)
    .replace(/[\u0000-\u001F\u007F-\u009F\u00A0\u200B-\u200D\uFEFF]/g, '')
    .trim().toLowerCase()
}

function buildColMap(rows, configCols) {
  if (!rows.length) return {}
  const keySet = new Set()
  for (const row of rows) Object.keys(row).forEach(k => keySet.add(k))
  const actualKeys = [...keySet]
  const map = {}
  for (const cfgCol of configCols) {
    if (!cfgCol) continue
    const needle = normalize(cfgCol)
    const match  = actualKeys.find(k => normalize(k) === needle)
    if (match) map[cfgCol] = match
  }
  return map
}

function getVal(row, cfgCol, colMap) {
  const key = colMap[cfgCol] ?? cfgCol
  return row[key]
}

function filterRows(rows, cfg, colMap, filters) {
  let result = rows
  if (cfg.filterMode === 'nonempty' && cfg.filterCol) {
    result = result.filter(r => String(getVal(r, cfg.filterCol, colMap) ?? '').trim() !== '')
  } else if (cfg.filterMode === 'equals' && cfg.filterCol) {
    result = result.filter(r =>
      String(getVal(r, cfg.filterCol, colMap) ?? '').trim().toLowerCase() === (cfg.filterVal || '').toLowerCase()
    )
  }
  if (filters.subsector && cfg.subsectorCol)
    result = result.filter(r => String(getVal(r, cfg.subsectorCol, colMap) ?? '') === filters.subsector)
  if (filters.crew && cfg.crewCol)
    result = result.filter(r => String(getVal(r, cfg.crewCol, colMap) ?? '') === filters.crew)
  if (filters.date && cfg.dateCol)
    result = result.filter(r => String(getVal(r, cfg.dateCol, colMap) ?? '') === filters.date)
  return result
}

function fmtNum(n) {
  if (!n && n !== 0) return '—'
  const num = Number(n)
  return isNaN(num) ? '—' : num.toLocaleString('en-US')
}

// ── PayrollSaveModal — picks folder + week then opens PayrollBuilder ──────────
function PayrollSaveModal({ store, project, onClose }) {
  const [step, setStep]       = useState('pick')   // 'pick' | 'build'
  const [folderId, setFolderI] = useState('')
  const [weekId,   setWeekId]  = useState('')
  const [savedMsg, setSavedMsg] = useState(false)

  const folders = project.folders || []
  const weeks   = folders.find(f => f.id === folderId)?.weeks || []

  function handleSave(payroll) {
    store.savePayroll(project.id, folderId, weekId, payroll)
    setSavedMsg(true)
    setTimeout(() => { setSavedMsg(false); onClose() }, 1800)
  }

  if (step === 'build') {
    return (
      <PayrollBuilder
        config={project.config}
        onSave={handleSave}
        onClose={onClose}
      />
    )
  }

  return (
    <div className={s.pickWrap}>
      <p className={s.pickHint}>Choose where to save the payroll:</p>
      <div className={s.pickRow}>
        <div className={s.pickField}>
          <label>Folder</label>
          <select value={folderId} onChange={e => { setFolderI(e.target.value); setWeekId('') }}>
            <option value="">— select folder —</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className={s.pickField}>
          <label>Week</label>
          <select value={weekId} onChange={e => setWeekId(e.target.value)} disabled={!folderId}>
            <option value="">— select week —</option>
            {weeks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>
      {savedMsg && <div className={s.savedMsg}>✓ Payroll saved!</div>}
      <div className={s.pickActions}>
        <button className={s.btnCancel} onClick={onClose}>Cancel</button>
        <button
          className={s.btnOpenEditor}
          disabled={!folderId || !weekId}
          onClick={() => setStep('build')}
        >Open Editor →</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SheetEditor({ store, project, sheet, onBack }) {
  const cfg = project.config || {}
  const [filters, setFilters]   = useState({ subsector: '', crew: '', date: '' })
  const [showEditor, setShowEditor] = useState(false)

  const colMap = useMemo(() => {
    const allCfgCols = [
      cfg.crewCol, cfg.subsectorCol, cfg.dateCol, cfg.addressCol,
      cfg.filterCol, ...(cfg.items || []).map(it => it.col)
    ].filter(Boolean)
    return buildColMap(sheet.rows, allCfgCols)
  }, [sheet.rows, cfg])

  const filteredRows = useMemo(() =>
    filterRows(sheet.rows, cfg, colMap, filters),
    [sheet.rows, cfg, colMap, filters]
  )

  const subsectors = useMemo(() => {
    if (!cfg.subsectorCol) return []
    return [...new Set(sheet.rows.map(r => String(getVal(r, cfg.subsectorCol, colMap) ?? '')).filter(Boolean))].sort()
  }, [sheet.rows, cfg.subsectorCol, colMap])

  const crews = useMemo(() => {
    if (!cfg.crewCol) return []
    return [...new Set(sheet.rows.map(r => String(getVal(r, cfg.crewCol, colMap) ?? '')).filter(Boolean))].sort()
  }, [sheet.rows, cfg.crewCol, colMap])

  const dates = useMemo(() => {
    if (!cfg.dateCol) return []
    return [...new Set(sheet.rows.map(r => String(getVal(r, cfg.dateCol, colMap) ?? '')).filter(Boolean))].sort()
  }, [sheet.rows, cfg.dateCol, colMap])

  const summary = useMemo(() => {
    return (cfg.items || []).map(item => ({
      ...item,
      total: filteredRows.reduce((sum, row) => sum + parseNum(getVal(row, item.col, colMap)), 0),
    }))
  }, [cfg.items, filteredRows, colMap])

  const unmatchedCols = summary.filter(it => it.col && !colMap[it.col]).map(it => it.col)

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>← {project.name}</button>
        <div className={s.breadcrumb}>
          <span>{project.name}</span>
          <span className={s.sep}>/</span>
          <span className={s.sheetLabel}>{sheet.name}</span>
        </div>
        <button className={s.btnOpenEditor} onClick={() => setShowEditor(true)}>
          Open Editor ✏
        </button>
      </header>

      {/* Subsector filter buttons */}
      {subsectors.length > 0 && (
        <div className={s.subBtnsBar}>
          <span className={s.subBtnsLabel}>{cfg.subsectorLabel || 'Subsector'}</span>
          <button
            className={`${s.subBtn} ${filters.subsector === '' ? s.subBtnActive : ''}`}
            onClick={() => setFilters(f => ({ ...f, subsector: '' }))}
          >All</button>
          {subsectors.map(v => (
            <button
              key={v}
              className={`${s.subBtn} ${filters.subsector === v ? s.subBtnActive : ''}`}
              onClick={() => setFilters(f => ({ ...f, subsector: f.subsector === v ? '' : v }))}
            >{v}</button>
          ))}
          {(crews.length > 0 || dates.length > 0) && <div className={s.divider} />}
          {crews.length > 0 && <>
            <span className={s.subBtnsLabel}>{cfg.crewLabel || 'Crew'}</span>
            <select className={s.filterSelect} value={filters.crew} onChange={e => setFilters(f => ({ ...f, crew: e.target.value }))}>
              <option value="">All</option>
              {crews.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </>}
          {dates.length > 0 && <>
            <div className={s.divider} />
            <span className={s.subBtnsLabel}>Date</span>
            <select className={s.filterSelect} value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}>
              <option value="">All</option>
              {dates.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </>}
          <span className={s.recordCount}>{filteredRows.length} / {sheet.rows.length} rows</span>
        </div>
      )}

      {/* No subsectors but has other filters */}
      {subsectors.length === 0 && (crews.length > 0 || dates.length > 0) && (
        <div className={s.filterBar}>
          {crews.length > 0 && <>
            <span className={s.filterLabel}>{cfg.crewLabel || 'Crew'}</span>
            <select className={s.filterSelect} value={filters.crew} onChange={e => setFilters(f => ({ ...f, crew: e.target.value }))}>
              <option value="">All</option>
              {crews.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </>}
          {dates.length > 0 && <>
            {crews.length > 0 && <div className={s.divider} />}
            <span className={s.filterLabel}>Date</span>
            <select className={s.filterSelect} value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}>
              <option value="">All</option>
              {dates.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </>}
          <span className={s.recordCount}>{filteredRows.length} / {sheet.rows.length} rows</span>
        </div>
      )}

      <div className={s.summaryPage}>
        <div className={s.panelHeader}>
          <span className={s.panelTitle}>Production Summary</span>
          <span className={s.panelSub}>
            {filters.subsector ? `${cfg.subsectorLabel || 'Subsector'}: ${filters.subsector} · ` : ''}
            {filteredRows.length} rows
          </span>
        </div>
        <div className={s.summaryWrap}>
          {unmatchedCols.length > 0 && (
            <div className={s.colWarn}>
              <strong>Not matched:</strong> {unmatchedCols.map(c => `"${c}"`).join(', ')}<br />
              <strong>Sheet columns:</strong> {[...new Set(sheet.rows.flatMap(r => Object.keys(r)))].join(', ')}
            </div>
          )}
          {summary.length === 0 ? (
            <div className={s.noConfig}>No line items configured — go to Config tab.</div>
          ) : (
            <table className={s.summaryTable}>
              <thead><tr><th>Item</th><th>Unit</th><th className={s.r}>Total</th></tr></thead>
              <tbody>
                {summary.map((item, i) => (
                  <tr key={i}>
                    <td className={s.itemName}>{item.label}</td>
                    <td className={s.itemUnit}>{item.unit}</td>
                    <td className={`${s.r} ${s.itemTotal} ${!item.total ? s.zero : ''}`}>
                      {fmtNum(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showEditor && (
        <Modal title="Payroll Editor" onClose={() => setShowEditor(false)} wide>
          <PayrollSaveModal
            store={store}
            project={project}
            onClose={() => setShowEditor(false)}
          />
        </Modal>
      )}
    </div>
  )
}
