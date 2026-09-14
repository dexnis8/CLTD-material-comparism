import { DEMO_WARNING, SCHEMA_VERSION } from '../app/config'
import { compareMaterials } from '../domain/calculations'
import { parseStrictJSON, referenceRows, validateDataset } from '../domain/reference'
import { UNITS, LOAD_UNITS, resultsInLoadUnit } from '../domain/units'
import { demoDataset } from '../data/demo'

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const csv = rows => rows.map(row => row.map(value => {
  let text = String(value ?? '')
  // Protect text cells from spreadsheet formula execution; preserve numeric negatives.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}).join(',')).join('\r\n')

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || cell === '') quoted = !quoted
      else throw new Error('Invalid CSV quote.')
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(cell); cell = ''
      if (c !== ',') {
        if (row.some(v => v !== '')) rows.push(row)
        row = []
        if (c === '\r' && text[i + 1] === '\n') i++
      }
    } else cell += c
  }
  if (quoted) throw new Error('Unclosed CSV quote.')
  if (cell || row.length) { row.push(cell); rows.push(row) }
  if (rows.length < 2) throw new Error('CSV requires a header and data rows.')
  const headers = rows.shift()
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV headers.')
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`)
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]))
  })
}
const metadataKeys = ['id', 'name', 'source', 'edition', 'unitSystem', 'version', 'importedAt', 'isDemo', 'notes']
const rowKeys = ['table', 'group', 'surface', 'orientation', 'hour', 'latitude', 'month', 'value']
export function datasetCSV(dataset) {
  return csv([[...metadataKeys, ...rowKeys], ...referenceRows(dataset).map(row => [...metadataKeys.map(k => dataset.metadata[k] ?? ''), ...rowKeys.map(k => ['hour', 'latitude', 'month', 'value'].includes(k) && row[k] !== '' ? Number(row[k]) : row[k])])])
}
export function importDataset(text, format) {
  let dataset
  if (format === 'csv') {
    const rows = parseCSV(text)
    for (const key of [...metadataKeys.filter(k => k !== 'notes'), ...rowKeys]) if (!(key in rows[0])) throw new Error(`Missing CSV column: ${key}`)
    const metadata = Object.fromEntries(metadataKeys.map(key => [key, rows[0][key]]))
    if (!['true', 'false'].includes(metadata.isDemo)) throw new Error('isDemo must be true or false.')
    metadata.isDemo = metadata.isDemo === 'true'
    dataset = { metadata, cltd: {}, lm: {} }
    const seen = new Set()
    for (const row of rows) {
      for (const key of metadataKeys) if (row[key] !== rows[0][key]) throw new Error(`Inconsistent CSV metadata: ${key}`)
      if (!['CLTD', 'LM'].includes(row.table)) throw new Error(`Invalid table: ${row.table}`)
      const keys = row.table === 'CLTD' ? [row.group, row.surface, row.orientation, row.hour] : [row.latitude, row.month, row.orientation]
      if (keys.some(k => !k || ['__proto__', 'prototype', 'constructor'].includes(k))) throw new Error('Missing or unsupported reference key.')
      const signature = JSON.stringify([row.table, ...keys])
      if (seen.has(signature)) throw new Error(`Duplicate reference key: ${signature}`)
      seen.add(signature)
      if (!row.value.trim() || !Number.isFinite(Number(row.value))) throw new Error(`Invalid reference value: ${signature}`)
      let target = row.table === 'CLTD' ? dataset.cltd : dataset.lm
      keys.slice(0, -1).forEach(key => { target[key] ??= {}; target = target[key] })
      target[keys.at(-1)] = Number(row.value)
    }
  } else dataset = parseStrictJSON(text)
  const errors = validateDataset(dataset)
  if (errors.length) throw new Error(errors.join('\n'))
  return dataset
}
export function readProject(text) {
  const project = parseStrictJSON(text)
  if (project.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported project schema version. Expected version 1.')
  if (typeof project.id !== 'string' || !project.id || typeof project.name !== 'string' || !project.shared || !Array.isArray(project.materials) || !Array.isArray(project.datasets)) throw new Error('Malformed project structure.')
  if (!project.datasets.length) throw new Error('A project must contain a dataset.')
  project.datasets.forEach(dataset => { const errors = validateDataset(dataset); if (errors.length) throw new Error(errors.join('\n')) })
  if (new Set(project.datasets.map(d => d.metadata.id)).size !== project.datasets.length) throw new Error('Duplicate dataset IDs.')
  if (!project.datasets.some(d => d.metadata.id === project.activeDatasetId)) throw new Error('Active dataset is missing.')
  if (!project.datasets.some(d => d.metadata.id === demoDataset.metadata.id)) project.datasets.unshift(structuredClone(demoDataset))
  else if (JSON.stringify(project.datasets.find(d => d.metadata.id === demoDataset.metadata.id)) !== JSON.stringify(demoDataset)) throw new Error('The bundled demonstration dataset ID is reserved. Use a unique ID for imported tables.')
  for (const key of ['description']) if (project[key] !== undefined && typeof project[key] !== 'string') throw new Error(`Malformed project ${key}.`)
  if (project.shared.notes !== undefined && typeof project.shared.notes !== 'string') throw new Error('Malformed scenario notes.')
  project.description ??= ''
  project.shared.notes ??= ''
  const shared = project.shared
  for (const key of ['surfaceType', 'unitSystem', 'orientation', 'negativeHandling']) if (typeof shared[key] !== 'string') throw new Error(`Missing shared field: ${key}`)
  for (const key of ['area', 'latitude', 'month', 'startHour', 'endHour', 'indoorTemperature', 'outdoorDesignTemperature', 'dailyRange', 'averageOutdoorTemperature']) if (shared[key] !== '' && (typeof shared[key] !== 'number' || !Number.isFinite(shared[key]))) throw new Error(`Malformed shared field: ${key}`)
  if (!['SI', 'IP'].includes(shared.unitSystem)) throw new Error('Unsupported project units.')
  const ids = new Set()
  for (const m of project.materials) {
    if (!m || typeof m.id !== 'string' || !m.id || ids.has(m.id) || typeof m.name !== 'string' || typeof m.groupNumber !== 'string' || typeof m.surfaceColor !== 'string' || typeof m.isBaseline !== 'boolean' || !Number.isFinite(m.uValue) || !Number.isFinite(m.colorFactor)) throw new Error('Malformed or duplicate material.')
    ids.add(m.id)
  }
  // Recalculate saved snapshots so imported report values cannot bypass the engine.
  if (project.calculation) {
    const { materials, sharedConditions, referenceDataset, calculatedAt } = project.calculation
    const recalculated = compareMaterials(materials, sharedConditions, referenceDataset)
    project.calculation = { ...recalculated, calculatedAt: Number.isFinite(Date.parse(calculatedAt)) ? calculatedAt : recalculated.calculatedAt }
  }
  return project
}
export function reportCSV(calculation, hourly = false, loadUnit = 'kW') {
  const c = { ...calculation, results: resultsInLoadUnit(calculation, loadUnit) }, unit = { ...UNITS[c.sharedConditions.unitSystem], load: LOAD_UNITS[loadUnit] }
  const context = ['Dataset', 'Source', 'Edition', 'Version', 'Warning', 'Calculated at', 'Surface', `Area (${unit.area})`, 'Orientation', 'Latitude', 'Month', 'Start hour', 'End hour', `Indoor (${unit.temperature})`, `Outdoor design (${unit.temperature})`, `Daily range (${unit.difference})`, `Outdoor average (${unit.temperature})`, 'Negative handling', 'Baseline ID', 'Assumptions']
  const values = [c.referenceDataset.metadata.name, c.referenceDataset.metadata.source, c.referenceDataset.metadata.edition, c.referenceDataset.metadata.version, c.referenceDataset.metadata.isDemo ? DEMO_WARNING : c.warnings.join(' | '), c.calculatedAt, c.sharedConditions.surfaceType, c.sharedConditions.area, c.sharedConditions.orientation, c.sharedConditions.latitude, c.sharedConditions.month, c.sharedConditions.startHour, c.sharedConditions.endHour, c.sharedConditions.indoorTemperature, c.sharedConditions.outdoorDesignTemperature, c.sharedConditions.dailyRange, c.sharedConditions.averageOutdoorTemperature, c.sharedConditions.negativeHandling, c.baselineId, [...c.assumptions, ...c.warnings].join(' | ')]
  const headers = hourly ? ['Material', 'Material ID', `U (${unit.u})`, 'Group', 'Hour', `Base CLTD (${unit.difference})`, `LM (${unit.difference})`, 'K', `Indoor correction (${unit.difference})`, `Outdoor correction (${unit.difference})`, `Raw CLTD (${unit.difference})`, `Applied CLTD (${unit.difference})`, `Load (${unit.load})`, 'Clamped'] : ['Rank', 'Material', 'Material ID', `U (${unit.u})`, 'Group', 'K', `Peak (${unit.load})`, 'Peak hour', `Average (${unit.load})`, `Difference (${unit.load})`, 'Difference (%)']
  const rows = c.results.flatMap(r => hourly ? r.hourlyResults.map(h => [r.materialName, r.materialId, r.uValue, r.groupNumber, h.hour, h.baseCLTD, h.lm, h.colorFactor, h.indoorCorrection, h.outdoorCorrection, h.rawCorrectedCLTD, h.appliedCorrectedCLTD, h.conductionLoad, h.wasClamped, ...values]) : [[r.rank, r.materialName, r.materialId, r.uValue, r.groupNumber, r.colorFactor, r.peakLoad, r.peakHour, r.averageLoad, r.differenceFromBaseline, r.percentageDifferenceFromBaseline ?? 'N/A', ...values]])
  return csv([[...headers, ...context], ...rows])
}
