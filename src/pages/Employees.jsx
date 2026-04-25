import { useState } from 'react'
import { uid, useEmployees, useSyncStatus } from '../store/useStore'
import Modal from '../components/Modal'
import s from './Employees.module.css'

const EMPTY_FORM = { name: '', phone: '', email: '', employeeId: '' }

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Employees({ section, onSectionChange }) {
  const { employees, saveEmployee, deleteEmployee } = useEmployees()
  const { status: syncStatus, error: syncError } = useSyncStatus()

  const [search,    setSearch]    = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [delTarget, setDelTarget] = useState(null)

  const filtered = employees.filter(e => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.name?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.phone?.toLowerCase().includes(q)
    )
  })

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(emp) {
    setEditId(emp.id)
    setForm({ name: emp.name || '', phone: emp.phone || '', email: emp.email || '', employeeId: emp.employeeId || '' })
    setShowForm(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    saveEmployee({
      id: editId || uid(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      employeeId: form.employeeId.trim(),
      createdAt: editId ? (employees.find(e => e.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    })
    setShowForm(false)
  }

  function field(key, label, placeholder, type = 'text') {
    return (
      <div className={s.field}>
        <label>{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={placeholder}
          autoFocus={key === 'name'}
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <nav className={s.nav}>
          <button className={`${s.navBtn} ${section === 'payrolls' ? s.navBtnActive : ''}`} onClick={() => onSectionChange('payrolls')}>Payrolls</button>
          <button className={`${s.navBtn} ${section === 'employees' ? s.navBtnActive : ''}`} onClick={() => onSectionChange('employees')}>Employees</button>
        </nav>
        <span
          className={s.syncDot}
          style={{ background: syncStatus === 'ok' ? '#2e7d32' : syncStatus === 'error' ? '#c0392b' : '#aaa' }}
          title={syncStatus === 'ok' ? 'Synced' : syncStatus === 'error' ? `Sync failed: ${syncError}` : 'Connecting…'}
        />
      </header>

      <main className={s.main}>
        <div className={s.ph}>
          <div>
            <h2>Employees</h2>
            <p>{employees.length} employee{employees.length !== 1 ? 's' : ''} in the database</p>
          </div>
          <button className={s.btnAdd} onClick={openAdd}>+ Add Employee</button>
        </div>

        <div className={s.searchRow}>
          <input
            className={s.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID, email or phone…"
          />
          {search && <button className={s.searchClear} onClick={() => setSearch('')}>✕</button>}
        </div>

        {filtered.length === 0 ? (
          <div className={s.empty}>
            <span className={s.emptyIcon}>👷</span>
            <h3>{search ? 'No results' : 'No employees yet'}</h3>
            <p>{search ? 'Try a different search term' : 'Add your first employee to get started'}</p>
          </div>
        ) : (
          <div className={s.list}>
            {filtered.map(emp => (
              <div key={emp.id} className={s.card}>
                <div className={s.avatar}>{initials(emp.name || '?')}</div>
                <div className={s.cardBody}>
                  <div className={s.cardName}>{emp.name}</div>
                  <div className={s.cardMeta}>
                    {emp.employeeId && <span className={s.badge}>#{emp.employeeId}</span>}
                    {emp.phone && <span>{emp.phone}</span>}
                    {emp.email && <span>{emp.email}</span>}
                  </div>
                </div>
                <div className={s.cardActions}>
                  <button className={s.editBtn} onClick={() => openEdit(emp)}>✏</button>
                  <button className={s.delBtn} onClick={() => setDelTarget(emp.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <Modal title={editId ? 'Edit Employee' : 'Add Employee'} onClose={() => setShowForm(false)}>
          {field('name',       'Full Name',      'e.g. John Smith')}
          {field('employeeId', 'Employee ID',    'e.g. 1042')}
          {field('phone',      'Phone',          'e.g. 555-0100')}
          {field('email',      'Email',          'e.g. john@example.com', 'email')}
          <div className={s.modalFooter}>
            <button className={s.btnCancel} onClick={() => setShowForm(false)}>Cancel</button>
            <button className={s.btnOk} onClick={handleSave} disabled={!form.name.trim()}>
              {editId ? 'Save' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {delTarget && (
        <Modal title="Remove employee?" onClose={() => setDelTarget(null)}>
          <p className={s.delMsg}>
            This removes <strong>{employees.find(e => e.id === delTarget)?.name}</strong> from the database.
          </p>
          <div className={s.modalFooter}>
            <button className={s.btnCancel} onClick={() => setDelTarget(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { deleteEmployee(delTarget); setDelTarget(null) }}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
