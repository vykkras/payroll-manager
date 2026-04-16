import { useState } from 'react'
import Modal from '../../components/Modal'
import s from './FoldersTab.module.css'

function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function FoldersTab({ store, project, onOpenFolder }) {
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [delTarget, setDelTarget] = useState(null)

  function handleCreate() {
    if (!name.trim()) return
    store.createFolder(project.id, null, name.trim())
    setName('')
    setShowModal(false)
  }

  const folders = project.folders || []

  return (
    <div className={s.wrap}>
      <div className={s.ph}>
        <div>
          <h2>Folders</h2>
          <p>Organize payrolls by week, area, or any grouping</p>
        </div>
        <button className={s.btnAdd} onClick={() => setShowModal(true)}>+ New Folder</button>
      </div>

      {folders.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>📁</span>
          <h3>No folders yet</h3>
          <p>Create a folder to start organizing payrolls</p>
        </div>
      ) : (
        <div className={s.grid}>
          {folders.map(f => (
            <div key={f.id} className={s.card} onClick={() => onOpenFolder(f.id)}>
              <span className={s.icon}>📁</span>
              <div className={s.cardName}>{f.name}</div>
              <div className={s.cardMeta}>
                {(f.folders || []).length} folder{(f.folders || []).length !== 1 ? 's' : ''} · {(f.payrolls || []).length} payroll{(f.payrolls || []).length !== 1 ? 's' : ''} · {relDate(f.createdAt)}
              </div>
              <button
                className={s.delBtn}
                onClick={e => { e.stopPropagation(); setDelTarget(f.id) }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="New Folder" onClose={() => setShowModal(false)}>
          <div className={s.field}>
            <label>Folder Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Week of Apr 7, East Dallas 3"
            />
          </div>
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
            <button className={s.btnOk} onClick={handleCreate} disabled={!name.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {delTarget && (
        <Modal title="Delete folder?" onClose={() => setDelTarget(null)}>
          <p className={s.delMsg}>This will permanently delete the folder and all its weeks and payrolls.</p>
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={() => setDelTarget(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deleteFolder(project.id, delTarget); setDelTarget(null) }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
