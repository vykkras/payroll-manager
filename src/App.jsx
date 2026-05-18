import { useState, useEffect } from 'react'
import { useStore, getData, treeFind, treeParentId } from './store/useStore'
import Home        from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import FolderView  from './pages/FolderView'
import Editor      from './pages/Editor'
import SheetEditor from './pages/SheetEditor'
import Employees   from './pages/Employees'
import './index.css'

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash || hash === 'employees') return { page: 'home', pid: null, fid: null, sheetId: null, _section: hash || 'payrolls' }
  const parts = hash.split('/')
  const pid = parts[1] || null
  if (parts[0] === 'project' && parts.length === 2) return { page: 'project', pid, fid: null, sheetId: null }
  if (parts[0] === 'project' && parts[2] === 'folder') return { page: 'folder', pid, fid: parts[3] || null, sheetId: null }
  if (parts[0] === 'project' && parts[2] === 'editor') return { page: 'editor', pid, fid: parts[3] || null, sheetId: null, editPayroll: null }
  if (parts[0] === 'project' && parts[2] === 'sheet')  return { page: 'sheet',  pid, fid: null, sheetId: parts[3] || null }
  return { page: 'home', pid: null, fid: null, sheetId: null }
}

function routeToHash(route, section) {
  if (route.page === 'home') return section === 'employees' ? '#/employees' : '#/'
  if (route.page === 'project') return `#/project/${route.pid}`
  if (route.page === 'folder')  return `#/project/${route.pid}/folder/${route.fid}`
  if (route.page === 'editor')  return `#/project/${route.pid}/editor/${route.fid}`
  if (route.page === 'sheet')   return `#/project/${route.pid}/sheet/${route.sheetId}`
  return '#/'
}

export default function App() {
  const store = useStore()

  const parsed = parseHash()
  const [route,   setRouteState] = useState({ page: parsed.page, pid: parsed.pid, fid: parsed.fid, sheetId: parsed.sheetId, editPayroll: null })
  const [section, setSection]    = useState(parsed._section || 'payrolls')

  function setRoute(r) {
    setRouteState(r)
    window.location.hash = routeToHash(r, section)
  }

  useEffect(() => {
    function onHashChange() {
      const p = parseHash()
      setRouteState({ page: p.page, pid: p.pid, fid: p.fid, sheetId: p.sheetId, editPayroll: null })
      if (p._section) setSection(p._section)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const expected = routeToHash(route, section)
    if (window.location.hash !== expected) window.location.hash = expected
  }, [section])

  const goHome    = ()         => setRoute({ page: 'home',    pid: null, fid: null, sheetId: null, editPayroll: null })
  const goProject = pid        => setRoute({ page: 'project', pid,       fid: null, sheetId: null, editPayroll: null })
  const goFolder  = (pid, fid) => setRoute({ page: 'folder',  pid,       fid,       sheetId: null, editPayroll: null })
  const goSheet   = (pid, sheetId) => setRoute({ page: 'sheet', pid, fid: null, sheetId, editPayroll: null })
  const goEditor = (pid, fid) => {
    store.clearFolderRows(pid, fid)
    setRoute({ page: 'editor', pid, fid, editPayroll: null })
  }

  function goEditorWithPayroll(pid, fid, payroll) {
    store.setFolderRows(pid, fid, payroll.rows || null)
    setRouteState({ page: 'editor', pid, fid, sheetId: null, editPayroll: payroll })
    window.location.hash = `#/project/${pid}/editor/${fid}`
  }

  const liveData = getData()
  const project  = liveData.find(p => p.id === route.pid) || store.data.find(p => p.id === route.pid)
  const folder   = project ? treeFind(project.folders || [], route.fid) : null

  function goFolderBack(pid, fid) {
    const lp = getData().find(p => p.id === pid)
    const parentId = treeParentId(lp?.folders || [], fid)
    if (parentId !== undefined) goFolder(pid, parentId)
    else goProject(pid)
  }

  return (
    <>
      {route.page === 'home' && section === 'employees' && (
        <Employees section={section} onSectionChange={s => { setSection(s); window.location.hash = s === 'employees' ? '#/employees' : '#/' }} />
      )}

      {route.page === 'home' && section === 'payrolls' && (
        <Home store={store} onOpenProject={goProject} section={section} onSectionChange={s => { setSection(s); window.location.hash = s === 'employees' ? '#/employees' : '#/' }} />
      )}

      {route.page === 'project' && project && (
        <ProjectPage
          store={store}
          project={project}
          onBack={goHome}
          onOpenFolder={fid => goFolder(project.id, fid)}
          onOpenSheet={sheetId => goSheet(project.id, sheetId)}
        />
      )}

      {route.page === 'folder' && project && folder && (
        <FolderView
          store={store}
          project={project}
          folder={folder}
          onBack={() => goFolderBack(route.pid, route.fid)}
          onOpenFolder={fid => goFolder(route.pid, fid)}
          onOpenEditor={() => goEditor(route.pid, route.fid)}
          onEditPayroll={payroll => goEditorWithPayroll(route.pid, route.fid, payroll)}
        />
      )}

      {route.page === 'editor' && project && folder && (
        <Editor
          key={route.editPayroll?.id || 'new'}
          store={store}
          project={project}
          folder={folder}
          editPayroll={route.editPayroll || null}
          onBack={() => goFolder(route.pid, route.fid)}
        />
      )}

      {route.page === 'sheet' && project && (() => {
        const sheet = (project.sheets || []).find(s => s.id === route.sheetId)
        return sheet ? (
          <SheetEditor
            store={store}
            project={project}
            sheet={sheet}
            onBack={() => goProject(route.pid)}
          />
        ) : null
      })()}
    </>
  )
}
