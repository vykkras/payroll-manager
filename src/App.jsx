import { useState } from 'react'
import { useStore, getData, treeFind, treeParentId } from './store/useStore'
import Home        from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import FolderView  from './pages/FolderView'
import Editor      from './pages/Editor'
import './index.css'

export default function App() {
  const store = useStore()
  const [route, setRoute] = useState({ page: 'home', pid: null, fid: null })

  const goHome    = ()         => setRoute({ page: 'home',    pid: null, fid: null })
  const goProject = pid        => setRoute({ page: 'project', pid,       fid: null })
  const goFolder  = (pid, fid) => setRoute({ page: 'folder',  pid,       fid })
  const goEditor  = (pid, fid) => setRoute({ page: 'editor',  pid,       fid })

  function goEditorWithPayroll(pid, fid, payroll) {
    localStorage.setItem(`payroll_draft_${pid}_${fid}`, JSON.stringify(payroll))
    setRoute({ page: 'editor', pid, fid })
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
      {route.page === 'home' && (
        <Home store={store} onOpenProject={goProject} />
      )}

      {route.page === 'project' && project && (
        <ProjectPage
          store={store}
          project={project}
          onBack={goHome}
          onOpenFolder={fid => goFolder(project.id, fid)}
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
          store={store}
          project={project}
          folder={folder}
          onBack={() => goFolder(route.pid, route.fid)}
        />
      )}
    </>
  )
}
