import { useState } from 'react'
import { uid } from '../../store/useStore'
import Modal from '../../components/Modal'
import s from './ItemsTab.module.css'

const EMPTY_FORM = { label: '', unit: '', code: '', rate1: '', rate2: '', rate3: '', divBy2: false }

export default function ItemsTab({ store, project }) {
  const items = project.items || []
  const [showForm, setShowForm]   = useState(false)
  const [editId,   setEditId]     = useState(null)
  const [form,     setForm]       = useState(EMPTY_FORM)
  const [delId,    setDelId]      = useState(null)

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(item) {
    setEditId(item.id)
    setForm({
      label: item.label || '', unit: item.unit || '', code: item.code || '',
      rate1: item.rate1 ?? '', rate2: item.rate2 ?? '', rate3: item.rate3 ?? '',
      divBy2: item.divBy2 || false,
    })
    setShowForm(true)
  }

  function handleSave() {
    if (!form.label.trim()) return
    const item = {
      id:    editId || uid(),
      label: form.label.trim(),
      unit:  form.unit.trim(),
      code:  form.code.trim(),
      rate1: form.rate1 !== '' ? Number(form.rate1) : null,
      rate2: form.rate2 !== '' ? Number(form.rate2) : null,
      rate3: form.rate3 !== '' ? Number(form.rate3) : null,
      divBy2: form.divBy2,
    }
    const next = editId ? items.map(i => i.id === editId ? item : i) : [...items, item]
    store.updateProjectItems(project.id, next)
    setShowForm(false)
  }

  function handleDelete(id) {
    store.updateProjectItems(project.id, items.filter(i => i.id !== id))
    setDelId(null)
  }

  function field(key, placeholder, type = 'text') {
    return (
      <div className={s.field}>
        <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
        <input
          type={type}
          step={type === 'number' ? '0.01' : undefined}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
        />
      </div>
    )
  }

  return (
    <div className={s.wrap}>
      <div className={s.ph}>
        <div>
          <h2>Payroll Items</h2>
          <p>Line items used in the payroll builder (code, rates, ÷2 flag)</p>
        </div>
        <button className={s.btnAdd} onClick={openAdd}>+ Add Item</button>
      </div>

      {items.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>💰</span>
          <h3>No payroll items yet</h3>
          <p>Add items to enable the payroll builder</p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Code</th><th>Label</th><th>Unit</th>
                <th className={s.r}>Rate 1</th><th className={s.r}>Rate 2</th><th className={s.r}>Rate 3</th>
                <th className={s.c}>÷2</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td className={s.code}>{it.code || '—'}</td>
                  <td className={s.label}>{it.label}</td>
                  <td className={s.unit}>{it.unit || '—'}</td>
                  <td className={s.r}>{it.rate1 ?? '—'}</td>
                  <td className={s.r}>{it.rate2 ?? '—'}</td>
                  <td className={s.r}>{it.rate3 ?? '—'}</td>
                  <td className={s.c}>{it.divBy2 ? '✓' : ''}</td>
                  <td className={s.actions}>
                    <button className={s.editBtn} onClick={() => openEdit(it)}>✏</button>
                    <button className={s.delBtn}  onClick={() => setDelId(it.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editId ? 'Edit Item' : 'Add Item'} onClose={() => setShowForm(false)}>
          <div className={s.formGrid}>
            {field('label', 'e.g. PM11')}
            {field('unit', 'ft / ea')}
            {field('code', 'e.g. PM11')}
          </div>
          <div className={s.rateRow}>
            {field('rate1', '0.00', 'number')}
            {field('rate2', '0.00', 'number')}
            {field('rate3', '0.00', 'number')}
          </div>
          <div className={s.checkRow}>
            <label className={s.checkLabel}>
              <input type="checkbox" checked={form.divBy2}
                onChange={e => setForm(f => ({ ...f, divBy2: e.target.checked }))} />
              Auto-fill 2nd position from 1st (÷2)
            </label>
          </div>
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={() => setShowForm(false)}>Cancel</button>
            <button className={s.btnOk} onClick={handleSave} disabled={!form.label.trim()}>
              {editId ? 'Save' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {delId && (
        <Modal title="Delete item?" onClose={() => setDelId(null)}>
          <p className={s.delMsg}>This item will be removed from the payroll builder.</p>
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={() => setDelId(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => handleDelete(delId)}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
