import { useState } from 'react'
import { treePath, uid } from '../store/useStore'
import Modal from '../components/Modal'
import PrintView from '../components/PrintView'
import s from './FolderView.module.css'

function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const POS = [
  { key: 'primero', label: 'Primero', color: '#3949ab', bg: '#e8eaf6', idx: '1' },
  { key: 'segundo', label: 'Segundo', color: '#2e7d32', bg: '#e8f5e9', idx: '2' },
  { key: 'tercero', label: 'Tercero', color: '#e65100', bg: '#fff3e0', idx: '3' },
]

function fmtPct(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

export default function FolderView({ store, project, folder, onBack, onOpenFolder, onOpenEditor, onEditPayroll }) {
  const [showNewFolder, setShowNewFolder]   = useState(false)
  const [folderName, setFolderName]         = useState('')
  const [delFolder,  setDelFolder]          = useState(null)
  const [delPayroll, setDelPayroll]         = useState(null)
  const [printPayroll, setPrintPayroll]     = useState(null)
  const [printPos,     setPrintPos]         = useState('primero')

  // Summary
  const [showSummary, setShowSummary] = useState(false)
  const [localSummary, setLocalSummary] = useState(folder.summary || null)
  const [incomeLines, setIncomeLines] = useState(() => {
    const saved = folder.summary?.incomeLines
    return saved?.length ? saved : [{ id: uid(), label: '', amount: '' }]
  })

  const subFolders = folder.folders  || []
  const payrolls   = folder.payrolls || []
  const breadcrumb = treePath(project.folders || [], folder.id) || []

  // Compute payroll total across all saved payrolls in this folder
  const payrollTotal = payrolls.reduce((sum, pr) =>
    sum + (parseFloat(pr.total1) || 0) + (parseFloat(pr.total2) || 0) + (parseFloat(pr.total3) || 0), 0)

  const savedIncomeLines = (localSummary ?? folder.summary)?.incomeLines || []
  const incomeTotal = savedIncomeLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
  const pct = incomeTotal > 0 ? (payrollTotal / incomeTotal) * 100 : null
  const hasSummary = savedIncomeLines.length > 0 && savedIncomeLines.some(l => l.amount)

  function openSummary() {
    const saved = folder.summary?.incomeLines
    setIncomeLines(saved?.length ? saved.map(l => ({ ...l })) : [{ id: uid(), label: '', amount: '' }])
    setShowSummary(true)
  }

  function handleSaveSummary() {
    const filtered = incomeLines.filter(l => l.label.trim() || l.amount)
    store.saveFolderSummary(project.id, folder.id, filtered)
    setLocalSummary({ incomeLines: filtered })
    setShowSummary(false)
  }

  function updateLine(id, field, value) {
    setIncomeLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  function addLine() {
    setIncomeLines(ls => [...ls, { id: uid(), label: '', amount: '' }])
  }

  function removeLine(id) {
    setIncomeLines(ls => ls.length > 1 ? ls.filter(l => l.id !== id) : ls)
  }

  function handleCreateFolder() {
    if (!folderName.trim()) return
    store.createFolder(project.id, folder.id, folderName.trim())
    setFolderName('')
    setShowNewFolder(false)
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>←</button>
        <div className={s.breadcrumb}>
          <span className={s.projName}>{project.name}</span>
          {breadcrumb.map(f => (
            <span key={f.id} className={s.bcItem}>
              <span className={s.sep}>/</span>
              <span>{f.name}</span>
            </span>
          ))}
        </div>
        <button className={s.btnSummary} onClick={openSummary}>Summary</button>
        <button className={s.btnEditor} onClick={onOpenEditor}>Open Editor ✏</button>
      </header>

      <main className={s.main}>
        <div className={s.ph}>
          <div>
            <h2>{folder.name}</h2>
            <p>{subFolders.length} folder{subFolders.length !== 1 ? 's' : ''} · {payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''}</p>
          </div>
          <button className={s.btnAdd} onClick={() => setShowNewFolder(true)}>+ New Folder</button>
        </div>

        {hasSummary && (
          <div className={s.summaryPanel}>
            <div className={s.summaryPanelTitle}>Week Summary</div>
            <div className={s.summaryGrid}>
              <div className={s.summaryBlock}>
                <div className={s.summaryBlockLabel}>Total Payroll</div>
                <div className={s.summaryBlockVal}>{fmtMoney(payrollTotal)}</div>
                <div className={s.summaryBlockSub}>{payrolls.length} payroll{payrolls.length !== 1 ? 's' : ''}</div>
              </div>
              <div className={s.summaryBlock}>
                <div className={s.summaryBlockLabel}>Total Income</div>
                <div className={s.summaryBlockVal}>{fmtMoney(incomeTotal)}</div>
                <div className={s.summaryBlockSub}>
                  {savedIncomeLines.filter(l => l.amount).map(l => (
                    <span key={l.id} className={s.summaryLine}>
                      {l.label ? `${l.label}: ` : ''}{fmtMoney(l.amount)}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`${s.summaryBlock} ${s.summaryBlockPct}`}>
                <div className={s.summaryBlockLabel}>Payroll %</div>
                <div className={s.summaryBlockValPct} style={{ color: pct > 40 ? '#c0392b' : pct > 30 ? '#e65100' : '#2e7d32' }}>
                  {pct !== null ? fmtPct(pct) : '—'}
                </div>
                <div className={s.summaryBlockSub}>of income</div>
              </div>
            </div>
            <button className={s.summaryEditBtn} onClick={openSummary}>Edit</button>
          </div>
        )}

        {subFolders.length > 0 && (
          <div className={s.section}>
            <div className={s.sectionLabel}>Folders</div>
            <div className={s.grid}>
              {subFolders.map(f => (
                <div key={f.id} className={s.folderCard} onClick={() => onOpenFolder(f.id)}>
                  <span className={s.cardIcon}>📁</span>
                  <div className={s.cardName}>{f.name}</div>
                  <div className={s.cardMeta}>
                    {(f.folders || []).length} folder{(f.folders || []).length !== 1 ? 's' : ''} · {(f.payrolls || []).length} payroll{(f.payrolls || []).length !== 1 ? 's' : ''} · {relDate(f.createdAt)}
                  </div>
                  <button className={s.delBtn} onClick={e => { e.stopPropagation(); setDelFolder(f.id) }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {payrolls.length > 0 && (
          <div className={s.section}>
            <div className={s.sectionLabel}>Payrolls</div>
            <div className={s.payrollList}>
              {payrolls.map(pr => (
                <div key={pr.id} className={s.payrollCard} onClick={() => onEditPayroll(pr)}>
                  {/* Period + actions */}
                  <div className={s.payrollCardHeader}>
                    <span className={s.payrollPeriod}>{pr.period || 'No period'}</span>
                    <div className={s.payrollCardActions}>
                      <button className={s.printPayrollBtn} onClick={e => {
                        e.stopPropagation()
                        setPrintPayroll(pr)
                        setPrintPos(pr.position || 'primero')
                      }}>🖨</button>
                      <button className={s.delBtn} onClick={e => { e.stopPropagation(); setDelPayroll(pr.id) }}>✕</button>
                    </div>
                  </div>
                  {/* Per-position rows */}
                  <div className={s.payrollPositions}>
                    {POS.map(p => {
                      const crew  = pr.crewNames?.[p.key]
                      const total = pr[`total${p.idx}`]
                      if (!crew && !total) return null
                      return (
                        <div key={p.key} className={s.payrollPosRow}>
                          <span className={s.posBadge} style={{ color: p.color, background: p.bg }}>{p.label}</span>
                          <span className={s.payrollCrew}>{crew || '—'}</span>
                          <span className={s.payrollTotal} style={{ color: p.color }}>{fmtMoney(total)}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className={s.payrollCardHint}>Click to edit</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subFolders.length === 0 && payrolls.length === 0 && (
          <div className={s.empty}>
            <span className={s.emptyIcon}>📁</span>
            <h3>This folder is empty</h3>
            <p>Create sub-folders to organise your work, or open the editor to add payrolls</p>
            <div className={s.emptyBtns}>
              <button className={s.btnAdd} onClick={() => setShowNewFolder(true)}>+ New Folder</button>
              <button className={s.btnEditorAlt} onClick={onOpenEditor}>Open Editor ✏</button>
            </div>
          </div>
        )}
      </main>

      {showNewFolder && (
        <Modal title="New Folder" onClose={() => { setShowNewFolder(false); setFolderName('') }}>
          <div className={s.field}>
            <label>Folder Name</label>
            <input
              autoFocus
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              placeholder="e.g. Week of Apr 7, East Dallas"
            />
          </div>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => { setShowNewFolder(false); setFolderName('') }}>Cancel</button>
            <button className={s.btnOk} onClick={handleCreateFolder} disabled={!folderName.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {delFolder && (
        <Modal title="Delete folder?" onClose={() => setDelFolder(null)}>
          <p className={s.delMsg}>This will permanently delete the folder and all its contents.</p>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setDelFolder(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deleteFolder(project.id, delFolder); setDelFolder(null) }}>Delete</button>
          </div>
        </Modal>
      )}

      {delPayroll && (
        <Modal title="Delete payroll?" onClose={() => setDelPayroll(null)}>
          <p className={s.delMsg}>This payroll will be permanently removed.</p>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setDelPayroll(null)}>Cancel</button>
            <button className={s.btnDel} onClick={() => { store.deletePayroll(project.id, folder.id, delPayroll); setDelPayroll(null) }}>Delete</button>
          </div>
        </Modal>
      )}

      {printPayroll && (
        <Modal title="Print — select position" onClose={() => setPrintPayroll(null)}>
          <div className={s.printPosRow}>
            {POS.map(p => (
              <button
                key={p.key}
                className={`${s.printPosBtn} ${printPos === p.key ? s.printPosBtnOn : ''}`}
                style={printPos === p.key ? { background: p.color, borderColor: p.color } : {}}
                onClick={() => setPrintPos(p.key)}
              >{p.label}</button>
            ))}
          </div>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setPrintPayroll(null)}>Cancel</button>
            <button className={s.btnOk} onClick={() => {
              // PrintView will mount — close this modal
              setPrintPayroll({ ...printPayroll, _printMode: true })
            }}>Open Print Preview</button>
          </div>
        </Modal>
      )}

      {showSummary && (
        <Modal title="Week Summary — Income" onClose={() => setShowSummary(false)}>
          <p className={s.summaryModalHint}>Enter what you were supposed to get paid this week. Add as many lines as needed.</p>
          <div className={s.summaryLines}>
            {incomeLines.map((line, i) => (
              <div key={line.id} className={s.summaryLineRow}>
                <input
                  className={s.summaryLineLabel}
                  value={line.label}
                  onChange={e => updateLine(line.id, 'label', e.target.value)}
                  placeholder={`Line ${i + 1} (e.g. Invoice #12)`}
                  autoFocus={i === 0}
                />
                <input
                  className={s.summaryLineAmount}
                  type="number"
                  value={line.amount}
                  onChange={e => updateLine(line.id, 'amount', e.target.value)}
                  placeholder="0.00"
                />
                <button className={s.summaryLineRemove} onClick={() => removeLine(line.id)} disabled={incomeLines.length === 1}>✕</button>
              </div>
            ))}
          </div>
          <button className={s.summaryAddLine} onClick={addLine}>+ Add line</button>
          <div className={s.footerBtns}>
            <button className={s.btnCancel} onClick={() => setShowSummary(false)}>Cancel</button>
            <button className={s.btnOk} onClick={handleSaveSummary}>Done</button>
          </div>
        </Modal>
      )}

      {printPayroll?._printMode && (
        <PrintView
          project={project}
          folder={folder}
          position={printPos}
          payroll={printPayroll}
          onClose={() => setPrintPayroll(null)}
        />
      )}
    </div>
  )
}
