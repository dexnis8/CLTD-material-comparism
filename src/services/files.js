import { DEMO_WARNING, SCHEMA_VERSION } from '../app/config'
import { compareMaterials } from '../domain/calculations'
import { parseStrictJSON, referenceRows, validateDataset } from '../domain/reference'
import { UNITS, LOAD_UNITS, resultsInLoadUnit } from '../domain/units'
import { demoDataset } from '../data/demo'
import { operationError } from './errors'

export function download(name, text, type = 'application/json') {
  let url
  try {
    url = URL.createObjectURL(new Blob([text], { type }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = name; anchor.click()
  } catch (error) {
    throw new Error(operationError(`Download of ${name}`, error, 'Allow downloads for this site in your browser, check available disk space and retry the export. If no file appears, check the browser Downloads list for a blocked or failed download. Keep this page open until your project backup is saved.'), { cause: error })
  } finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
export const csv = rows => rows.map(row => row.map(value => {
  let text = String(value ?? '')
  // Protect text cells from spreadsheet formula execution; preserve numeric negatives.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}).join(',')).join('\r\n')

const csvIssue = (problem, fix) => new Error(`Reference CSV: ${problem} To fix: ${fix} Save as CSV, then open Reference data > Import dataset and select the corrected file. Download CSV template under Start with a template to check the required layout.`)
const projectIssue = (problem, fix) => new Error(`Project file: ${problem} To fix: ${fix} Save the corrected JSON and retry Settings > Import project JSON, or import a known-good project backup. Reference-only files belong in Reference data > Import dataset.`)

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || cell === '') quoted = !quoted
      else throw csvIssue(`Invalid quote near character ${i + 1}.`, 'Enclose the entire cell in double quotes and escape a quote inside it as two double quotes.')
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(cell); cell = ''
      if (c !== ',') {
        if (row.some(v => v !== '')) rows.push(row)
        row = []
        if (c === '\r' && text[i + 1] === '\n') i++
      }
    } else cell += c
  }
  if (quoted) throw csvIssue('Unclosed CSV quote.', 'Find the opening double quote without a matching closing quote and close that cell, or re-export the CSV from your spreadsheet.')
  if (cell || row.length) { row.push(cell); rows.push(row) }
  if (rows.length < 2) throw csvIssue('CSV requires a header and data rows.', 'Keep the template header and add CLTD and LM rows from your verified reference source.')
  const headers = rows.shift()
  if (new Set(headers).size !== headers.length) throw csvIssue(`Duplicate CSV headers: ${headers.filter((h, i) => headers.indexOf(h) !== i).join(', ')}.`, 'Give every column in the first row a unique name matching the template.')
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw csvIssue(`CSV record ${index + 2} has ${values.length} columns; expected ${headers.length}.`, 'Add missing cells or remove extra delimiters in this record. Quote cells containing commas. Record numbers include the header; a multiline quoted cell still counts as one record.')
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
    for (const key of [...metadataKeys.filter(k => k !== 'notes'), ...rowKeys]) if (!(key in rows[0])) throw csvIssue(`Missing CSV column: ${key}.`, `Add the exact header ${key} to the first row and populate the data rows. Check spelling and capitalization.`)
    const metadata = Object.fromEntries(metadataKeys.map(key => [key, rows[0][key]]))
    if (!['true', 'false'].includes(metadata.isDemo)) throw csvIssue('isDemo must be true or false.', 'Set the isDemo column to true for synthetic examples or false for real reference data in every row.')
    metadata.isDemo = metadata.isDemo === 'true'
    dataset = { metadata, cltd: {}, lm: {} }
    const seen = new Set()
    for (const [index, row] of rows.entries()) {
      for (const key of metadataKeys) if (row[key] !== rows[0][key]) throw csvIssue(`Inconsistent CSV metadata at record ${index + 2}, column ${key}.`, `Repeat the same ${key} from the first data row throughout this dataset, or split different datasets into separate files.`)
      if (!['CLTD', 'LM'].includes(row.table)) throw csvIssue(`Invalid table at record ${index + 2}: ${row.table}.`, 'Set table to CLTD for hourly values or LM for latitude/month corrections.')
      const keys = row.table === 'CLTD' ? [row.group, row.surface, row.orientation, row.hour] : [row.latitude, row.month, row.orientation]
      if (keys.some(k => !k || ['__proto__', 'prototype', 'constructor'].includes(k))) throw csvIssue(`Missing or unsupported reference key at record ${index + 2}: ${JSON.stringify(keys)}.`, 'For CLTD fill group, surface, orientation and hour; for LM fill latitude, month and orientation. Do not use reserved names __proto__, prototype or constructor.')
      const signature = JSON.stringify([row.table, ...keys])
      if (seen.has(signature)) throw csvIssue(`Duplicate reference key at record ${index + 2}: ${signature}.`, 'Keep one verified row per lookup combination; remove the duplicate or correct its lookup fields.')
      seen.add(signature)
      if (!row.value.trim() || !Number.isFinite(Number(row.value))) throw csvIssue(`Invalid reference value at record ${index + 2}, column value: ${signature}.`, 'Enter a finite numeric value from your source without unit symbols or thousands separators; use a decimal point.')
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
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw projectIssue('Expected a project object, not null, a list or a single value.', 'Choose a project JSON exported from Settings.')
  if (project.schemaVersion !== SCHEMA_VERSION) throw projectIssue('Unsupported project schema version. Expected version 1.', 'Use a project exported by this version of ThermaCompare. Do not simply change schemaVersion on an incompatible file; re-export from a compatible app or recreate the project.')
  if (typeof project.id !== 'string' || !project.id || typeof project.name !== 'string' || !project.shared || typeof project.shared !== 'object' || Array.isArray(project.shared) || !Array.isArray(project.materials) || !Array.isArray(project.datasets)) throw projectIssue('Malformed project structure: id, name, shared, materials or datasets is missing or has the wrong type.', 'Compare with Settings > Export project JSON: id and name must be text, shared an object, and materials and datasets arrays.')
  if (!project.datasets.length) throw projectIssue('A project must contain a dataset.', 'Restore at least one complete dataset in datasets, including metadata, cltd and lm, and set activeDatasetId to its metadata.id.')
  project.datasets.forEach((dataset, index) => { const errors = validateDataset(dataset); if (errors.length) throw projectIssue(`Reference dataset at datasets[${index}] is invalid. ${errors.join(' ')}`, 'Correct that dataset inside this project file, or ask its provider for a corrected project export.') })
  if (new Set(project.datasets.map(d => d.metadata.id)).size !== project.datasets.length) throw projectIssue('Duplicate dataset IDs.', 'Give every datasets[].metadata.id a unique text value, then set activeDatasetId to the intended dataset ID.')
  if (!project.datasets.some(d => d.metadata.id === project.activeDatasetId)) throw projectIssue(`Active dataset "${project.activeDatasetId}" is missing.`, 'Set activeDatasetId to one of the datasets[].metadata.id values present in this file, or restore the missing dataset from a backup.')
  if (!project.datasets.some(d => d.metadata.id === demoDataset.metadata.id)) project.datasets.unshift(structuredClone(demoDataset))
  else if (JSON.stringify(project.datasets.find(d => d.metadata.id === demoDataset.metadata.id)) !== JSON.stringify(demoDataset)) throw projectIssue('The bundled demonstration dataset ID is reserved and its contents were changed.', 'Give the modified dataset a new metadata.id and update activeDatasetId if it refers to that table.')
  for (const key of ['description']) if (project[key] !== undefined && typeof project[key] !== 'string') throw projectIssue(`Malformed project ${key}.`, `Set ${key} to a JSON string or remove this optional field.`)
  if (project.shared.notes !== undefined && typeof project.shared.notes !== 'string') throw projectIssue('Malformed scenario notes at shared.notes.', 'Set shared.notes to a JSON string or remove this optional field.')
  project.description ??= ''
  project.shared.notes ??= ''
  const shared = project.shared
  for (const key of ['surfaceType', 'unitSystem', 'orientation', 'negativeHandling']) if (typeof shared[key] !== 'string') throw projectIssue(`Missing shared field: shared.${key}.`, `Restore the text value at shared.${key} using an exported project as a format example.`)
  for (const key of ['area', 'latitude', 'month', 'startHour', 'endHour', 'indoorTemperature', 'outdoorDesignTemperature', 'dailyRange', 'averageOutdoorTemperature']) if (shared[key] !== '' && (typeof shared[key] !== 'number' || !Number.isFinite(shared[key]))) throw projectIssue(`Malformed shared field: shared.${key}.`, `Enter a finite number without quotes or unit symbols at shared.${key}; use an empty string for an unfinished input.`)
  if (!['SI', 'IP'].includes(shared.unitSystem)) throw projectIssue('Unsupported project units at shared.unitSystem.', 'Use SI or IP matching the actual area, temperature and U-value units in the file. Changing this label does not convert numbers.')
  const ids = new Set()
  for (const [index, m] of project.materials.entries()) {
    if (!m || typeof m.id !== 'string' || !m.id || ids.has(m.id) || typeof m.name !== 'string' || typeof m.groupNumber !== 'string' || typeof m.surfaceColor !== 'string' || typeof m.isBaseline !== 'boolean' || !Number.isFinite(m.uValue) || !Number.isFinite(m.colorFactor)) throw projectIssue(`Malformed or duplicate material at materials[${index}] (assembly ${index + 1}, ${m?.name || 'unnamed'}).`, 'Give this assembly a unique non-empty string id; text name, groupNumber and surfaceColor; numeric uValue and colorFactor; and a true/false isBaseline value. Follow an exported project example.')
    if (m.description !== undefined && typeof m.description !== 'string') throw projectIssue(`materials[${index}].description must be text.`, 'Replace the description with a JSON string or remove this optional field.')
    ids.add(m.id)
  }
  // Recalculate saved snapshots so imported report values cannot bypass the engine.
  if (project.calculation) {
    const { materials, sharedConditions, referenceDataset, calculatedAt } = project.calculation
    let recalculated
    try { recalculated = compareMaterials(materials, sharedConditions, referenceDataset) } catch (error) {
      throw projectIssue(`The saved calculation snapshot cannot be verified: ${error.message}`, 'These issues concern calculation.materials, calculation.sharedConditions or calculation.referenceDataset in the file. Correct that snapshot, or set calculation to null to discard only old results, then import and Run comparison again.')
    }
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
