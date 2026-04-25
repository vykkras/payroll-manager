import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const KEY = 'payroll_manager_v2'
const DEFAULTS_KEY = 'payroll_manager_defaults'
const CREWS_KEY = 'dccable_crews'
const EMPLOYEES_KEY = 'dccable_employees'
const SYNC_ROW_ID = 'main'

const supabase = createClient(
  'https://pmcllnbkzoztwpsxdbgf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtY2xsbmJrem96dHdwc3hkYmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzA2OTIsImV4cCI6MjA5MTI0NjY5Mn0.NOt__NLICA5Bf9HYruBGQ8mJLq-YFAOHo_2r7RJQl5U'
)

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(data) { localStorage.setItem(KEY, JSON.stringify(data)) }

function loadCrewsLocal() {
  try { return JSON.parse(localStorage.getItem(CREWS_KEY) || '[]') } catch { return [] }
}
function persistCrews(crews) { localStorage.setItem(CREWS_KEY, JSON.stringify(crews)) }

function loadEmployeesLocal() {
  try { return JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || '[]') } catch { return [] }
}
function persistEmployees(emps) { localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(emps)) }

// ── Sync ──────────────────────────────────────────────────────────────────────

let syncTimer = null
function scheduleSync() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      const { error } = await supabase.from('payroll_manager_state').upsert({
        id: SYNC_ROW_ID,
        data: { projects: _data, crews: _crews, employees: _employees },
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      notifySync('ok')
    } catch (e) {
      console.warn('Supabase sync failed', e)
      notifySync('error', e?.message || e?.code || String(e))
    }
  }, 1500)
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function loadProjectDefaults() {
  try { return JSON.parse(localStorage.getItem(DEFAULTS_KEY) || 'null') } catch { return null }
}
export function saveProjectDefaults(columns, items) {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ columns, items }))
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

export function treeFind(folders, fid) {
  for (const f of folders) {
    if (f.id === fid) return f
    const r = treeFind(f.folders || [], fid)
    if (r) return r
  }
  return null
}

export function treePath(folders, fid, path = []) {
  for (const f of folders) {
    if (f.id === fid) return [...path, f]
    const r = treePath(f.folders || [], fid, [...path, f])
    if (r) return r
  }
  return null
}

export function treeParentId(folders, fid) {
  for (const f of folders) {
    if ((f.folders || []).some(c => c.id === fid)) return f.id
    const r = treeParentId(f.folders || [], fid)
    if (r !== undefined) return r
  }
  return undefined
}

function treeAdd(folders, parentFid, item) {
  if (!parentFid) return [...folders, item]
  return folders.map(f => {
    if (f.id === parentFid) return { ...f, folders: [...(f.folders || []), item] }
    return { ...f, folders: treeAdd(f.folders || [], parentFid, item) }
  })
}

function treeRemove(folders, fid) {
  return folders
    .filter(f => f.id !== fid)
    .map(f => ({ ...f, folders: treeRemove(f.folders || [], fid) }))
}

function treeUpdate(folders, fid, fn) {
  return folders.map(f => {
    if (f.id === fid) return fn(f)
    return { ...f, folders: treeUpdate(f.folders || [], fid, fn) }
  })
}

// ── Module state ──────────────────────────────────────────────────────────────

let _data = load()
let _listeners = []
let _crews = loadCrewsLocal()
let _crewListeners = []
let _employees = loadEmployeesLocal()
let _employeeListeners = []

export function getData() { return _data }

function notify() { _listeners.forEach(fn => fn([..._data])) }
function notifyCrews() { _crewListeners.forEach(fn => fn([..._crews])) }
function notifyEmployees() { _employeeListeners.forEach(fn => fn([..._employees])) }

// ── Sync status ───────────────────────────────────────────────────────────────

let _syncStatus = 'pending'   // 'pending' | 'ok' | 'error'
let _syncError  = ''
let _syncListeners = []
function notifySync(s, err = '') { _syncStatus = s; _syncError = err; _syncListeners.forEach(fn => fn(s, err)) }
export function useSyncStatus() {
  const [status, setStatus] = useState(_syncStatus)
  const [error,  setError]  = useState(_syncError)
  useEffect(() => {
    const fn = (s, e) => { setStatus(s); setError(e) }
    _syncListeners.push(fn)
    return () => { _syncListeners = _syncListeners.filter(f => f !== fn) }
  }, [])
  return { status, error }
}

