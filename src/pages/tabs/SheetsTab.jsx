import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { uid } from '../../store/useStore'
import s from './SheetsTab.module.css'

export default function SheetsTab({ store, project, onOpenSheet }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  // pending: { file, wb, sheetNames } — waiting for user to confirm sheet + header row
  const [pending, setPending] = useState(null)
  const [selectedTab, setSelectedTab] = useState('')
  const [headerRow, setHeaderRow] = useState(1)
  const [preview, setPreview] = useState([]) // first few raw rows for preview

  function loadPreview(wb, tabName, hRow) {
    const ws = wb.Sheets[tabName]
    // Get raw rows as arrays to preview
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    setPreview(raw.slice(0, Math.min(hRow + 2, raw.length)))
  }

  async function onFileChosen(file) {
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array' })

    const cfg = project.config
    // Pre-select tab from config if it matches
    const defaultTab = cfg?.sheetName
      ? (wb.SheetNames.find(n => n.toLowerCase() === cfg.sheetName.toLowerCase()) || wb.SheetNames[0])
      : wb.SheetNames[0]
    const defaultHRow = cfg?.headerRow || 1

    setSelectedTab(defaultTab)
    setHeaderRow(defaultHRow)
    setPending({ file, wb, sheetNames: wb.SheetNames })
    loadPreview(wb, defaultTab, defaultHRow)
  }

  function onTabChange(tab) {
    setSelectedTab(tab)
    loadPreview(pending.wb, tab, headerRow)
  }

  function onHeaderRowChange(val) {
    const n = Math.max(1, parseInt(val) || 1)
    setHeaderRow(n)
    loadPreview(pending.wb, selectedTab, n)
  }

  function confirmImport() {
    const { file, wb } = pending
    const ws   = wb.Sheets[selectedTab]
    // range: headerRow - 1 tells xlsx to treat that row as the header
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', range: headerRow - 1 })

    const newSheet = {
      id: uid(),
      name: file.name,
      sheetName: selectedTab,
      headerRow,
      uploadedAt: new Date().toISOString(),
      rows,
    }
    store.addSheet(project.id, newSheet)
    setPending(null)
    onOpenSheet(newSheet.id)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileChosen(file)
  }

  function onFileChange(e) {
    onFileChosen(e.target.files[0])
    e.target.value = ''
  }

  function relDate(iso) {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const sheets = project.sheets || []

  return (
    <div className={s.wrap}>
      <div className={s.ph}>
        <div>
          <h2>Sheets</h2>
          <p>Upload a sheet to open the payroll editor</p>
        </div>
        <button className={s.btnAdd} onClick={() => inputRef.current.click()}>+ Upload Sheet</button>
      </div>

      <div
        className={`${s.dropZone} ${dragging ? s.dragging : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
      >
        <span className={s.dzIcon}>📂</span>
        <div className={s.dzTitle}>Drop a file here, or click to browse</div>
        <div className={s.dzSub}>XLSX · XLS · CSV</div>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} style={{ display: 'none' }} />

      {/* Import dialog — shown after file is chosen, before committing */}
      {pending && (
        <div className={s.importBox}>
          <div className={s.importTitle}>Configure Import — <span>{pending.file.name}</span></div>

          <div className={s.importRow}>
            <div className={s.importField}>
              <label>Sheet Tab</label>
              <select value={selectedTab} onChange={e => onTabChange(e.target.value)}>
                {pending.sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className={s.importField}>
              <label>Header Row #</label>
              <input
                type="number" min="1" value={headerRow}
                onChange={e => onHeaderRowChange(e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className={s.previewWrap}>
              <div className={s.previewLabel}>Preview (first rows)</div>
              <div className={s.previewScroll}>
                <table className={s.previewTable}>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={i === headerRow - 1 ? s.headerRowHighlight : ''}>
                        <td className={s.previewRowNum}>{i + 1}</td>
                        {row.slice(0, 10).map((cell, j) => (
                          <td key={j} className={i === headerRow - 1 ? s.headerCell : s.dataCell}>
                            {String(cell).slice(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={s.previewHint}>Row {headerRow} (highlighted) will be used as column headers</div>
            </div>
          )}

          <div className={s.importActions}>
            <button className={s.btnCancel} onClick={() => setPending(null)}>Cancel</button>
            <button className={s.btnImport} onClick={confirmImport}>Import & Open →</button>
          </div>
        </div>
      )}

      {sheets.length > 0 && (
        <div className={s.list}>
          {sheets.map(sh => (
            <div key={sh.id} className={s.sheetRow} onClick={() => onOpenSheet(sh.id)}>
              <span className={s.sheetIcon}>📄</span>
              <div className={s.sheetInfo}>
                <div className={s.sheetName}>{sh.name}</div>
                <div className={s.sheetMeta}>
                  {sh.rows.length} rows · tab "{sh.sheetName}" · header row {sh.headerRow || 1} · {relDate(sh.uploadedAt)}
                </div>
              </div>
              <span className={s.openHint}>Open →</span>
              <button className={s.delBtn} onClick={e => { e.stopPropagation(); store.deleteSheet(project.id, sh.id) }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {sheets.length === 0 && !pending && (
        <div className={s.emptyHint}>
          {project.config ? 'Upload a sheet — it will open in the payroll editor.' : 'Tip: set up Config first, then upload.'}
        </div>
      )}
    </div>
  )
}
