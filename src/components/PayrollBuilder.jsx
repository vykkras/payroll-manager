import { useState } from 'react'
import { uid } from '../store/useStore'
import s from './PayrollBuilder.module.css'

const CREWS_KEY = 'dccable_crews'

const POSITIONS = [
  { key: 'primero', label: 'Primero', sub: '1st', rateKey: 'rate1', color: '#3949ab' },
  { key: 'segundo', label: 'Segundo', sub: '2nd', rateKey: 'rate2', color: '#2e7d32' },
  { key: 'tercero', label: 'Tercero', sub: '3rd', rateKey: 'rate3', color: '#e65100' },
]
const POS_DOT_COLORS = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcAmount(qty, rate) {
  const q = parseFloat(qty) || 0
  const r = parseFloat(rate) || 0
  return q * r
}

function buildItems(configItems) {
  return (configItems || []).map(it => ({
    ...it,
    qty1: '', qty2: '', qty3: '',
    amt1: 0,  amt2: 0,  amt3: 0,
    qty2manual: false,
  }))
}

function hydrateItems(configItems, savedItems) {
  return (configItems || []).map(it => {
    const saved = savedItems?.find(sv => sv.code === it.code) || {}
    return {
      ...it,
      qty1: saved.qty1 ?? '', qty2: saved.qty2 ?? '', qty3: saved.qty3 ?? '',
      amt1: saved.amt1 ?? 0,  amt2: saved.amt2 ?? 0,  amt3: saved.amt3 ?? 0,
      qty2manual: true,
    }
  })
}

