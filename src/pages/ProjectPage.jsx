import { useState } from 'react'
import FoldersTab from './tabs/FoldersTab'
import ColumnsTab from './tabs/ColumnsTab'
import ItemsTab   from './tabs/ItemsTab'
import SheetsTab  from './tabs/SheetsTab'
import { isSelmaProject } from '../data/templates'
import s from './ProjectPage.module.css'

const BASE_TABS = [
  { id: 'folders', label: '📁 Folders' },
  { id: 'columns', label: '📊 Columns' },
  { id: 'items',   label: '💰 Payroll Items' },
]

export default function ProjectPage({ store, project, onBack, onOpenFolder, onOpenSheet }) {
  const [tab, setTab] = useState('folders')

  const tabs = isSelmaProject(project)
    ? [...BASE_TABS, { id: 'sheets', label: '📂 Sheets' }]
    : BASE_TABS

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>DC <span>Cable</span></div>
        <button className={s.backBtn} onClick={onBack}>← Projects</button>
        <div className={s.projectName}>{project.name}</div>
      </header>

      <div className={s.tabs}>
        {tabs.map(t => (
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
        {tab === 'sheets' && (
          <SheetsTab
            store={store}
            project={project}
            onOpenSheet={sheetId => onOpenSheet(sheetId)}
          />
        )}
      </main>
    </div>
  )
}
