import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const KEY = 'payroll_manager_v2'
const DEFAULTS_KEY = 'payroll_manager_defaults'
const CREWS_KEY = 'dccable_crews'
const SYNC_ROW_ID = 'main'

const supabase = createClient(
  'https://rqnmaoqzdwnuaiwrutte.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbm1hb3F6ZHdudWFpd3J1dHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODE1MzAsImV4cCI6MjA4NDU1NzUzMH0.ZE77nGj5-4zCSDwmAh5exlnQ_NcVxGniDVua_qLA0Fs'
)

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(data) { localStorage.setItem(KEY, JSON.stringify(data)) }

function loadCrewsLocal() {
  try { return JSON.parse(localStorage.getItem(CREWS_KEY) || '[]') } catch { return [] }
}
function persistCrews(crews) { localStorage.setItem(CREWS_KEY, JSON.stringify(crews)) }

// ── Sync ──────────────────────────────────────────────────────────────────────

let syncTimer = null
function scheduleSync() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      await supabase.from('payroll_manager_state').upsert({
        id: SYNC_ROW_ID,
        data: { projects: _data, crews: _crews },
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn('Supabase sync failed', e)
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

const POS_LABELS = { primero: 'Primero', segundo: 'Segundo', tercero: 'Tercero' }

function normalizeRowsObj(rows) {
  if (!rows) return { primero: [], segundo: [], tercero: [] }
  if (Array.isArray(rows)) return { primero: rows, segundo: [], tercero: [] }
  return { primero: [], segundo: [], tercero: [], ...rows }
}

// ── Module state ──────────────────────────────────────────────────────────────

let _data = load()
let _listeners = []
let _crews = loadCrewsLocal()
let _crewListeners = []

export function getData() { return _data }

function notify() { _listeners.forEach(fn => fn([..._data])) }
function notifyCrews() { _crewListeners.forEach(fn => fn([..._crews])) }

// On module load: pull from Supabase; handles both old (array) and new ({ projects, crews }) format
;(async () => {
  try {
    const { data: row } = await supabase
      .from('payroll_manager_state')
      .select('data')
      .eq('id', SYNC_ROW_ID)
      .single()

    if (row?.data) {
      const remote = row.data
      const projects = Array.isArray(remote) ? remote : (remote.projects || [])
      const crews    = Array.isArray(remote) ? []      : (remote.crews    || [])

      if (projects.length > 0 || crews.length > 0) {
        _data  = projects
        _crews = crews
        persist(_data)
        persistCrews(_crews)
        notify()
        notifyCrews()
      } else {
        // Table row exists but is empty — push local up
        scheduleSync()
      }
    } else {
      // No row at all — push local up if we have anything
      if (_data.length > 0 || _crews.length > 0) scheduleSync()
    }
  } catch (e) {
    console.warn('Supabase initial load failed', e)
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

  function addPositionSlot(pid, fid, posKey) {
    const slotId = uid()
    commit(_data.map(p => p.id !== pid ? p : {
      ...p,
      folders: treeUpdate(p.folders || [], fid, f => {
        const existing = (f.extraSlots || []).filter(s => s.posKey === posKey).length
        const num = existing + 2
        return {
          ...f,
          extraSlots: [...(f.extraSlots || []), { id: slotId, posKey, label: `${POS_LABELS[posKey]} ${num}` }],
        }
      }),
    }))
    return slotId
  }

  function removePositionSlot(pid, fid, slotId) {
    commit(_data.map(p => p.id !== pid ? p : {
      ...p,
      folders: treeUpdate(p.folders || [], fid, f => {
        const rows = normalizeRowsObj(f.rows)
        delete rows[slotId]
        return {
          ...f,
          extraSlots: (f.extraSlots || []).filter(s => s.id !== slotId),
          rows,
        }
      }),
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
    createFolder, deleteFolder, addPositionSlot, removePositionSlot,
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
