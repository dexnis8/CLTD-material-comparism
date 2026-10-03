import { useMemo, useState, useRef } from 'react'
import { Upload, Download, Database, Search, CheckCircle2, Trash2 } from 'lucide-react'
import { Button, Modal, SectionTitle } from '../../components/common'
import ErrorNotice from '../../components/ErrorNotice'
import { operationError } from '../../services/errors'
import { referenceRows } from '../../domain/reference'
import { validateInputs } from '../../domain/calculations'
import { demoDataset } from '../../data/demo'
import { download, importDataset, datasetCSV } from '../../services/files'

export default function ReferenceData({ project, onChange, onError }) {
  const [search, setSearch] = useState('')
  const [table, setTable] = useState('All')
  const [page, setPage] = useState(0)
  const [removing, setRemoving] = useState(null)
  const [pending, setPending] = useState(null)
  const file = useRef(null)
  const dataset = project.datasets.find(d => d.metadata.id === project.activeDatasetId)
  const rows = useMemo(() => referenceRows(dataset), [dataset])
  const filtered = rows.filter(row => (table === 'All' || row.table === table) && Object.values(row).join(' ').toLowerCase().includes(search.toLowerCase()))
  const coverage = validateInputs(project.materials, project.shared, dataset)
  const activate = data => { onChange({ ...project, datasets: [...project.datasets.filter(d => d.metadata.id !== data.metadata.id), data], activeDatasetId: data.metadata.id }); setPending(null) }
  const importFile = async event => {
    const selected = event.target.files[0]
    if (!selected) return
    try {
      if (selected.size > 10_000_000) throw new Error('This reference file exceeds the 10 MB limit. To fix: keep a backup, then create a smaller dataset containing the CLTD and LM combinations needed for your groups, site and design period, keeping the source metadata. Save as JSON or CSV and retry Reference data > Import dataset.')
      const incoming = importDataset(await selected.text(), selected.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json')
      if (incoming.metadata.id === demoDataset.metadata.id) incoming.metadata.id = crypto.randomUUID()
      incoming.metadata.importedAt = new Date().toISOString()
      if (project.datasets.some(d => d.metadata.id === incoming.metadata.id)) setPending(incoming)
      else activate(incoming)
    } catch (error) { onError(operationError(`Import of reference file ${selected.name}`, error, 'The active dataset has not been replaced. Check that the file is accessible on this device, follow the details below, then retry Reference data > Import dataset.')) }
    event.target.value = ''
  }
  return <div className="space-y-6"><div className="page-intro"><div><h2>Know what’s behind the numbers.</h2><p>Import and inspect your CLTD and latitude/month reference tables.</p></div><Button variant="primary" onClick={() => file.current.click()}><Upload size={17} /> Import dataset</Button><input type="file" ref={file} accept=".json,.csv" className="hidden" aria-label="Import reference dataset" onChange={importFile} /></div>
    <div className="reference-layout"><section className="panel"><SectionTitle title="Reference library" /><div className="dataset-list">{project.datasets.map(d => <div className={`dataset-item ${d.metadata.id === dataset.metadata.id ? 'active' : ''}`} key={d.metadata.id}><button onClick={() => { onChange({ ...project, activeDatasetId: d.metadata.id }); setPage(0) }}><Database size={19} /><span><strong>{d.metadata.name}</strong><small>{d.metadata.unitSystem} · v{d.metadata.version} · {d.metadata.isDemo ? 'Demonstration' : 'User supplied · verify source'}</small></span>{d.metadata.id === dataset.metadata.id && <CheckCircle2 size={17} />}</button>{d.metadata.id !== demoDataset.metadata.id && <Button variant="icon-button ghost danger-text" aria-label={`Remove ${d.metadata.name}`} onClick={() => setRemoving(d)}><Trash2 size={16} /></Button>}</div>)}</div><div className="template-box"><h3>Start with a template</h3><p>Templates contain clearly labelled synthetic examples. Replace the values and source metadata with your verified tables.</p><Button onClick={() => download('reference-template.json', JSON.stringify(demoDataset, null, 2))}><Download size={15} /> JSON template</Button><Button onClick={() => download('reference-template.csv', datasetCSV(demoDataset), 'text/csv')}><Download size={15} /> CSV template</Button></div></section>
    <section className="panel"><SectionTitle title="Active dataset metadata"><span className="tag">{dataset.metadata.unitSystem}</span></SectionTitle><dl className="metadata-grid">{Object.entries(dataset.metadata).map(([key, value]) => <div key={key}><dt>{({ importedAt: 'Imported at', unitSystem: 'Unit system', isDemo: 'Demonstration data' })[key] || key}</dt><dd>{String(value)}</dd></div>)}</dl><div className={`coverage ${coverage.length ? 'warning' : 'success'}`}><strong>{coverage.length ? `${coverage.length} blocking issue${coverage.length === 1 ? '' : 's'} for this scenario` : 'All required lookups are available'}</strong><p>Coverage is checked against your current materials, shared conditions and selected hours.</p>{coverage.length > 0 && <details><summary>Inspect missing combinations and input issues</summary><ErrorNotice errors={coverage} /></details>}</div></section></div>
    <section className="panel"><SectionTitle title="Reference table inspector"><Button variant="ghost" onClick={() => download('active-reference.json', JSON.stringify(dataset, null, 2))}><Download size={16} /> Dataset JSON</Button></SectionTitle><div className="table-toolbar"><div className="search-input"><Search size={17} /><input aria-label="Search reference rows" placeholder="Search group, orientation, hour or value…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></div><select aria-label="Reference table type" value={table} onChange={e => { setTable(e.target.value); setPage(0) }}><option>All</option><option>CLTD</option><option>LM</option></select><span className="helper">{filtered.length} entries</span></div><div className="table-scroll"><table><thead><tr>{['Table', 'Group', 'Surface', 'Orientation', 'Hour', 'Latitude (°)', 'Month', `Value (${dataset.metadata.unitSystem === 'SI' ? 'K' : '°F'} difference)`].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.slice(page * 30, page * 30 + 30).map(row => <tr key={[row.table, row.group, row.surface, row.orientation, row.hour, row.latitude, row.month].join('/')} >{Object.values(row).map((value, i) => <td key={i}>{value === '' ? '—' : value}</td>)}</tr>)}</tbody></table></div>{!filtered.length && <p className="p-6">No matching reference entries.</p>}<div className="pagination"><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / 30))}</span><Button disabled={(page + 1) * 30 >= filtered.length} onClick={() => setPage(page + 1)}>Next</Button></div></section>
    <section className="assumptions"><h3>Reference data contract</h3><p>JSON uses cltd[group][surface][orientation][hour] and lm[latitude][month][orientation]. CSV combines CLTD and LM rows with repeated metadata; download the template for the exact columns. Hours are 0–23, months 1–12, latitude −90° to 90°, and groups A–G. Roof orientation must be Horizontal.</p><p>Partial tables are allowed, but every lookup needed by a calculation must exist. SI and IP datasets are used strictly in their own units. No interpolation or extrapolation is performed. Importing a source does not verify its authority; explicitly declare isDemo and retain accurate source, edition, version and notes.</p></section>
    {removing && <Modal title="Remove imported dataset?" onClose={() => setRemoving(null)}><div className="modal-body"><p>Remove {removing.metadata.name} from the library? Previous results retain their source snapshot.</p></div><div className="modal-footer"><Button onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" onClick={() => { onChange({ ...project, datasets: project.datasets.filter(d => d.metadata.id !== removing.metadata.id), activeDatasetId: project.activeDatasetId === removing.metadata.id ? demoDataset.metadata.id : project.activeDatasetId }); setRemoving(null); setPage(0) }}>Remove dataset</Button></div></Modal>}
    {pending && <Modal title="Replace existing dataset?" onClose={() => setPending(null)}><div className="modal-body"><p>A dataset with ID {pending.metadata.id} already exists. Replace it with the imported version and make it active?</p></div><div className="modal-footer"><Button onClick={() => setPending(null)}>Cancel</Button><Button variant="primary" onClick={() => activate(pending)}>Replace dataset</Button></div></Modal>}
  </div>
}
