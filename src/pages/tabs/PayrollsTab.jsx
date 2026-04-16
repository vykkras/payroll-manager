import { useState } from 'react'
import { uid } from '../../store/useStore'
import Modal from '../../components/Modal'
import s from './PayrollsTab.module.css'

const POSITIONS = [
  { key: 'primero', label: 'Primero', sub: '1st Position', rateKey: 'rate1' },
  { key: 'segundo', label: 'Segundo', sub: '2nd Position', rateKey: 'rate2' },
  { key: 'tercero', label: 'Tercero', sub: '3rd Position', rateKey: 'rate3' },
]

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildItems(config) {
  return (config?.items || []).map(item => ({
    ...item,
    qty: '',
    amount: 0,
  }))
}

// ── Payroll Builder ───────────────────────────────────────────────────────────
function PayrollBuilder({ project, onSave, onClose }) {
  const cfg = project.config
  const [position, setPosition] = useState('primero')
  const [crewName, setCrewName] = useState('')
  const [period,   setPeriod]   = useState('')
  const [items,    setItems]    = useState(buildItems(cfg))

  const pos = POSITIONS.find(p => p.key === position)

  function setQty(idx, val) {
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const qty    = val === '' ? '' : Number(val)
      const rate   = parseFloat(it[pos.rateKey]) || 0
      const amount = (qty === '' ? 0 : qty) * rate
      return { ...it, qty: val, amount }
    }))
  }

  function setRate(idx, val) {
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const rate   = parseFloat(val) || 0
      const qty    = parseFloat(it.qty) || 0
      return { ...it, [pos.rateKey]: val, amount: qty * rate }
    }))
  }

  // Recalculate amounts when position changes
  function onPositionChange(newPos) {
    setPosition(newPos)
    const newPosObj = POSITIONS.find(p => p.key === newPos)
    setItems(its => its.map(it => {
      const rate   = parseFloat(it[newPosObj.rateKey]) || 0
      const qty    = parseFloat(it.qty) || 0
      return { ...it, amount: qty * rate }
    }))
  }

  const total = items.reduce((sum, it) => sum + (it.amount || 0), 0)

  function handleSave() {
    if (!crewName.trim()) return
    onSave({
      id: uid(),
      crewName: crewName.trim(),
      position,
      period,
      items: items.map(it => ({ ...it })),
      total,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <Modal title="New Payroll" onClose={onClose} wide>
      {/* Position tabs */}
      <div className={s.posTabs}>
        {POSITIONS.map(p => (
          <button
            key={p.key}
            className={`${s.posTab} ${position === p.key ? s.posTabActive : ''}`}
            onClick={() => onPositionChange(p.key)}
          >
            {p.label} <span className={s.posSub}>{p.sub}</span>
          </button>
        ))}
      </div>

      {/* Meta */}
      <div className={s.metaRow}>
        <div className={s.metaField}>
          <label>Period</label>
          <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. Apr 7–13, 2026" />
        </div>
        <div className={s.metaField}>
          <label style={{ color: '#3949ab' }}>▸ {pos.label} — Name</label>
          <input value={crewName} onChange={e => setCrewName(e.target.value)} placeholder="Crew member name" autoFocus />
        </div>
      </div>

      {/* Line items */}
      {items.length > 0 ? (
        <div className={s.itemsWrap}>
          <div className={s.itemsHead}>
            <span>Code</span>
            <span>Description</span>
            <span>Unit</span>
            <span className={s.tr}>Rate</span>
            <span className={s.tr}>Qty</span>
            <span className={s.tr}>Amount</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className={s.itemRow}>
              <span className={s.code}>{item.code || '—'}</span>
              <span className={s.desc}>{item.label || '—'}</span>
              <span className={s.unit}>{item.unit || '—'}</span>
              <input
                type="number"
                className={`${s.numInput} ${s.rateInput}`}
                value={item[pos.rateKey]}
                onChange={e => setRate(idx, e.target.value)}
                placeholder="0.00"
              />
              <input
                type="number"
                className={`${s.numInput} ${s.qtyInput}`}
                value={item.qty}
                onChange={e => setQty(idx, e.target.value)}
                placeholder="0"
              />
              <span className={`${s.amount} ${!item.amount ? s.dim : ''}`}>
                {item.amount ? fmtMoney(item.amount) : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.noItems}>
          No line items configured. Go to the Config tab to add items and rates.
        </div>
      )}

      {/* Total + actions */}
      <div className={s.builderFooter}>
        <div>
          <div className={s.totalLabel}>Total</div>
          <div className={s.totalAmount}>{fmtMoney(total)}</div>
        </div>
        <div className={s.footerBtns}>
          <button className={s.btnCancel} onClick={onClose}>Cancel</button>
          <button className={s.btnSave} onClick={handleSave} disabled={!crewName.trim()}>
            Save Payroll
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PayrollsTab({ store, project }) {
  const [building, setBuilding] = useState(false)
  const [delTarget, setDelTarget] = useState(null)

  const payrolls = project.payrolls || []

  function handleSave(payroll) {
    store.savePayroll(project.id, payroll)
    setBuilding(false)
  }

  return (
    <div className={s.wrap}>
      <div className={s.ph}>
        <div>
          <h2>Payrolls</h2>
          <p>Build and save payrolls for crew members</p>
        </div>
        <button className={s.btnAdd} onClick={() => setBuilding(true)}>+ New Payroll</button>
      </div>

      {payrolls.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>💵</span>
          <h3>No payrolls yet</h3>
          <p>Create a payroll to get started</p>
        </div>
      ) : (
        <div className={s.list}>
          {payrolls.map(pr => {
            const posInfo = POSITIONS.find(p => p.key === pr.position)
            return (
              <div key={pr.id} className={s.payrollRow}>
                <span className={`${s.posBadge} ${s[`pos_${pr.position}`]}`}>{posInfo?.label}</span>
                <div className={s.prInfo}>
                  <div className={s.prName}>{pr.crewName}</div>
                  <div className={s.prMeta}>{pr.period || 'No period'} · {relDate(pr.createdAt)}</div>
                </div>
                <div className={s.prTotal}>{fmtMoney(pr.total)}</div>
                <button className={s.delBtn} onClick={() => setDelTarget(pr.id)}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {building && (
        <PayrollBuilder project={project} onSave={handleSave} onClose={() => setBuilding(false)} />
      )}

      {delTarget && (
        <Modal title="Delete payroll?" onClose={() => setDelTarget(null)}>
          <p className={s.delMsg}>This payroll will be permanently deleted.</p>
          <div className={s.footerBtns} style={{ marginTop: 20 }}>
            <button className={s.btnCancel} onClick={() => setDelTarget(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deletePayroll(project.id, delTarget); setDelTarget(null) }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
