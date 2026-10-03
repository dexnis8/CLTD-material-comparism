import { useState, useRef, useEffect } from 'react'
import { Layers3, SlidersHorizontal, ChartNoAxesCombined, Database, FileText, Settings2, ChevronRight, Check, Menu, ArrowUpRight, Play, Download, Upload, RotateCcw, AlertTriangle, BookOpen, Plus } from 'lucide-react'
import { APP_NAME, DEMO_WARNING, STORAGE_KEY } from './app/config'
import { useProject } from './hooks/useProject'
import { compareMaterials, comparisonFingerprint, validateInputs } from './domain/calculations'
import { changeProjectUnits } from './domain/units'
import { createProject } from './data/demo'
import { download, readProject } from './services/files'
import { Button, Field, Modal } from './components/common'
import SharedConditions from './features/comparison/SharedConditions'
import Materials from './features/materials/Materials'
import Results from './features/comparison/Results'
import ReferenceData from './features/reference-data/ReferenceData'
import UserGuide from './features/guide/UserGuide'
import ErrorNotice from './components/ErrorNotice'
import { operationError } from './services/errors'
import './App.css'

const navigation = [
  { id: 'setup', label: 'Comparison setup', icon: SlidersHorizontal, number: '01' },
  { id: 'materials', label: 'Materials', icon: Layers3, number: '02' },
  { id: 'results', label: 'Results', icon: ChartNoAxesCombined, number: '03' },
  { id: 'reference', label: 'Reference data', icon: Database },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'guide', label: 'User guide', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]
