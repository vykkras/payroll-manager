import { useState } from 'react'
import PayrollBuilder from '../components/PayrollBuilder'
import Modal from '../components/Modal'
import s from './WeekView.module.css'

const POS_LABELS = { primero: 'Primero', segundo: 'Segundo', tercero: 'Tercero' }
const POS_CLASS  = { primero: s.pos1,    segundo: s.pos2,    tercero: s.pos3    }

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WeekView({ store, project, folder, week, onBack }) {
  const [building, setBuilding]   = useState(false)
  const [editing,  setEditing]    = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  function handleSave(payroll) {
    store.savePayroll(project.id, folder.id, week.id, payroll)
    setBuilding(false)
    setEditing(null)
  }

  const payrolls = week.payrolls || []

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>← {folder.name}</button>
        <div className={s.breadcrumb}>
          <span className={s.projName}>{project.name}</span>
          <span className={s.sep}>/</span>
          <span className={s.projName}>{folder.name}</span>
          <span className={s.sep}>/</span>
          <span>{week.name}</span>
        </div>
      </header>

      <main className={s.main}>
        <div className={s.ph}>
          <div>
            <h2>{week.name}</h2>
            <p>{payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''}</p>
          </div>
          <button className={s.btnAdd} onClick={() => setBuilding(true)}>+ New Payroll</button>
        </div>

        {payrolls.length === 0 ? (
          <div className={s.empty}>
            <span className={s.emptyIcon}>💵</span>
            <h3>No payrolls yet</h3>
            <p>Create the first payroll for this week</p>
          </div>
        ) : (
          <div className={s.list}>
            {payrolls.map(pr => {
              const posIdx  = { primero: '1', segundo: '2', tercero: '3' }[pr.position]
              const total   = pr[`total${posIdx}`] ?? pr.total ?? 0
              const crewName = pr.crewNames?.[pr.position] || pr.crewName || '—'
              return (
                <div key={pr.id} className={s.row}>
                  <span className={`${s.posBadge} ${POS_CLASS[pr.position] || s.pos1}`}>
                    {POS_LABELS[pr.position] || pr.position}
                  </span>
                  <div className={s.info}>
                    <div className={s.crew}>{crewName}</div>
                    <div className={s.meta}>{pr.period || 'No period'} · {relDate(pr.createdAt)}</div>
                  </div>
                  {pr.totalDiscounts > 0 && (
                    <div className={s.discountNote}>−{fmtMoney(pr.totalDiscounts)}</div>
                  )}
                  <div className={s.total}>{fmtMoney(total)}</div>
                  <button className={s.editBtn} onClick={() => setEditing(pr)}>✏</button>
                  <button className={s.delBtn} onClick={() => setDelTarget(pr.id)}>✕</button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {building && (
        <Modal title="New Payroll" onClose={() => setBuilding(false)} wide>
          <PayrollBuilder
            config={project.config}
            defaultPeriod={week.name}
            onSave={handleSave}
            onClose={() => setBuilding(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Payroll" onClose={() => setEditing(null)} wide>
          <PayrollBuilder
            config={project.config}
            defaultPeriod={week.name}
            editPayroll={editing}
            onSave={handleSave}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}

      {delTarget && (
        <Modal title="Delete payroll?" onClose={() => setDelTarget(null)}>
          <p className={s.delMsg}>This payroll will be permanently deleted.</p>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setDelTarget(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => {
              store.deletePayroll(project.id, folder.id, week.id, delTarget)
              setDelTarget(null)
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
