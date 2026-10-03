import { useEffect, useRef, useId } from 'react'
import { X, ArrowUpRight } from 'lucide-react'
export function Button({ children, variant = '', className = '', ...props }) { return <button className={`button ${variant} ${className}`} {...props}>{children}</button> }
export function Field({ label, unit, hint, error, children, ...props }) {
  const id = useId()
  return <div className="field"><label htmlFor={id}>{label}{unit && <span className="unit">{unit}</span>}</label>{children ? children(id) : <input id={id} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${id}-help` : undefined} {...props} />}{(hint || error) && <small id={`${id}-help`} className={error ? 'field-error' : ''}>{error || hint}</small>}</div>
}
export function Segmented({ label, options, value, onChange }) {
  return <fieldset className="field"><legend>{label}</legend><div className="segmented">{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} className={value === option.value ? 'selected' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></fieldset>
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal-head"><h2 id={titleId}>{title}</h2><Button variant="icon-button ghost" aria-label="Close dialog" onClick={onClose}><X size={19} /></Button></div>{children}</dialog>
}
export function SectionTitle({ eyebrow, title, children }) { return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{children}</div> }
export function EmptyState({ title, text, action }) { return <div className="empty-state"><ArrowUpRight size={28} /><h2>{title}</h2><p>{text}</p>{action}</div> }
