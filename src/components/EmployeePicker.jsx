import { useState, useRef, useEffect } from 'react'
import { uid, useEmployees } from '../store/useStore'
import s from './EmployeePicker.module.css'

export default function EmployeePicker({ value, onChange, placeholder }) {
  const { employees, saveEmployee } = useEmployees()
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value || '')
  const wrapRef = useRef(null)

  // Keep query in sync when value is set externally (e.g. loading a saved payroll)
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const trimmed = query.trim()
  const filtered = employees.filter(e =>
    !trimmed || e.name.toLowerCase().includes(trimmed.toLowerCase())
  )
  const exactMatch = employees.some(e => e.name.toLowerCase() === trimmed.toLowerCase())
  const showAdd = trimmed && !exactMatch

  function select(name) {
    onChange(name)
    setQuery(name)
    setOpen(false)
  }

  function addAndSelect() {
    if (!trimmed) return
    saveEmployee({
      id: uid(),
      name: trimmed,
      phone: '', email: '', employeeId: '',
      createdAt: new Date().toISOString(),
    })
    select(trimmed)
  }

  function handleInput(e) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  const showDropdown = open && (filtered.length > 0 || showAdd)

  return (
    <div className={s.wrap} ref={wrapRef}>
      <input
        className={s.input}
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || 'Search employees…'}
        autoComplete="off"
      />
      {showDropdown && (
        <div className={s.dropdown}>
          {filtered.map(e => (
            <div
              key={e.id}
              className={`${s.option} ${e.name === value ? s.optionSelected : ''}`}
              onMouseDown={ev => { ev.preventDefault(); select(e.name) }}
            >
              <span className={s.avatar}>{e.name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
              <span className={s.name}>{e.name}</span>
              {e.employeeId && <span className={s.badge}>#{e.employeeId}</span>}
            </div>
          ))}
          {showAdd && (
            <div className={s.addOption} onMouseDown={ev => { ev.preventDefault(); addAndSelect() }}>
              + Add <strong>"{trimmed}"</strong> as new employee
            </div>
          )}
        </div>
      )}
    </div>
  )
}
