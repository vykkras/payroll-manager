import { useState, useEffect } from 'react'
import { uid, useCrews } from '../store/useStore'
import s from './PayrollBuilder.module.css'

const BASE_POSITIONS = [
  { id: 'primero', posKey: 'primero', label: 'Primero', sub: '1st', color: '#3949ab', base: true },
  { id: 'segundo', posKey: 'segundo', label: 'Segundo', sub: '2nd', color: '#2e7d32', base: true },
  { id: 'tercero', posKey: 'tercero', label: 'Tercero', sub: '3rd', color: '#e65100', base: true },
]
const POS_COLORS = { primero: '#3949ab', segundo: '#2e7d32', tercero: '#e65100' }
const POS_IDX    = { primero: '1',       segundo: '2',       tercero: '3'       }

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function calcAmount(qty, rate) {
  return (parseFloat(qty) || 0) * (parseFloat(rate) || 0)
}

function buildItems(configItems) {
  return (configItems || []).map(it => ({
    ...it,
    qty1: '', qty2: '', qty3: '',
    amt1: 0,  amt2: 0,  amt3: 0,
    qty2manual: false,
    extraSlots: {},
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
      extraSlots: saved.extraSlots || {},
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PayrollBuilder({
  config,
  onSave,
  onClose,
  editPayroll,
  defaultPeriod,
  // slot-aware props (from Editor)
  slots: slotsProp,
  activeSlotId: activeSlotIdProp,
  onSlotChange,
  // legacy single-position props (standalone use)
  position: positionProp,
  onPositionChange,
}) {
  // Build effective slots list
  const slots = slotsProp || BASE_POSITIONS

  // Active slot — controlled from outside if slotsProp is provided
  const [activeSlotIdInternal, setActiveSlotIdInternal] = useState(
    editPayroll?.position || activeSlotIdProp || 'primero'
  )
  const activeSlotId = activeSlotIdProp !== undefined ? activeSlotIdProp : activeSlotIdInternal

  function setActiveSlot(id) {
    setActiveSlotIdInternal(id)
    onSlotChange?.(id)
    // legacy compat: also call onPositionChange with posKey
    const slot = slots.find(s => s.id === id)
    if (slot) onPositionChange?.(slot.posKey || slot.id)
  }

  const activeSlot = slots.find(s => s.id === activeSlotId) || slots[0]
  const isExtra    = !activeSlot.base
  const posKey     = activeSlot.posKey || activeSlot.id
  const posIdx     = POS_IDX[posKey]
  const posColor   = POS_COLORS[posKey] || '#3949ab'

  // ── Crew names (one per slot) ─────────────────────────────────────────────
  const [crewNames, setCrewNames] = useState(() => {
    const base = {
      primero: editPayroll?.crewNames?.primero || '',
      segundo: editPayroll?.crewNames?.segundo || '',
      tercero: editPayroll?.crewNames?.tercero || '',
    }
    const extra = editPayroll?.crewNames || {}
    return { ...base, ...extra }
  })

  // Ensure extra slots get an entry in crewNames when they appear
  useEffect(() => {
    slots.forEach(slot => {
      if (!slot.base && !(slot.id in crewNames)) {
        setCrewNames(cn => ({ ...cn, [slot.id]: '' }))
      }
    })
  }, [slots])

  const currentCrewName = crewNames[activeSlotId] || ''
  function setCurrentCrewName(val) {
    setCrewNames(cn => ({ ...cn, [activeSlotId]: val }))
  }

  // ── Period ────────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState(editPayroll?.period || defaultPeriod || '')

  // ── Items ─────────────────────────────────────────────────────────────────
  const [items, setItems] = useState(() =>
    editPayroll
      ? hydrateItems(config?.items, editPayroll.items)
      : buildItems(config?.items)
  )

  // ── Discounts (keyed by slot id) ──────────────────────────────────────────
  const [discounts, setDiscounts] = useState(() => {
    const d = editPayroll?.discounts
    if (d) {
      if (Array.isArray(d)) return { primero: d, segundo: [], tercero: [] }
      return { primero: [], segundo: [], tercero: [], ...d }
    }
    const hotel = () => ({ id: uid(), label: 'Hotel', amount: '137' })
    return { primero: [hotel()], segundo: [hotel()], tercero: [] }
  })

  useEffect(() => {
    slots.forEach(slot => {
      if (!slot.base && !(slot.id in discounts)) {
        setDiscounts(d => ({ ...d, [slot.id]: [] }))
      }
    })
  }, [slots])

  // ── Crews ─────────────────────────────────────────────────────────────────
  const { crews, saveCrew: storeSaveCrew, deleteCrew: storeDeleteCrew } = useCrews()

  function handleSaveCrew() {
    const label = [crewNames.primero, crewNames.segundo, crewNames.tercero].filter(Boolean).join(' / ') || 'Crew'
    storeSaveCrew({ id: uid(), label, primero: crewNames.primero, segundo: crewNames.segundo, tercero: crewNames.tercero })
  }
  function loadCrew(c) {
    setCrewNames(cn => ({ ...cn, primero: c.primero || '', segundo: c.segundo || '', tercero: c.tercero || '' }))
  }

  // ── Fill / divide state ───────────────────────────────────────────────────
  const [fillAll,       setFillAll]       = useState(false)
  const [fillTwo,       setFillTwo]       = useState(false)
  const [div2On,        setDiv2On]        = useState({})
  const [div2Originals, setDiv2Originals] = useState({})

  // ── Item qty/rate helpers ─────────────────────────────────────────────────

  function getItemQty(item) {
    return isExtra ? (item.extraSlots?.[activeSlotId]?.qty ?? '') : (item[`qty${posIdx}`] ?? '')
  }
  function getItemAmt(item) {
    return isExtra ? (item.extraSlots?.[activeSlotId]?.amt ?? 0) : (item[`amt${posIdx}`] ?? 0)
  }

  function setItemQty(idx, val) {
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      if (isExtra) {
        const amt = calcAmount(val, it[`rate${posIdx}`])
        return { ...it, extraSlots: { ...it.extraSlots, [activeSlotId]: { qty: val, amt } } }
      }
      const updated = { ...it, [`qty${posIdx}`]: val, [`amt${posIdx}`]: calcAmount(val, it[`rate${posIdx}`]) }
      if (posIdx === '2') updated.qty2manual = true
      return updated
    }))
  }

  function handleQtyBlur(idx) {
    if (isExtra || posIdx !== '1') return
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const q1raw = parseFloat(it.qty1) || 0
      if (q1raw === 0) return it
      const shouldHalve = it.divBy2 && (fillTwo || fillAll)
      const q1final = shouldHalve ? q1raw / 2 : q1raw
      const q1str = String(q1final)
      const updated = { ...it, qty1: q1str, amt1: calcAmount(q1str, it.rate1) }
      if (fillTwo || fillAll) { updated.qty2 = q1str; updated.amt2 = calcAmount(q1str, it.rate2); updated.qty2manual = false }
      if (fillAll)            { updated.qty3 = q1str; updated.amt3 = calcAmount(q1str, it.rate3) }
      return updated
    }))
  }

  function setRate(idx, val) {
    setItems(its => its.map((it, i) => {
      if (i !== idx) return it
      const rk = `rate${posIdx}`
      const updated = { ...it, [rk]: val, [`amt${posIdx}`]: calcAmount(it[`qty${posIdx}`], val) }
      // Also recompute extra slots of same posKey
      const newExtraSlots = { ...it.extraSlots }
      slots.filter(s => !s.base && s.posKey === posKey).forEach(slot => {
        const prev = newExtraSlots[slot.id] || { qty: '', amt: 0 }
        newExtraSlots[slot.id] = { ...prev, amt: calcAmount(prev.qty, val) }
      })
      updated.extraSlots = newExtraSlots
      return updated
    }))
  }

  function autoFillSegundo() {
    setItems(its => its.map(it => {
      const q1 = parseFloat(it.qty1) || 0
      const autoQty2 = it.divBy2 ? q1 / 2 : q1
      return { ...it, qty2: autoQty2 === 0 ? '' : String(autoQty2), amt2: calcAmount(autoQty2, it.rate2), qty2manual: false }
    }))
  }

  function divideQtys(n) {
    setItems(its => its.map(it => {
      if (isExtra) {
        const prev = it.extraSlots?.[activeSlotId] || { qty: '', amt: 0 }
        const qty = parseFloat(prev.qty) || 0
        if (qty === 0) return it
        const newQty = Math.round(qty / n)
        const amt = calcAmount(newQty, it[`rate${posIdx}`])
        return { ...it, extraSlots: { ...it.extraSlots, [activeSlotId]: { qty: newQty === 0 ? '' : String(newQty), amt } } }
      }
      const qty = parseFloat(it[`qty${posIdx}`]) || 0
      if (qty === 0) return it
      const newQty = Math.round(qty / n)
      return { ...it, [`qty${posIdx}`]: newQty === 0 ? '' : String(newQty), [`amt${posIdx}`]: calcAmount(newQty, it[`rate${posIdx}`]) }
    }))
  }

  function toggleDiv2() {
    const key = activeSlotId
    const isOn = div2On[key]
    if (!isOn) {
      const originals = {}
      setItems(its => {
        const next = its.map((it, i) => {
          if (isExtra) {
            const prev = it.extraSlots?.[key] || { qty: '', amt: 0 }
            originals[i] = prev.qty
            const qty = parseFloat(prev.qty) || 0
            if (qty === 0) return it
            const newQty = Math.round(qty / 2)
            const amt = calcAmount(newQty, it[`rate${posIdx}`])
            return { ...it, extraSlots: { ...it.extraSlots, [key]: { qty: newQty === 0 ? '' : String(newQty), amt } } }
          }
          originals[i] = it[`qty${posIdx}`]
          const qty = parseFloat(it[`qty${posIdx}`]) || 0
          if (qty === 0) return it
          const newQty = Math.round(qty / 2)
          return { ...it, [`qty${posIdx}`]: newQty === 0 ? '' : String(newQty), [`amt${posIdx}`]: calcAmount(newQty, it[`rate${posIdx}`]) }
        })
        setDiv2Originals(prev => ({ ...prev, [key]: originals }))
        return next
      })
      setDiv2On(prev => ({ ...prev, [key]: true }))
    } else {
      const originals = div2Originals[key] || {}
      setItems(its => its.map((it, i) => {
        const origQty = originals[i] ?? (isExtra ? (it.extraSlots?.[key]?.qty ?? '') : it[`qty${posIdx}`])
        if (isExtra) {
          const amt = calcAmount(origQty, it[`rate${posIdx}`])
          return { ...it, extraSlots: { ...it.extraSlots, [key]: { qty: origQty, amt } } }
        }
        return { ...it, [`qty${posIdx}`]: origQty, [`amt${posIdx}`]: calcAmount(origQty, it[`rate${posIdx}`]) }
      }))
      setDiv2On(prev => ({ ...prev, [key]: false }))
    }
  }

  // ── Discounts ─────────────────────────────────────────────────────────────
  const posDiscounts = discounts[activeSlotId] || []
  function addDiscount() {
    setDiscounts(d => ({ ...d, [activeSlotId]: [...(d[activeSlotId] || []), { id: uid(), label: '', amount: '' }] }))
  }
  function setDiscount(id, f, v) {
    setDiscounts(d => ({ ...d, [activeSlotId]: (d[activeSlotId] || []).map(disc => disc.id === id ? { ...disc, [f]: v } : disc) }))
  }
  function removeDiscount(id) {
    setDiscounts(d => ({ ...d, [activeSlotId]: (d[activeSlotId] || []).filter(disc => disc.id !== id) }))
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const sub1 = items.reduce((s, it) => s + it.amt1, 0)
  const sub2 = items.reduce((s, it) => s + it.amt2, 0)
  const sub3 = items.reduce((s, it) => s + it.amt3, 0)
  const disc1 = (discounts.primero || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const disc2 = (discounts.segundo || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const disc3 = (discounts.tercero || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const tot1 = sub1 - disc1; const tot2 = sub2 - disc2; const tot3 = sub3 - disc3

  // Per-slot totals (base + extra)
  function slotTotal(slot) {
    if (slot.base) {
      return { sub: [sub1,sub2,sub3][parseInt(POS_IDX[slot.posKey])-1], disc: [disc1,disc2,disc3][parseInt(POS_IDX[slot.posKey])-1], tot: [tot1,tot2,tot3][parseInt(POS_IDX[slot.posKey])-1] }
    }
    const sub  = items.reduce((s, it) => s + (it.extraSlots?.[slot.id]?.amt || 0), 0)
    const disc = (discounts[slot.id] || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
    return { sub, disc, tot: sub - disc }
  }

  const activeTotal = slotTotal(activeSlot)

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    const cleanDiscounts = {}
    slots.forEach(slot => {
      const key = slot.id
      cleanDiscounts[key] = (discounts[key] || []).filter(d => d.label || d.amount)
    })
    onSave({
      id:        editPayroll?.id || uid(),
      position:  posKey,
      activeSlotId,
      crewNames,
      period,
      items:     items.map(({ qty2manual, ...it }) => it),
      discounts: cleanDiscounts,
      subtotal1: sub1, subtotal2: sub2, subtotal3: sub3,
      totalDisc1: disc1, totalDisc2: disc2, totalDisc3: disc3,
      total1: tot1, total2: tot2, total3: tot3,
      createdAt: editPayroll?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const hasItems  = (config?.items?.length || 0) > 0
  const crewLabel = `${activeSlot.label} — Name`

  return (
    <div className={s.wrap}>

      {/* ── Slot tabs ── */}
      <div className={s.posTabs}>
        {slots.map(slot => {
          const { tot } = slotTotal(slot)
          const isActive = activeSlotId === slot.id
          return (
            <button
              key={slot.id}
              className={`${s.posTab} ${isActive ? s.posTabActive : ''}`}
              style={isActive ? { '--tab-color': slot.color } : {}}
              onClick={() => setActiveSlot(slot.id)}
            >
              <span className={s.posLabel}>{slot.label}</span>
              {slot.base && <span className={s.posSub}>{slot.sub}</span>}
              <span className={s.posAmt}>{fmtMoney(tot)}</span>
            </button>
          )
        })}
      </div>

      {/* ── Meta row ── */}
      <div className={s.metaRow}>
        <div className={s.metaField}>
          <label>Period</label>
          <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. Apr 7–13, 2026" />
        </div>
        <div className={s.metaField}>
          <label style={{ color: posColor }}>▸ {crewLabel}</label>
          <input value={currentCrewName} onChange={e => setCurrentCrewName(e.target.value)} placeholder="Crew member name" />
        </div>
        <div className={s.metaSaveCrew}>
          <button className={s.btnSaveCrew} onClick={handleSaveCrew}>+ Save as Crew</button>
        </div>
      </div>

      {/* ── Auto-fill hint (Segundo base only) ── */}
      {posKey === 'segundo' && !isExtra && !fillAll && (
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
                const rateVal = item[`rate${posIdx}`]
                const isNA    = rateVal === null || rateVal === undefined || rateVal === ''
                const qtyVal  = getItemQty(item)
                const amtVal  = getItemAmt(item)
                const isAuto  = !isExtra && posIdx === '2' && !item.qty2manual
                return (
                  <tr key={idx} className={isNA ? s.naRow : ''}>
                    <td className={s.code}>{item.code}</td>
                    <td className={s.desc}>{item.label}</td>
                    <td className={s.tc}><span className={s.unitTxt}>{item.unit}</span></td>
                    <td className={s.tc}>{item.divBy2 ? <span className={s.divBadge}>÷2</span> : null}</td>
                    <td className={s.tr}>
                      <input type="number" className={s.rateInput} value={rateVal ?? ''} onChange={e => setRate(idx, e.target.value)} placeholder="—" />
                    </td>
                    <td className={s.tr}>
                      <input
                        type="number"
                        className={`${s.qtyInput} ${isAuto ? s.qtyAuto : ''}`}
                        value={qtyVal}
                        onChange={e => setItemQty(idx, e.target.value)}
                        onBlur={() => handleQtyBlur(idx)}
                        placeholder="0"
                      />
                    </td>
                    <td className={`${s.tr} ${s.amount} ${!amtVal ? s.dim : ''}`}>
                      {amtVal ? fmtMoney(amtVal) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Discounts ── */}
      <div className={s.discountsSection}>
        <div className={s.discountsHeader}>
          <span className={s.discountsTitle} style={{ color: posColor }}>Deductions — {activeSlot.label}</span>
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

      {/* ── Summary cards (all slots) ── */}
      <div className={s.summary}>
        {slots.map(slot => {
          const { sub, disc, tot } = slotTotal(slot)
          const isActive = activeSlotId === slot.id
          return (
            <div
              key={slot.id}
              className={`${s.summaryCard} ${isActive ? s.summaryCardActive : ''}`}
              style={isActive ? { borderColor: slot.color } : {}}
              onClick={() => setActiveSlot(slot.id)}
            >
              <div className={s.summaryPos} style={{ color: slot.color }}>{slot.label}</div>
              <div className={s.summaryCrew}>{crewNames[slot.id] || <span className={s.summaryEmpty}>—</span>}</div>
              {disc > 0 && <div className={s.summarySub}>{fmtMoney(sub)}</div>}
              {disc > 0 && <div className={s.summaryDisc}>−{fmtMoney(disc)}</div>}
              <div className={s.summaryTotal} style={{ color: isActive ? slot.color : '#1a1a2e' }}>{fmtMoney(tot)}</div>
            </div>
          )
        })}
      </div>

      {/* ── Footer controls ── */}
      <div className={s.footer}>
        <div className={s.footerControls}>
          <button className={`${s.btnFillAll} ${fillTwo ? s.btnFillAllOn : ''}`} onClick={() => { setFillTwo(v => !v); setFillAll(false) }} title="Auto-fill Segundo from Primero">{fillTwo ? '● All 2' : '○ All 2'}</button>
          <button className={`${s.btnFillAll} ${fillAll ? s.btnFillAllOn : ''}`} onClick={() => { setFillAll(v => !v); setFillTwo(false) }} title="Auto-fill all 3 from Primero">{fillAll ? '● All 3' : '○ All 3'}</button>
          <div className={s.dividerV} />
          <button className={`${s.btnDiv} ${div2On[activeSlotId] ? s.btnDivOn : ''}`} onClick={toggleDiv2} title="Toggle ÷2">{div2On[activeSlotId] ? '● ÷2' : '○ ÷2'}</button>
          <button className={s.btnDiv} onClick={() => divideQtys(3)}>÷3</button>
          <button className={s.btnDiv} onClick={() => divideQtys(4)}>÷4</button>
        </div>
        <div className={s.footerBtns}>
          {onClose && <button className={s.btnCancel} onClick={onClose}>Cancel</button>}
          <button className={s.btnSave} onClick={handleSave} disabled={!currentCrewName.trim()}>
            {editPayroll ? '✓ Update' : '💾 Save Payroll'}
          </button>
        </div>
      </div>

      {/* ── Saved crews ── */}
      {crews.length > 0 && (
        <div className={s.crewsSection}>
          {crews.map(c => (
            <div key={c.id} className={s.crewCard}>
              <span className={s.crewCardLabel} onClick={() => loadCrew(c)}>{c.label}</span>
              <button className={s.crewCardDel} onClick={() => storeDeleteCrew(c.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
