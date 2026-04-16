import { useState, useEffect } from 'react'
import s from './ConfigTab.module.css'

const BLANK_ITEM = () => ({ label: '', unit: '', col: '', code: '', rate1: '', rate2: '', rate3: '', divBy2: false })

const BLANK_CONFIG = {
  sheetName: '',
  crewCol: '',
  crewLabel: 'Crew',
  subsectorCol: '',
  subsectorLabel: 'Subsector',
  dateCol: '',
  addressCol: '',
  filterMode: 'all',   // 'all' | 'nonempty' | 'equals'
  filterCol: '',
  filterVal: '',
  items: [],
}

export default function ConfigTab({ store, project }) {
  const [cfg, setCfg] = useState(() => ({ ...BLANK_CONFIG, ...(project.config || {}), items: project.config?.items ? project.config.items.map(i => ({ ...i })) : [] }))
  const [saved, setSaved] = useState(false)

  // keep in sync if project config changes externally
  useEffect(() => {
    setCfg({ ...BLANK_CONFIG, ...(project.config || {}), items: project.config?.items ? project.config.items.map(i => ({ ...i })) : [] })
  }, [project.id])

  function set(field, value) {
    setCfg(c => ({ ...c, [field]: value }))
    setSaved(false)
  }

  function addItem() {
    setCfg(c => ({ ...c, items: [...c.items, BLANK_ITEM()] }))
    setSaved(false)
  }

  function removeItem(idx) {
    setCfg(c => ({ ...c, items: c.items.filter((_, i) => i !== idx) }))
    setSaved(false)
  }

  function setItem(idx, field, value) {
    setCfg(c => {
      const items = c.items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
      return { ...c, items }
    })
    setSaved(false)
  }

  function handleSave() {
    store.updateProjectConfig(project.id, cfg)
    setSaved(true)
  }

  const sampleSheet = project.sheets?.[0]
  const sampleCols  = sampleSheet ? Object.keys(sampleSheet.rows[0] || {}) : []

  return (
    <div className={s.wrap}>
      <div className={s.ph}>
        <div>
          <h2>Project Config</h2>
          <p>Define how uploaded sheets are parsed and how payrolls are built</p>
        </div>
        <button className={s.btnSave} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Config'}
        </button>
      </div>

      {sampleCols.length > 0 && (
        <div className={s.colHint}>
          <span className={s.colHintLabel}>Detected columns from latest sheet:</span>
          <div className={s.colList}>
            {sampleCols.map(c => <span key={c} className={s.colTag}>{c}</span>)}
          </div>
        </div>
      )}

      <div className={s.sections}>

        {/* Sheet */}
        <section className={s.section}>
          <h3>Sheet</h3>
          <div className={s.row2}>
            <div className={s.field}>
              <label>Sheet / Tab Name <span className={s.hint}>leave blank to use first sheet</span></label>
              <input value={cfg.sheetName} onChange={e => set('sheetName', e.target.value)} placeholder="e.g. GEORGIA PRODUCCIÓN" />
            </div>
          </div>
        </section>

        {/* Row filter */}
        <section className={s.section}>
          <h3>Row Filter</h3>
          <div className={s.row2}>
            <div className={s.field}>
              <label>Mode</label>
              <select value={cfg.filterMode} onChange={e => set('filterMode', e.target.value)}>
                <option value="all">All rows</option>
                <option value="nonempty">Rows where column is not empty</option>
                <option value="equals">Rows where column equals value</option>
              </select>
            </div>
            {cfg.filterMode !== 'all' && (
              <div className={s.field}>
                <label>Filter Column</label>
                <input value={cfg.filterCol} onChange={e => set('filterCol', e.target.value)} placeholder="e.g. INVOICED" />
              </div>
            )}
            {cfg.filterMode === 'equals' && (
              <div className={s.field}>
                <label>Filter Value <span className={s.hint}>case-insensitive</span></label>
                <input value={cfg.filterVal} onChange={e => set('filterVal', e.target.value)} placeholder="e.g. TRUE" />
              </div>
            )}
          </div>
        </section>

        {/* Columns */}
        <section className={s.section}>
          <h3>Column Mapping</h3>
          <div className={s.row3}>
            <div className={s.field}>
              <label>Crew Column</label>
              <input value={cfg.crewCol} onChange={e => set('crewCol', e.target.value)} placeholder="e.g. NOMBRES" />
            </div>
            <div className={s.field}>
              <label>Crew Display Label</label>
              <input value={cfg.crewLabel} onChange={e => set('crewLabel', e.target.value)} placeholder="Crew" />
            </div>
            <div className={s.field}></div>

            <div className={s.field}>
              <label>Subsector Column</label>
              <input value={cfg.subsectorCol} onChange={e => set('subsectorCol', e.target.value)} placeholder="e.g. FEEDER" />
            </div>
            <div className={s.field}>
              <label>Subsector Display Label</label>
              <input value={cfg.subsectorLabel} onChange={e => set('subsectorLabel', e.target.value)} placeholder="Subsector" />
            </div>
            <div className={s.field}></div>

            <div className={s.field}>
              <label>Date Column <span className={s.hint}>optional</span></label>
              <input value={cfg.dateCol} onChange={e => set('dateCol', e.target.value)} placeholder="e.g. Completed Date" />
            </div>
            <div className={s.field}>
              <label>Address Column <span className={s.hint}>optional</span></label>
              <input value={cfg.addressCol} onChange={e => set('addressCol', e.target.value)} placeholder="e.g. Street Address" />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className={s.section}>
          <h3>Payroll Line Items</h3>
          <p className={s.sectionDesc}>Each item maps a spreadsheet column to a payroll line with rates per position.</p>

          <div className={s.itemsHead}>
            <span>Label</span>
            <span>Unit</span>
            <span>Excel Column</span>
            <span>Code</span>
            <span className={s.tc}>÷2</span>
            <span className={s.tr}>1st Rate</span>
            <span className={s.tr}>2nd Rate</span>
            <span className={s.tr}>3rd Rate</span>
            <span></span>
          </div>

          <div className={s.itemsList}>
            {cfg.items.map((item, idx) => (
              <div key={idx} className={s.itemRow}>
                <input value={item.label} onChange={e => setItem(idx, 'label', e.target.value)} placeholder="e.g. Direct Buried" />
                <input value={item.unit}  onChange={e => setItem(idx, 'unit',  e.target.value)} placeholder="ft" />
                <input value={item.col}   onChange={e => setItem(idx, 'col',   e.target.value)} placeholder="column name" />
                <input value={item.code}  onChange={e => setItem(idx, 'code',  e.target.value)} placeholder="DB" />
                <input type="checkbox" checked={!!item.divBy2} onChange={e => setItem(idx, 'divBy2', e.target.checked)} style={{ width: 16, height: 16, margin: '0 auto', display: 'block', cursor: 'pointer' }} />
                <input type="number" value={item.rate1} onChange={e => setItem(idx, 'rate1', e.target.value)} placeholder="0.00" className={s.rateInput} />
                <input type="number" value={item.rate2} onChange={e => setItem(idx, 'rate2', e.target.value)} placeholder="0.00" className={s.rateInput} />
                <input type="number" value={item.rate3} onChange={e => setItem(idx, 'rate3', e.target.value)} placeholder="0.00" className={s.rateInput} />
                <button className={s.removeBtn} onClick={() => removeItem(idx)}>✕</button>
              </div>
            ))}
          </div>

          <button className={s.btnAddItem} onClick={addItem}>+ Add Item</button>
        </section>

      </div>
    </div>
  )
}
