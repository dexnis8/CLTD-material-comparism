import { Button } from './common'

const destinations = [['setup', 'Comparison setup'], ['materials', 'Materials'], ['reference', 'Reference data'], ['settings', 'Settings']]

export default function ErrorNotice({ errors, onNavigate, onDismiss }) {
  // Each validation failure remains separate, including errors propagated from imports.
  const issues = [...new Set(errors.flatMap(error => String(error).split('\n')).filter(Boolean))]
  return <section className="notice error validation-errors" role="alert" aria-label="Issues to resolve">
    <div className="error-content"><strong>Resolve {issues.length} issue{issues.length === 1 ? '' : 's'} to continue</strong>
      <ol>{issues.map((issue, index) => {
        const split = issue.indexOf('To fix:')
        return <li key={index}><p>{split < 0 ? issue : issue.slice(0, split)}</p>{split >= 0 && <p><strong>How to resolve:</strong> {issue.slice(split + 7).trim()}</p>}</li>
      })}</ol>
      {onNavigate && <div className="action-row">{destinations.filter(([, label]) => issues.some(issue => issue.includes(label))).map(([id, label]) => <Button key={id} onClick={() => onNavigate(id)}>Open {label}</Button>)}</div>}
    </div>
    {onDismiss && <Button variant="ghost" aria-label="Dismiss errors" onClick={onDismiss}>Dismiss</Button>}
  </section>
}