export default function App() {
  const { project, setProject, saveStatus, storageError, resumeSaving } = useProject()
  const [page, setPage] = useState('setup')
  const [mobileNav, setMobileNav] = useState(false)
  const [errors, setErrors] = useState([])
  useEffect(() => {
    const handleError = event => {
      setErrors([operationError('The last action', event.error || event.reason || event.message, 'Export a backup in Settings > Export project JSON, then retry the action. If it repeats, reload the app and share the details below and your steps with the app maintainer. Do not clear browser storage.')])
      window.scrollTo(0, 0)
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleError)
    return () => { window.removeEventListener('error', handleError); window.removeEventListener('unhandledrejection', handleError) }
  }, [])
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [showMethod, setShowMethod] = useState(false)
  const importRef = useRef(null)
  const dataset = project.datasets.find(d => d.metadata.id === project.activeDatasetId)
  const stale = Boolean(project.calculation && project.calculation.fingerprint !== comparisonFingerprint(project.materials, project.shared, dataset))
  const navigate = id => { setPage(id); setMobileNav(false); setErrors([]); setMessage(''); window.scrollTo(0, 0) }
  const run = () => {
    try {
      const issues = validateInputs(project.materials, project.shared, dataset)
      setErrors(issues); setMessage('')
      if (issues.length) { window.scrollTo(0, 0); return }
      setProject({ ...project, calculation: compareMaterials(project.materials, project.shared, dataset) })
      setPage('results'); window.scrollTo(0, 0)
    } catch (error) {
      setErrors([operationError('Comparison', error, 'Follow the input or reference-data guidance below, then Run comparison again. If no field is identified, export a project backup in Settings and report the details to the app maintainer.')])
      window.scrollTo(0, 0)
    }
  }
  const askReset = sample => setConfirm({ title: sample ? 'Load the sample project?' : 'Create a new comparison?', text: 'This replaces the current project in local storage. Export your project first if you want to keep it.', action: () => { setProject(createProject(sample)); navigate('setup') } })
  const importProject = async event => {
    const file = event.target.files[0]
    if (!file) return
    try {
      if (file.size > 20_000_000) throw new Error('This project file exceeds the 20 MB limit. To fix: choose a smaller project export in Settings > Import project JSON. Work on a copy of the file: remove unneeded datasets while retaining the active dataset, or set calculation to null to remove the old result snapshot; keep shared inputs and materials. Save and retry.')
      const incoming = readProject(await file.text())
      setConfirm({ title: 'Load imported project?', text: `Replace the current project with “${incoming.name}”? Export your current project first to keep a backup.`, action: () => { setProject(incoming); navigate('setup') } })
    } catch (error) { setErrors([operationError(`Import of project ${file.name}`, error, 'Your current project has not been replaced. Check that the file is accessible on this device, follow the details below and retry Settings > Import project JSON.')]); window.scrollTo(0, 0) }
    event.target.value = ''
  }
  const updateShared = shared => setProject({ ...project, shared })
  const updateMaterials = materials => setProject({ ...project, materials })
  const sidebarContent = <><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('setup') }}><span className="brand-mark"><Layers3 size={26} strokeWidth={1.6} /></span><span>{APP_NAME}<small>Building envelope intelligence</small></span></a><div className="sidebar-label">Workspace</div><nav aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon, number }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{number && <small>{number}</small>}</button>)}</nav><div className="sidebar-study"><div className="study-illustration" aria-hidden="true"><span /><span /><span /><span /><i>Q →</i></div><span className="eyebrow">Through the envelope</span><p>Different assemblies.<br />One controlled comparison.</p><button onClick={() => { setShowMethod(true); setMobileNav(false) }}>Understand the method <ArrowUpRight size={15} /></button></div><div className="sidebar-bottom"><span className="local-dot" /><div>Private by design<small>Your projects stay in this browser.</small></div></div></>
  return <div className="app-shell"><aside className="sidebar no-print">{sidebarContent}</aside>{mobileNav && <Modal title="Navigation" onClose={() => setMobileNav(false)}><div className="mobile-navigation">{sidebarContent}</div></Modal>}
    <div className="workspace"><header className="topbar no-print"><div className="breadcrumb"><Button variant="icon-button ghost mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></Button><span>Workspace</span><ChevronRight size={14} /><strong>{navigation.find(n => n.id === page).label}</strong></div><span className="save-status" role="status"><Check size={14} />{saveStatus}</span></header>
      <main><div className="page-heading no-print"><div><div className="eyebrow"><span className="tiny-line" /> Opaque surface conduction / CLTD method</div><h1>{page === 'setup' ? 'Compare materials. Understand the load.' : navigation.find(n => n.id === page).label}</h1><p>{page === 'setup' ? 'Isolate the impact of your assembly, one shared scenario at a time.' : project.name}</p></div><Button variant="primary run-button" onClick={run}><Play size={15} fill="currentColor" /> Run comparison</Button></div>
      <div className="dataset-banner"><div><Database size={17} /><span><strong>{dataset.metadata.isDemo ? 'Demonstration reference' : 'Active reference'}</strong><span className="dataset-banner-name"> · {dataset.metadata.name}</span></span></div><button className="no-print" onClick={() => navigate('reference')}>Manage dataset <ArrowUpRight size={15} /></button></div>
      {dataset.metadata.isDemo && <div className="demo-warning"><AlertTriangle size={15} /><span>{DEMO_WARNING}. Import verified reference tables before engineering use.</span></div>}
      {project.calculation?.referenceDataset.metadata.isDemo && !dataset.metadata.isDemo && ['results', 'reports'].includes(page) && <div className="notice warning">Result snapshot: {DEMO_WARNING}</div>}
      {storageError && <ErrorNotice errors={[storageError]} onNavigate={navigate} />}
      {errors.length > 0 && <ErrorNotice errors={errors} onNavigate={id => { setPage(id); setMobileNav(false); window.scrollTo(0, 0) }} onDismiss={() => setErrors([])} />}
      {message && <div className="notice success" role="status">{message}</div>}
      {page === 'setup' && <><div className="project-strip"><div><span className="eyebrow">Current project</span><h2>{project.name}</h2></div><Button variant="ghost" onClick={() => navigate('settings')}>Project details <ChevronRight size={16} /></Button></div><div className="setup-grid"><SharedConditions shared={project.shared} onChange={updateShared} onUnits={unit => setProject(changeProjectUnits(project, unit))} /><div className="setup-main"><Materials materials={project.materials} unitSystem={project.shared.unitSystem} hasResults={Boolean(project.calculation)} onChange={updateMaterials} /><section className="method-card"><div className="method-copy"><span className="eyebrow">A transparent calculation</span><h2>From assembly to hourly load.</h2><p>Each reference profile is corrected for your design conditions, then multiplied by U-value and the shared surface area.</p><button className="text-link" onClick={() => setShowMethod(true)}>Explore the calculation method <ArrowUpRight size={15} /></button></div><div className="method-formula"><span>Conduction cooling load</span><strong>Q = U × A × CLTD<sub>c</sub></strong><div><span>Assembly</span><span>Shared area</span><span>Corrected profile</span></div></div></section><section className="ready-panel"><div><span className="eyebrow">03 / Compare the outcome</span><h2>The peak is only half the story.</h2><p>See how much heat passes through each assembly — and when. Run your comparison to reveal the hourly profiles, ranked peaks and full calculation audit.</p></div><Button variant="primary" onClick={run}>Run comparison <ChevronRight size={16} /></Button>{project.calculation && <Button onClick={() => navigate('results')}>View {stale ? 'previous' : 'current'} results</Button>}</section><div className="scope-note"><BookOpen size={18} /><p><strong>Focused by design.</strong> This tool compares conduction through a single opaque wall or roof. It does not calculate the total building cooling load.</p></div></div></div></>}
      {page === 'guide' && <UserGuide onNavigate={navigate} />}
      {page === 'materials' && <Materials materials={project.materials} unitSystem={project.shared.unitSystem} hasResults={Boolean(project.calculation)} onChange={updateMaterials} />}
      {['results', 'reports'].includes(page) && <Results calculation={project.calculation} stale={stale} onRun={run} report={page === 'reports'} projectName={project.name} />}
      {page === 'reference' && <ReferenceData project={project} onChange={setProject} onError={error => { setErrors([error]); window.scrollTo(0, 0) }} />}
      {page === 'settings' && <div className="settings-grid"><section className="panel"><div className="panel-heading"><h2>Project details</h2></div><div className="p-6 space-y-5"><Field label="Project name" value={project.name} onChange={e => setProject({ ...project, name: e.target.value })} /><Field label="Comparison description">{id => <textarea id={id} rows={4} value={project.description} onChange={e => setProject({ ...project, description: e.target.value })} />}</Field><p className="helper">Units are configured in Comparison setup. Switching systems converts area, U-values and temperatures; a matching reference dataset is required.</p><div className="tag">Project schema v{project.schemaVersion}</div></div></section><section className="panel"><div className="panel-heading"><h2>Local projects & backups</h2></div><div className="p-6 space-y-5"><p>Changes are saved automatically in this browser. Export a JSON project to transfer it or keep a durable backup. Project files include the reference tables and previous calculation snapshot.</p><div className="action-row"><Button onClick={() => download('thermacompare-project.json', JSON.stringify(project, null, 2))}><Download size={16} /> Export project JSON</Button><Button onClick={() => importRef.current.click()}><Upload size={16} /> Import project JSON</Button></div><div className="action-row"><Button onClick={() => askReset(true)}><RotateCcw size={16} /> Load sample project</Button><Button onClick={() => askReset(false)}><Plus size={16} /> New / reset project</Button></div>{storageError && <><Button onClick={() => download('thermacompare-storage-backup.txt', localStorage.getItem(STORAGE_KEY) || '', 'text/plain')}>Export original storage backup</Button><Button onClick={() => { resumeSaving(); setMessage('Autosave resumed for the current project.') }}>Resume local saving</Button></>}<p className="helper">No account or server storage. Clearing browser data removes locally saved projects.</p></div></section></div>}
      <footer className="workspace-footer"><span>{APP_NAME} <span className="footer-slash">/</span> Opaque-surface comparison</span><span>Source-aware. Calculation-transparent.</span></footer>
      </main><input className="hidden" type="file" accept=".json" aria-label="Import project JSON" ref={importRef} onChange={importProject} />
    </div>{confirm && <Modal title={confirm.title} onClose={() => setConfirm(null)}><div className="modal-body"><p>{confirm.text}</p><Button className="mt-4" onClick={() => download('thermacompare-project.json', JSON.stringify(project, null, 2))}><Download size={16} /> Export current project</Button></div><div className="modal-footer"><Button onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" onClick={() => { confirm.action(); setConfirm(null) }}>Continue</Button></div></Modal>}
    {showMethod && <Modal title="The CLTD method" onClose={() => setShowMethod(false)}><div className="modal-body space-y-5"><p>Conduction is calculated separately at every selected hour, using the same area, orientation, location, temperatures, unit system and reference dataset for all assemblies.</p><div className="formula-box"><p>SI: CLTDc = (CLTDbase + LM) × K<br /> + (25.5 − Troom) + (Toutdoor,avg − 29.4)</p><p>IP: CLTDc = (CLTDbase + LM) × K<br /> + (78 − Troom) + (Toutdoor,avg − 85)</p><strong>Q = U × Area × CLTDc</strong></div><p>Only assembly name, U-value, reference group and colour factor vary. Dark K = 1.00; light K = 0.65. The advanced custom factor range is 0 &lt; K ≤ 1 and requires source verification.</p><p>SI gives watts from W/m²·K, m² and a temperature difference in K. IP gives Btu/h from Btu/h·ft²·°F, ft² and °F difference. Each material’s own maximum is ranked; ties share a rank.</p><div className="notice warning">{DEMO_WARNING}. The included group profiles are synthetic. Verify authoritative tables and a hand-calculated example before design use.</div></div></Modal>}
  </div>
}
