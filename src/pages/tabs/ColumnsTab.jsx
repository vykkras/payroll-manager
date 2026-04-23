import { useState } from 'react'
import { uid } from '../../store/useStore'
import Modal from '../../components/Modal'
import s from './ColumnsTab.module.css'

export default function ColumnsTab({ store, project }) {
  const columns = project.columns || []
  const [input,        setInput]        = useState('')
  const [editCol,      setEditCol]      = useState(null)
  const [editName,     setEditName]     = useState('')
  const [delId,        setDelId]        = useState(null)
  const [dragIndex,    setDragIndex]    = useState(null)
  const [dragOverIdx,  setDragOverIdx]  = useState(null)

  function handleDragStart(i) { setDragIndex(i) }
  function handleDragOver(e, i) { e.preventDefault(); setDragOverIdx(i) }
  function handleDrop(dropIndex) {
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDragOverIdx(null); return }
    const next = [...columns]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    store.updateProjectColumns(project.id, next)
    setDragIndex(null)
    setDragOverIdx(null)
  }
  function handleDragEnd() { setDragIndex(null); setDragOverIdx(null) }

  function handleAdd() {
    const v = input.trim()
    if (!v) return
    store.updateProjectColumns(project.id, [...columns, { id: uid(), name: v }])
    setInput('')
  }

  function handleSaveEdit() {
    if (!editName.trim()) return
    store.updateProjectColumns(project.id, columns.map(c => c.id === editCol.id ? { ...c, name: editName.trim() } : c))
    setEditCol(null)
  }

  function toggleFilter(id) {
    store.updateProjectColumns(project.id, columns.map(c => c.id === id ? { ...c, filter: !c.filter } : c))
  }

  function toggleSum(id) {
    store.updateProjectColumns(project.id, columns.map(c => c.id === id ? { ...c, sum: !c.sum } : c))
  }

  function handleDelete(id) {
    store.updateProjectColumns(project.id, columns.filter(c => c.id !== id))
    setDelId(null)
  }

  return (
    <div className={s.wrap}>
      <div className={s.ph}>
        <div>
          <h2>Data Columns</h2>
          <p>Define the columns that appear in the editor's data table</p>
        </div>
      </div>

      <div className={s.addRow}>
        <input
          className={s.addInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Column name (e.g. FEEDER, CREW, DATE)"
        />
        <button className={s.btnAdd} onClick={handleAdd} disabled={!input.trim()}>Add Column</button>
      </div>

      {columns.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>📊</span>
          <h3>No columns yet</h3>
          <p>Add column names to set up your data table</p>
        </div>
      ) : (
        <div className={s.list}>
          {columns.map((col, i) => (
            <div
              key={col.id}
              className={`${s.row} ${dragIndex === i ? s.rowDragging : ''} ${dragOverIdx === i && dragIndex !== i ? s.rowDragOver : ''}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
            >
              <span className={s.grip}>⠿</span>
              <span className={s.num}>{i + 1}</span>
              <span className={s.colName}>{col.name}</span>
              <button
                className={`${s.filterBtn} ${col.filter ? s.filterBtnOn : ''}`}
                onClick={() => toggleFilter(col.id)}
                title="Toggle filter for this column"
              >{col.filter ? '⧩ Filter ON' : '⧩ Filter'}</button>
              <button
                className={`${s.filterBtn} ${col.sum ? s.filterBtnOn : ''}`}
                onClick={() => toggleSum(col.id)}
                title="Toggle sum for this column"
              >{col.sum ? '∑ Sum ON' : '∑ Sum'}</button>
              <div className={s.rowActions}>
                <button className={s.editBtn} onClick={() => { setEditCol(col); setEditName(col.name) }}>✏ Rename</button>
                <button className={s.delBtn} onClick={() => setDelId(col.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editCol && (
        <Modal title="Rename Column" onClose={() => setEditCol(null)}>
          <div className={s.field}>
            <label>Column Name</label>
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
            />
          </div>
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={() => setEditCol(null)}>Cancel</button>
            <button className={s.btnOk} onClick={handleSaveEdit} disabled={!editName.trim()}>Save</button>
          </div>
        </Modal>
      )}

      {delId && (
        <Modal title="Delete column?" onClose={() => setDelId(null)}>
          <p className={s.delMsg}>Existing row data for this column will remain stored but won't be shown.</p>
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={() => setDelId(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => handleDelete(delId)}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