// On module load: pull from Supabase; handles both old (array) and new ({ projects, crews }) format
;(async () => {
  try {
    const { data: row, error } = await supabase
      .from('payroll_manager_state')
      .select('data')
      .eq('id', SYNC_ROW_ID)
      .single()

    if (error && error.code !== 'PGRST116') throw error  // PGRST116 = no rows found (ok)

    if (row?.data) {
      const remote = row.data
      const projects   = Array.isArray(remote) ? remote : (remote.projects   || [])
      const crews      = Array.isArray(remote) ? []      : (remote.crews      || [])
      const employees  = Array.isArray(remote) ? []      : (remote.employees  || [])

      if (projects.length > 0 || crews.length > 0 || employees.length > 0) {
        _data      = projects
        _crews     = crews
        _employees = employees
        persist(_data)
        persistCrews(_crews)
        persistEmployees(_employees)
        notify()
        notifyCrews()
        notifyEmployees()
      } else {
        scheduleSync()
      }
    } else {
      if (_data.length > 0 || _crews.length > 0) scheduleSync()
    }
    notifySync('ok')
  } catch (e) {
    console.warn('Supabase initial load failed', e)
    notifySync('error', e?.message || e?.code || String(e))
  }
})()

// ── Projects store ────────────────────────────────────────────────────────────

