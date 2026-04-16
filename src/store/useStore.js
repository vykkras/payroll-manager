import { useState, useEffect } from 'react'

const KEY = 'payroll_manager_v2'
const DEFAULTS_KEY = 'payroll_manager_defaults'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

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

// ─────────────────────────────────────────────────────────────────────────────

let _data = load()
let _listeners = []

export function getData() { return _data }

function notify() { _listeners.forEach(fn => fn([..._data])) }

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
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  // project: { id, name, color, createdAt,
  //            columns: [{ id, name }],
  //            items: [{ id, label, unit, code, rate1, rate2, rate3, divBy2 }],
  //            folders: [] }

  function createProject(name, color, columns = [], items = []) {
    commit([..._data, {
      id: uid(), name, color,
      columns, items,
      createdAt: new Date().toISOString(),
      folders: [],
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

  // ── Folders (recursive tree) ──────────────────────────────────────────────
  // folder: { id, name, createdAt, folders: [], payrolls: [],
  //           rows: { primero: [], segundo: [], tercero: [] } }

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

  // ── Folder rows (per-position data entry) ────────────────────────────────
  // rows is { primero: [], segundo: [], tercero: [] }
  // Legacy: if rows is a flat array, treat as primero

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
        return { ...f, rows: { ...r, [pos]: [...r[pos], row] } }
      })}
    }))
  }

  function updateFolderRow(pid, fid, row, pos = 'primero') {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => {
        const r = _normalizeRows(f.rows)
        return { ...f, rows: { ...r, [pos]: r[pos].map(x => x.id === row.id ? row : x) } }
      })}
    }))
  }

  function deleteFolderRow(pid, fid, rowId, pos = 'primero') {
    commit(_data.map(p => {
      if (p.id !== pid) return p
      return { ...p, folders: treeUpdate(p.folders || [], fid, f => {
        const r = _normalizeRows(f.rows)
        return { ...f, rows: { ...r, [pos]: r[pos].filter(x => x.id !== rowId) } }
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

  // ── Payrolls ──────────────────────────────────────────────────────────────

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

  return {
    data,
    createProject, deleteProject,
    updateProjectColumns, updateProjectItems,
    createFolder, deleteFolder,
    addFolderRow, updateFolderRow, deleteFolderRow, clearFolderRows,
    savePayroll, deletePayroll,
    saveFolderSummary,
  }
}
