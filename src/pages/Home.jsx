import { useState } from 'react'
import { uid, loadProjectDefaults, saveProjectDefaults } from '../store/useStore'
import { TEMPLATES } from '../data/templates'
import Modal from '../components/Modal'
import s from './Home.module.css'

const COLORS = ['#1a1a2e','#1565c0','#2e7d32','#e65100','#6a1b9a','#00695c','#b71c1c','#f57f17']

function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Wizard steps: template → name → columns → items ─────────────────────────

const STEPS = ['template', 'name', 'columns', 'items']

function stepLabel(step) {
  return { template: 'Start', name: 'Name', columns: 'Columns', items: 'Payroll Items' }[step]
}

export default function Home({ store, onOpenProject }) {
  const [showModal, setShowModal] = useState(false)
  const [step, setStep]           = useState('template')
  const [tplId, setTplId]         = useState(null)

  // Wizard state
  const [name,    setName]    = useState('')
  const [color,   setColor]   = useState(COLORS[0])
  const [columns, setColumns] = useState([])   // [{ id, name }]
  const [items,   setItems]   = useState([])   // [{ id, label, unit, code, rate1, rate2, rate3, divBy2 }]

  // Column editor
  const [colInput, setColInput] = useState('')

  // Item editor
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItemId,   setEditItemId]   = useState(null)
  const [itemForm, setItemForm] = useState({ label: '', unit: '', code: '', rate1: '', rate2: '', rate3: '', divBy2: false })

  // Delete confirm
  const [delTarget, setDelTarget] = useState(null)

  function openModal() {
    const defaults = loadProjectDefaults()
    setStep('template'); setTplId(null)
    setName(''); setColor(COLORS[0])
    setColumns(defaults?.columns?.map(c => ({ ...c, id: uid() })) || [])
    setItems(defaults?.items?.map(i => ({ ...i, id: uid() })) || [])
    setColInput('')
    setShowModal(true)
  }

  function pickTemplate(tpl) {
    if (tpl) {
      setTplId(tpl.id)
      setName(tpl.name)
      setColor(tpl.color)
      setColumns(tpl.columns.map(c => ({ ...c })))
      setItems(tpl.items.map(i => ({ ...i })))
    } else {
      const defaults = loadProjectDefaults()
      setTplId(null)
      setName(''); setColor(COLORS[0])
      setColumns(defaults?.columns?.map(c => ({ ...c, id: uid() })) || [])
      setItems(defaults?.items?.map(i => ({ ...i, id: uid() })) || [])
    }
    setStep('name')
  }

  // ── Column helpers ────────────────────────────────────────────────────────
  function addColumn() {
    const v = colInput.trim()
    if (!v) return
    setColumns(cs => [...cs, { id: uid(), name: v, filter: false, sum: false }])
    setColInput('')
  }
  function removeColumn(id) {
    setColumns(cs => cs.filter(c => c.id !== id))
  }
  function toggleColFilter(id) {
    setColumns(cs => cs.map(c => c.id === id ? { ...c, filter: !c.filter } : c))
  }
  function toggleColSum(id) {
    setColumns(cs => cs.map(c => c.id === id ? { ...c, sum: !c.sum } : c))
  }

  // ── Item helpers ──────────────────────────────────────────────────────────
  function openItemForm(item) {
    if (item) {
      setEditItemId(item.id)
      setItemForm({
        label: item.label || '', unit: item.unit || '', code: item.code || '',
        rate1: item.rate1 ?? '', rate2: item.rate2 ?? '', rate3: item.rate3 ?? '',
        divBy2: item.divBy2 || false,
      })
    } else {
      setEditItemId(null)
      setItemForm({ label: '', unit: '', code: '', rate1: '', rate2: '', rate3: '', divBy2: false })
    }
    setShowItemForm(true)
  }

  function saveItemForm() {
    if (!itemForm.label.trim()) return
    const item = {
      id: editItemId || uid(),
      label: itemForm.label.trim(),
      unit:  itemForm.unit.trim(),
      code:  itemForm.code.trim(),
      rate1: itemForm.rate1 !== '' ? Number(itemForm.rate1) : null,
      rate2: itemForm.rate2 !== '' ? Number(itemForm.rate2) : null,
      rate3: itemForm.rate3 !== '' ? Number(itemForm.rate3) : null,
      divBy2: itemForm.divBy2,
    }
    if (editItemId) {
      setItems(its => its.map(i => i.id === editItemId ? item : i))
    } else {
      setItems(its => [...its, item])
    }
    setShowItemForm(false)
  }

  function removeItem(id) {
    setItems(its => its.filter(i => i.id !== id))
  }

  // ── Create project ────────────────────────────────────────────────────────
  function handleCreate() {
    if (!name.trim()) return
    store.createProject(name.trim(), color, columns, items)
    saveProjectDefaults(columns, items)
    setShowModal(false)
  }

  function goBack() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  function goNext() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const isLastStep = step === 'items'
  const canProceed = step === 'name' ? name.trim().length > 0 : true

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <span className={s.headerSub}>Payroll Manager</span>
      </header>

      <main className={s.main}>
        <div className={s.ph}>
          <div>
            <h2>Projects</h2>
            <p>Select a project to manage folders and payrolls</p>
          </div>
          <button className={s.btnAdd} onClick={openModal}>+ New Project</button>
        </div>

        {store.data.length === 0 ? (
          <div className={s.empty}>
            <span className={s.emptyIcon}>🗂️</span>
            <h3>No projects yet</h3>
            <p>Create your first project to get started</p>
          </div>
        ) : (
          <div className={s.grid}>
            {store.data.map(p => (
              <div key={p.id} className={s.card} onClick={() => onOpenProject(p.id)}>
                <div className={s.colorBar} style={{ background: p.color }} />
                <div className={s.cardBody}>
                  <span className={s.cardIcon}>📋</span>
                  <div className={s.cardName}>{p.name}</div>
                  <div className={s.cardMeta}>
                    {(p.folders || []).length} folder{(p.folders || []).length !== 1 ? 's' : ''} ·{' '}
                    {(p.columns || []).length} col{(p.columns || []).length !== 1 ? 's' : ''} ·{' '}
                    {(p.items || []).length} item{(p.items || []).length !== 1 ? 's' : ''} ·{' '}
                    {relDate(p.createdAt)}
                  </div>
                </div>
                <button className={s.delBtn} onClick={e => { e.stopPropagation(); setDelTarget(p.id) }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Wizard modal ── */}
      {showModal && (
        <Modal
          title={step === 'template' ? 'New Project' : `New Project — ${stepLabel(step)}`}
          onClose={() => setShowModal(false)}
          wide={step === 'items'}
        >
          {/* Step indicator (steps 2–4) */}
          {step !== 'template' && (
            <div className={s.stepRow}>
              {['name','columns','items'].map((st, i) => (
                <div key={st} className={`${s.stepDot} ${step === st ? s.stepDotActive : STEPS.indexOf(step) > STEPS.indexOf(st) ? s.stepDotDone : ''}`}>
                  <span>{i+1}</span> {stepLabel(st)}
                </div>
              ))}
            </div>
          )}

          {/* ── Step: Template picker ── */}
          {step === 'template' && (
            <>
              <p className={s.stepHint}>Start from a template or set up from scratch</p>
              <div className={s.templateList}>
                {TEMPLATES.map(tpl => (
                  <button key={tpl.id} className={s.tplCard} onClick={() => pickTemplate(tpl)}>
                    <span className={s.tplIcon}>{tpl.icon}</span>
                    <div>
                      <div className={s.tplName}>{tpl.name}</div>
                      <div className={s.tplDesc}>{tpl.columns.length} columns · {tpl.items.length} payroll items</div>
                    </div>
                    <span className={s.tplArrow}>→</span>
                  </button>
                ))}
                <button className={s.tplCard} onClick={() => pickTemplate(null)}>
                  <span className={s.tplIcon}>🗂️</span>
                  <div>
                    <div className={s.tplName}>Blank Project</div>
                    <div className={s.tplDesc}>Set up columns and items from scratch</div>
                  </div>
                  <span className={s.tplArrow}>→</span>
                </button>
              </div>
            </>
          )}

          {/* ── Step: Name + Color ── */}
          {step === 'name' && (
            <>
              {tplId && (
                <div className={s.tplBadge}>
                  {TEMPLATES.find(t => t.id === tplId)?.icon} Using template: <strong>{TEMPLATES.find(t => t.id === tplId)?.name}</strong>
                  <button className={s.tplChange} onClick={() => setStep('template')}>Change</button>
                </div>
              )}
              <div className={s.field}>
                <label>Project Name</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canProceed && goNext()}
                  placeholder="e.g. Georgia Production" />
              </div>
              <div className={s.field}>
                <label>Color</label>
                <div className={s.colorRow}>
                  {COLORS.map(c => (
                    <button key={c} className={`${s.swatch} ${color === c ? s.swatchOn : ''}`}
                      style={{ background: c }} onClick={() => setColor(c)} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step: Columns ── */}
          {step === 'columns' && (
            <>
              <p className={s.stepHint}>Define your data columns. Mark which ones you want to filter by.</p>
              <div className={s.addRow}>
                <input
                  value={colInput}
                  onChange={e => setColInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addColumn()}
                  placeholder="Column name (e.g. FEEDER, CREW, DATE)"
                  className={s.addInput}
                />
                <button className={s.btnAddInline} onClick={addColumn} disabled={!colInput.trim()}>Add</button>
              </div>
              {columns.length === 0 ? (
                <div className={s.emptyList}>No columns yet — add some above, or skip and add later</div>
              ) : (
                <div className={s.colList}>
                  {columns.map(c => (
                    <div key={c.id} className={s.colListRow}>
                      <span className={s.colListName}>{c.name}</span>
                      <button
                        className={`${s.filterToggleBtn} ${c.filter ? s.filterToggleBtnOn : ''}`}
                        onClick={() => toggleColFilter(c.id)}
                        title="Toggle filter on/off for this column"
                      >{c.filter ? '⧩ Filter ON' : '⧩ Filter'}</button>
                      <button
                        className={`${s.filterToggleBtn} ${c.sum ? s.filterToggleBtnOn : ''}`}
                        onClick={() => toggleColSum(c.id)}
                        title="Toggle sum on/off for this column"
                      >{c.sum ? '∑ Sum ON' : '∑ Sum'}</button>
                      <button className={s.colListDel} onClick={() => removeColumn(c.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Step: Payroll Items ── */}
          {step === 'items' && (
            <>
              <p className={s.stepHint}>Define payroll line items with rates. You can add more anytime.</p>
              <button className={s.btnAddItem} onClick={() => openItemForm(null)}>+ Add Item</button>
              {items.length === 0 ? (
                <div className={s.emptyList}>No items yet — add some above, or skip and add later</div>
              ) : (
                <div className={s.itemsTable}>
                  <div className={s.itemsHead}>
                    <span>Code</span><span>Label</span><span>Unit</span>
                    <span className={s.tr}>Rate 1</span><span className={s.tr}>Rate 2</span><span className={s.tr}>Rate 3</span>
                    <span className={s.tc}>÷2</span><span></span>
                  </div>
                  {items.map(it => (
                    <div key={it.id} className={s.itemRow}>
                      <span className={s.code}>{it.code || '—'}</span>
                      <span className={s.label}>{it.label}</span>
                      <span className={s.unit}>{it.unit || '—'}</span>
                      <span className={s.tr}>{it.rate1 ?? '—'}</span>
                      <span className={s.tr}>{it.rate2 ?? '—'}</span>
                      <span className={s.tr}>{it.rate3 ?? '—'}</span>
                      <span className={s.tc}>{it.divBy2 ? '✓' : ''}</span>
                      <div className={s.itemActions}>
                        <button className={s.editBtn} onClick={() => openItemForm(it)}>✏</button>
                        <button className={s.delBtnSm} onClick={() => removeItem(it.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Footer nav ── */}
          {step !== 'template' && (
            <div className={s.modalFooter}>
              <button className={s.btnCancel} onClick={goBack}>← Back</button>
              {isLastStep ? (
                <button className={s.btnOk} onClick={handleCreate} disabled={!name.trim()}>
                  Create Project
                </button>
              ) : (
                <button className={s.btnOk} onClick={goNext} disabled={!canProceed}>
                  Next →
                </button>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Item form modal ── */}
      {showItemForm && (
        <Modal title={editItemId ? 'Edit Item' : 'Add Item'} onClose={() => setShowItemForm(false)}>
          {['label','unit','code'].map(f => (
            <div key={f} className={s.field}>
              <label>{f.charAt(0).toUpperCase() + f.slice(1)}</label>
              <input value={itemForm[f]} onChange={e => setItemForm(fm => ({ ...fm, [f]: e.target.value }))}
                placeholder={f === 'label' ? 'e.g. PM11' : f === 'unit' ? 'ft / ea' : 'e.g. PM11'} />
            </div>
          ))}
          <div className={s.rateRow}>
            {['rate1','rate2','rate3'].map((f, i) => (
              <div key={f} className={s.field}>
                <label>Rate {i+1}</label>
                <input type="number" step="0.01" value={itemForm[f]}
                  onChange={e => setItemForm(fm => ({ ...fm, [f]: e.target.value }))}
                  placeholder="0.00" />
              </div>
            ))}
          </div>
          <div className={s.checkRow}>
            <label className={s.checkLabel}>
              <input type="checkbox" checked={itemForm.divBy2}
                onChange={e => setItemForm(fm => ({ ...fm, divBy2: e.target.checked }))} />
              Auto-fill 2nd from 1st (÷2)
            </label>
          </div>
          <div className={s.modalFooter}>
            <button className={s.btnCancel} onClick={() => setShowItemForm(false)}>Cancel</button>
            <button className={s.btnOk} onClick={saveItemForm} disabled={!itemForm.label.trim()}>
              {editItemId ? 'Save' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete project confirm ── */}
      {delTarget && (
        <Modal title="Delete project?" onClose={() => setDelTarget(null)}>
          <p className={s.delMsg}>This permanently deletes the project, all folders, and all payrolls.</p>
          <div className={s.modalFooter}>
            <button className={s.btnCancel} onClick={() => setDelTarget(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deleteProject(delTarget); setDelTarget(null) }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