export function useStore() {
  const [data, setData] = useState(_data)

  useEffect(() => {
    _listeners.push(setData)
    return () => { _listeners = _listeners.filter(f => f !== setData) }
  }, [])

  function commit(next) {
    _data = next
    persist(next)
    notify()
    scheduleSync()
  }

  // ── Projects ────────────────────────────────────────────────────────────────

  function createProject(name, color, columns = [], items = [], templateId = null) {
    commit([..._data, {
      id: uid(), name, color,
      columns, items,
      templateId,
      createdAt: new Date().toISOString(),
      folders: [],
      sheets: [],
    }])
  }

  function deleteProject(pid) {
    commit(_data.filter(p => p.id !== pid))
  }

  function updateProjectColumns(pid, columns) {
    commit(_data.map(p => p.id === pid ? { ...p, columns } : p))
    const project = _data.find(p => p.id === pid)
    if (project) saveProjectDefaults(columns, project.items || [])
  }

  function updateProjectItems(pid, items) {
    commit(_data.map(p => p.id === pid ? { ...p, items } : p))
    const project = _data.find(p => p.id === pid)
    if (project) saveProjectDefaults(project.columns || [], items)
  }

  // ── Folders ─────────────────────────────────────────────────────────────────

  function createFolder(pid, parentFid, name) {
    const folder = {
      id: uid(), name, createdAt: new Date().toISOString(),
      folders: [], payrolls: [],
      rows: { primero: [], segundo: [], tercero: [] },
    }
    commit(_data.map(p => p.id !== pid ? p : {
      ...p,
      folders: treeAdd(p.folders || [], parentFid, folder),
    }))
  }

  function deleteFolder(pid, fid) {
    commit(_data.map(p => p.id !== pid ? p : {
      ...p,
      folders: treeRemove(p.folders || [], fid),
    }))
  }

  // ── Folder rows ──────────────────────────────────────────────────────────────

  function _normalizeRows(rows) {
    if (!rows) return { primero: [], segundo: [], tercero: [] }
    if (Array.isArray(rows)) return { primero: rows, segundo: [], tercero: [] }
    return { primero: [], segundo: [], tercero: [], ...rows }
  }

  function addFolderRow(pid, fid, row, pos = 'primero') {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => {
        const r = _normalizeRows(f.rows)
        return { ...f, rows: { ...r, [pos]: [...(r[pos] || []), row] } }
      })}
    }))
  }

  function updateFolderRow(pid, fid, row, pos = 'primero') {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => {
        const r = _normalizeRows(f.rows)
        return { ...f, rows: { ...r, [pos]: (r[pos] || []).map(x => x.id === row.id ? row : x) } }
      })}
    }))
  }

  function deleteFolderRow(pid, fid, rowId, pos = 'primero') {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => {
        const r = _normalizeRows(f.rows)
        return { ...f, rows: { ...r, [pos]: (r[pos] || []).filter(x => x.id !== rowId) } }
      })}
    }))
  }

  function clearFolderRows(pid, fid) {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => ({
        ...f, rows: { primero: [], segundo: [], tercero: [] },
      }))}
    }))
  }

  function setFolderRows(pid, fid, rows) {
    const normalized = (!rows || Array.isArray(rows))
      ? { primero: rows || [], segundo: [], tercero: [] }
      : { primero: [], segundo: [], tercero: [], ...rows }
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => ({
        ...f, rows: normalized,
      }))}
    }))
  }

  // ── Payrolls ─────────────────────────────────────────────────────────────────

  function savePayroll(pid, fid, payroll) {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return {
        ...p,
        folders: treeUpdate(p.folders || [], fid, f => {
          const exists = (f.payrolls || []).some(pr => pr.id === payroll.id)
          return {
            ...f,
            payrolls: exists
              ? f.payrolls.map(pr => pr.id === payroll.id ? payroll : pr)
              : [...(f.payrolls || []), payroll],
          }
        }),
      }
    }))
  }

  function deletePayroll(pid, fid, payrollId) {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return {
        ...p,
        folders: treeUpdate(p.folders || [], fid, f => ({
          ...f,
          payrolls: (f.payrolls || []).filter(pr => pr.id !== payrollId),
        })),
      }
    }))
  }

  function saveFolderSummary(pid, fid, incomeLines) {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return {
        ...p,
        folders: treeUpdate(p.folders || [], fid, f => ({
          ...f,
          summary: { incomeLines },
        })),
      }
    }))
  }

  function addSheet(pid, sheet) {
    commit(_data.map(p => p.id !== pid ? p : {
      ...p, sheets: [...(p.sheets || []), sheet],
    }))
  }

  function deleteSheet(pid, sheetId) {
    commit(_data.map(p => p.id !== pid ? p : {
      ...p, sheets: (p.sheets || []).filter(s => s.id !== sheetId),
    }))
  }

  return {
    data,
    createProject, deleteProject,
    updateProjectColumns, updateProjectItems,
    createFolder, deleteFolder,
    addFolderRow, updateFolderRow, deleteFolderRow, clearFolderRows,
    savePayroll, deletePayroll,
    saveFolderSummary,
    setFolderRows,
    addSheet, deleteSheet,
  }
}

// ── Crews store ───────────────────────────────────────────────────────────────

function commitCrews(next) {
  _crews = next
  persistCrews(next)
  notifyCrews()
  scheduleSync()
}

export function useCrews() {
  const [crews, setCrews] = useState(_crews)

  useEffect(() => {
    _crewListeners.push(setCrews)
    return () => { _crewListeners = _crewListeners.filter(f => f !== setCrews) }
  }, [])

  return {
    crews,
    saveCrew:   (crew) => commitCrews([..._crews, crew]),
    deleteCrew: (id)   => commitCrews(_crews.filter(c => c.id !== id)),
  }
}

// ── Employees store ───────────────────────────────────────────────────────────

function commitEmployees(next) {
  _employees = next
  persistEmployees(next)
  notifyEmployees()
  scheduleSync()
}

export function useEmployees() {
  const [employees, setEmployees] = useState(_employees)

  useEffect(() => {
    _employeeListeners.push(setEmployees)
    return () => { _employeeListeners = _employeeListeners.filter(f => f !== setEmployees) }
  }, [])

  return {
    employees,
    saveEmployee: (emp) => {
      const exists = _employees.some(e => e.id === emp.id)
      commitEmployees(exists
        ? _employees.map(e => e.id === emp.id ? emp : e)
        : [..._employees, emp]
      )
    },
    deleteEmployee: (id) => commitEmployees(_employees.filter(e => e.id !== id)),
  }
}