function loadCrews() {
  try { return JSON.parse(localStorage.getItem(CREWS_KEY) || '[]') } catch { return [] }
}
function saveCrews(crews) {
  localStorage.setItem(CREWS_KEY, JSON.stringify(crews))
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PayrollBuilder({
  config,
  onSave,
  onClose,
  editPayroll,
  defaultPeriod,
  position: positionProp,
  onPositionChange,
}) {
  const [positionInternal, setPositionInternal] = useState(editPayroll?.position || positionProp || 'primero')
  const position    = positionProp !== undefined ? positionProp : positionInternal
  const setPosition = (p) => { setPositionInternal(p); onPositionChange?.(p) }
  const [crewNames, setCrewNames] = useState({
    primero: editPayroll?.crewNames?.primero || '',
    segundo: editPayroll?.crewNames?.segundo || '',
    tercero: editPayroll?.crewNames?.tercero || '',
  })
  const [period,   setPeriod]   = useState(editPayroll?.period || defaultPeriod || '')
  const [items,    setItems]    = useState(() =>
    editPayroll
      ? hydrateItems(config?.items, editPayroll.items)
      : buildItems(config?.items)
  )
  const [discounts, setDiscounts] = useState(() => {
    const d = editPayroll?.discounts
    if (d) {
      // Legacy: flat array → treat as primero only
      if (Array.isArray(d)) return { primero: d, segundo: [], tercero: [] }
      return { primero: [], segundo: [], tercero: [], ...d }
    }
    // New payroll: pre-fill Hotel $137 for Primero and Segundo
    const hotel = () => ({ id: uid(), label: 'Hotel', amount: '137' })
    return { primero: [hotel()], segundo: [hotel()], tercero: [] }
  })
  const [crews,     setCrews]     = useState(loadCrews)
  const [fillAll,   setFillAll]   = useState(false)   // fill all 3 positions
  const [fillTwo,   setFillTwo]   = useState(false)   // fill Primero → Segundo only

  const pos    = POSITIONS.find(p => p.key === position)
  const posIdx = { primero: '1', segundo: '2', tercero: '3' }[position]

  // ── Crew name for current position ──────────────────────────────────────────
  const currentCrewName = crewNames[position]
  function setCurrentCrewName(val) {
    setCrewNames(cn => ({ ...cn, [position]: val }))
  }

  // ── Saved crews ──────────────────────────────────────────────────────────────
  function handleSaveCrew() {
    const label = [crewNames.primero, crewNames.segundo, crewNames.tercero].filter(Boolean).join(' / ') || 'Crew'
    const next = [...crews, { id: uid(), label, primero: crewNames.primero, segundo: crewNames.segundo, tercero: crewNames.tercero }]
    saveCrews(next); setCrews(next)
  }
  function loadCrew(c) {
    setCrewNames({ primero: c.primero || '', segundo: c.segundo || '', tercero: c.tercero || '' })
  }
  function deleteCrew(id) {
    const next = crews.filter(c => c.id !== id)
    saveCrews(next); setCrews(next)
  }

  // ── Item quantity changes ────────────────────────────────────────────────────
  // onChange: just update the field value live, no propagation yet
  function setQty(idx, pidx, val) {
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [`qty${pidx}`]: val }
      updated[`amt${pidx}`] = calcAmount(val, it[`rate${pidx}`])
      if (pidx === '2') updated.qty2manual = true
      return updated
    }))
  }

  // onBlur: apply ÷2 halving + propagate to Segundo/Tercero
  function handleQtyBlur(idx, pidx) {
    if (pidx !== '1') return
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const q1raw = parseFloat(it.qty1) || 0
      if (q1raw === 0) return it

      const shouldHalve = it.divBy2 && (fillTwo || fillAll)
      const q1final = shouldHalve ? q1raw / 2 : q1raw
      const q1str = String(q1final)

      const updated = { ...it, qty1: q1str, amt1: calcAmount(q1str, it.rate1) }

      if (fillTwo || fillAll) {
        updated.qty2 = q1str
        updated.amt2 = calcAmount(q1str, it.rate2)
        updated.qty2manual = false
      }
      if (fillAll) {
        updated.qty3 = q1str
        updated.amt3 = calcAmount(q1str, it.rate3)
      }
      return updated
    }))
  }

  function setRate(idx, pidx, val) {
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [`rate${pidx}`]: val }
      updated[`amt${pidx}`] = calcAmount(it[`qty${pidx}`], val)
      return updated
    }))
  }

  // ── Fill Segundo from Primero ────────────────────────────────────────────────
  function autoFillSegundo() {
    setItems(its => its.map(it => {
      const q1 = parseFloat(it.qty1) || 0
      const autoQty2 = it.divBy2 ? q1 / 2 : q1
      return { ...it, qty2: autoQty2 === 0 ? '' : String(autoQty2), amt2: calcAmount(autoQty2, it.rate2), qty2manual: false }
    }))
  }

  // ── Divide all qtys for current position ────────────────────────────────────
  function divideQtys(n) {
    setItems(its => its.map(it => {
      const qty = parseFloat(it[`qty${posIdx}`]) || 0
      if (qty === 0) return it
      const newQty = Math.round(qty / n)
      return {
        ...it,
        [`qty${posIdx}`]: newQty === 0 ? '' : String(newQty),
        [`amt${posIdx}`]: calcAmount(newQty, it[`rate${posIdx}`]),
      }
    }))
  }

  // ── Discounts (per-position) ─────────────────────────────────────────────────
  const posDiscounts = discounts[position] || []
  function addDiscount() {
    setDiscounts(d => ({ ...d, [position]: [...(d[position] || []), { id: uid(), label: '', amount: '' }] }))
  }
  function setDiscount(id, f, v) {
    setDiscounts(d => ({ ...d, [position]: (d[position] || []).map(disc => disc.id === id ? { ...disc, [f]: v } : disc) }))
  }
  function removeDiscount(id) {
    setDiscounts(d => ({ ...d, [position]: (d[position] || []).filter(disc => disc.id !== id) }))
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  const subtotal1 = items.reduce((sum, it) => sum + it.amt1, 0)
  const subtotal2 = items.reduce((sum, it) => sum + it.amt2, 0)
  const subtotal3 = items.reduce((sum, it) => sum + it.amt3, 0)
  const totalDisc1 = (discounts.primero || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  const totalDisc2 = (discounts.segundo || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  const totalDisc3 = (discounts.tercero || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  const total1 = subtotal1 - totalDisc1
  const total2 = subtotal2 - totalDisc2
  const total3 = subtotal3 - totalDisc3
  const currentSubtotal    = { primero: subtotal1, segundo: subtotal2, tercero: subtotal3 }[position]
  const currentTotalDisc   = { primero: totalDisc1, segundo: totalDisc2, tercero: totalDisc3 }[position]
  const currentTotal       = { primero: total1,    segundo: total2,    tercero: total3    }[position]

  // ── Save ─────────────────────────────────────────────────────────────────────
  function handleSave() {
    const cleanDiscounts = {
      primero: (discounts.primero || []).filter(d => d.label || d.amount),
      segundo: (discounts.segundo || []).filter(d => d.label || d.amount),
      tercero: (discounts.tercero || []).filter(d => d.label || d.amount),
    }
    onSave({
      id:        editPayroll?.id || uid(),
      position,
      crewNames,
      period,
      items:     items.map(({ qty2manual, ...it }) => it),
      discounts: cleanDiscounts,
      subtotal1, subtotal2, subtotal3,
      totalDisc1, totalDisc2, totalDisc3,
      total1, total2, total3,
      createdAt: editPayroll?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const hasItems     = (config?.items?.length || 0) > 0
  const crewLabel    = pos ? `${pos.label} — Name` : 'Name'
  const crewColor    = pos ? pos.color : '#3949ab'

  return (
    <div className={s.wrap}>

      {/* ── Position tabs ── */}
      <div className={s.posTabs}>
        {POSITIONS.map(p => {
          const t = { primero: total1, segundo: total2, tercero: total3 }[p.key]
          return (
            <button
              key={p.key}
              className={`${s.posTab} ${position === p.key ? s.posTabActive : ''}`}
              style={position === p.key ? { '--tab-color': p.color } : {}}
              onClick={() => setPosition(p.key)}
            >
              <span className={s.posLabel}>{p.label}</span>
              <span className={s.posSub}>{p.sub}</span>
              <span className={s.posAmt}>{fmtMoney(t)}</span>
            </button>
          )
        })}
      </div>

      {/* ── Meta row: Period | Name | Save as Crew ── */}
      <div className={s.metaRow}>
        <div className={s.metaField}>
          <label>Period</label>
          <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. Apr 7–13, 2026" />
        </div>
        <div className={s.metaField}>
          <label style={{ color: crewColor }}>▸ {crewLabel}</label>
          <input
            value={currentCrewName}
            onChange={e => setCurrentCrewName(e.target.value)}
            placeholder="Crew member name"
          />
        </div>
        <div className={s.metaSaveCrew}>
          <button className={s.btnSaveCrew} onClick={handleSaveCrew}>+ Save as Crew</button>
        </div>
      </div>

      {/* ── Auto-fill hint (Segundo) ── */}
      {position === 'segundo' && !fillAll && (
        <div className={s.autoFillBar}>
          <span className={s.autoFillHint}>Items with ÷2 auto-fill from Primero.</span>
          <button className={s.autoFillBtn} onClick={autoFillSegundo}>↺ Re-fill from Primero</button>
        </div>
      )}

      {/* ── Items table ── */}
      {!hasItems ? (
        <div className={s.noItems}>No payroll items configured — go to the project's Payroll Items tab to set them up.</div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th className={s.tc}>Unit</th>
                <th className={s.tc}>+2</th>
                <th className={s.tr}>Rate</th>
                <th className={s.tr}>Qty</th>
                <th className={s.tr}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const qtyKey  = `qty${posIdx}`
                const rateKey = `rate${posIdx}`
                const amtKey  = `amt${posIdx}`
                const isAuto  = position === 'segundo' && !item.qty2manual
                const rateVal = item[rateKey]
                const isNA    = rateVal === null || rateVal === undefined || rateVal === ''
                return (
                  <tr key={idx} className={isNA ? s.naRow : ''}>
                    <td className={s.code}>{item.code}</td>
                    <td className={s.desc}>{item.label}</td>
                    <td className={s.tc}><span className={s.unitTxt}>{item.unit}</span></td>
                    <td className={s.tc}>
                      {item.divBy2 ? <span className={s.divBadge}>÷2</span> : null}
                    </td>
                    <td className={s.tr}>
                      <input
                        type="number"
                        className={s.rateInput}
                        value={rateVal ?? ''}
                        onChange={e => setRate(idx, posIdx, e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className={s.tr}>
                      <input
                        type="number"
                        className={`${s.qtyInput} ${isAuto ? s.qtyAuto : ''}`}
                        value={item[qtyKey]}
                        onChange={e => setQty(idx, posIdx, e.target.value)}
                        onBlur={() => handleQtyBlur(idx, posIdx)}
                        placeholder="0"
                      />
                    </td>
                    <td className={`${s.tr} ${s.amount} ${!item[amtKey] ? s.dim : ''}`}>
                      {item[amtKey] ? fmtMoney(item[amtKey]) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Discounts (per position) ── */}
      <div className={s.discountsSection}>
        <div className={s.discountsHeader}>
          <span className={s.discountsTitle} style={{ color: pos?.color }}>Deductions — {pos?.label}</span>
          <button className={s.btnAddDiscount} onClick={addDiscount}>+ Add</button>
        </div>
        {posDiscounts.length > 0 && (
          <div className={s.discountRows}>
            {posDiscounts.map(d => (
              <div key={d.id} className={s.discountRow}>
                <input className={s.discountLabel} value={d.label} onChange={e => setDiscount(d.id, 'label', e.target.value)} placeholder="e.g. Tool rental, Material advance" />
                <input type="number" className={s.discountAmt} value={d.amount} onChange={e => setDiscount(d.id, 'amount', e.target.value)} placeholder="0.00" />
                <button className={s.discountDel} onClick={() => removeDiscount(d.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3-position summary ── */}
      <div className={s.summary}>
        {POSITIONS.map(p => {
          const pidx = { primero: '1', segundo: '2', tercero: '3' }[p.key]
          const sub  = [subtotal1, subtotal2, subtotal3][parseInt(pidx) - 1]
          const disc = [totalDisc1, totalDisc2, totalDisc3][parseInt(pidx) - 1]
          const tot  = [total1, total2, total3][parseInt(pidx) - 1]
          const isActive = position === p.key
          return (
            <div
              key={p.key}
              className={`${s.summaryCard} ${isActive ? s.summaryCardActive : ''}`}
              style={isActive ? { borderColor: p.color } : {}}
              onClick={() => setPosition(p.key)}
            >
              <div className={s.summaryPos} style={{ color: p.color }}>{p.label}</div>
              <div className={s.summaryCrew}>{crewNames[p.key] || <span className={s.summaryEmpty}>—</span>}</div>
              {disc > 0 && <div className={s.summarySub}>{fmtMoney(sub)}</div>}
              {disc > 0 && <div className={s.summaryDisc}>−{fmtMoney(disc)}</div>}
              <div className={s.summaryTotal} style={{ color: isActive ? p.color : '#1a1a2e' }}>
                {fmtMoney(tot)}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer controls ── */}
      <div className={s.footer}>
        <div className={s.footerControls}>
          <button
            className={`${s.btnFillAll} ${fillTwo ? s.btnFillAllOn : ''}`}
            onClick={() => { setFillTwo(v => !v); setFillAll(false) }}
            title="When ON: Primero qty auto-fills Segundo (÷2 if flagged)"
          >
            {fillTwo ? '● All 2' : '○ All 2'}
          </button>
          <button
            className={`${s.btnFillAll} ${fillAll ? s.btnFillAllOn : ''}`}
            onClick={() => { setFillAll(v => !v); setFillTwo(false) }}
            title="When ON: Primero qty auto-fills all 3 positions"
          >
            {fillAll ? '● All 3' : '○ All 3'}
          </button>
          <div className={s.dividerV} />
          <button className={s.btnDiv} onClick={() => divideQtys(2)}>÷2</button>
          <button className={s.btnDiv} onClick={() => divideQtys(3)}>÷3</button>
          <button className={s.btnDiv} onClick={() => divideQtys(4)}>÷4</button>
        </div>

        <div className={s.footerBtns}>
          {onClose && <button className={s.btnCancel} onClick={onClose}>Cancel</button>}
          <button
            className={s.btnSave}
            onClick={handleSave}
            disabled={!currentCrewName.trim()}
          >
            {editPayroll ? '✓ Update' : '💾 Save Payroll'}
          </button>
        </div>
      </div>
    </div>
  )
}
