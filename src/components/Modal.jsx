import { useEffect } from 'react'
import s from './Modal.module.css'

export default function Modal({ title, children, onClose, wide }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={s.bg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${s.box} ${wide ? s.wide : ''}`}>
        <h3 className={s.title}>{title}</h3>
        {children}
      </div>
    </div>
  )
}
