import { useState } from 'react'
import FoldersTab from './tabs/FoldersTab'
import ColumnsTab from './tabs/ColumnsTab'
import ItemsTab   from './tabs/ItemsTab'
import s from './ProjectPage.module.css'

const TABS = [
  { id: 'folders', label: '📁 Folders' },
  { id: 'columns', label: '📊 Columns' },
  { id: 'items',   label: '💰 Payroll Items' },
]

export default function ProjectPage({ store, project, onBack, onOpenFolder }) {
  const [tab, setTab] = useState('folders')

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>← Projects</button>
        <div className={s.projectName}>{project.name}</div>
      </header>

      <div className={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${s.tab} ${tab === t.id ? s.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className={s.main}>
        {tab === 'folders' && (
          <FoldersTab
            store={store}
            project={project}
            onOpenFolder={fid => onOpenFolder(fid)}
          />
        )}
        {tab === 'columns' && (
          <ColumnsTab store={store} project={project} />
        )}
        {tab === 'items' && (
          <ItemsTab store={store} project={project} />
        )}
      </main>
    </div>
  )
}
