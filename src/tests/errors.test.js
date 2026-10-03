import { describe, expect, it } from 'vitest'
import { createProject, demoDataset } from '../data/demo'
import { compareMaterials, validateInputs } from '../domain/calculations'
import { getLatitudeMonthCorrection, validateDataset } from '../domain/reference'
import { datasetCSV, importDataset, parseCSV, readProject } from '../services/files'

describe('actionable error guidance', () => {
  it('explains the reported 7.38 degree March west lookup without substituting data', () => {
    const project = createProject()
    project.shared.latitude = 7.38
    project.shared.month = 3
    const errors = validateInputs(project.materials, project.shared, demoDataset)
    expect(errors).toHaveLength(1)
    for (const text of ['Missing LM', 'latitude/month correction', '7.38°', 'March (month 3)', 'west (W)', demoDataset.metadata.name, 'Reference table inspector', 'lm[7.38][3][W]', 'Import dataset', 'Do not change the real site latitude']) expect(errors[0]).toContain(text)
    expect(() => compareMaterials(project.materials, project.shared, demoDataset)).toThrow('Missing LM')
  })
  it('reports available latitudes only for the requested month and direction', () => {
    const dataset = structuredClone(demoDataset)
    dataset.lm[10] = { 3: { W: 2 } }
    dataset.lm[20] = { 3: { E: 2 } }
    expect(() => getLatitudeMonthCorrection({ latitude: 7.38, month: 3, orientation: 'W', dataset })).toThrow('Available latitudes for this month and orientation: 10°.')
  })
  it('identifies the affected assembly and exact missing hourly table entry', () => {
    const project = createProject(), dataset = structuredClone(demoDataset)
    delete dataset.cltd[project.materials[0].groupNumber].Wall.W[12]
    const message = validateInputs(project.materials, project.shared, dataset).join(' ')
    for (const text of [project.materials[0].name, 'Missing CLTD', '12:00', 'Reference group', 'Import dataset']) expect(message).toContain(text)
  })
  it.each([
    p => { p.shared.area = 0 }, p => { p.shared.latitude = 100 }, p => { p.shared.month = 0 },
    p => { p.shared.startHour = 25 }, p => { p.shared.dailyRange = -1 }, p => { p.shared.unitSystem = 'IP' },
    p => { p.shared.indoorTemperature = '' }, p => { p.shared.orientation = 'bad' },
    p => { p.materials = [] }, p => { p.materials[0].uValue = 0 }, p => { p.materials[0].colorFactor = 2 },
    p => { p.materials[0].groupNumber = 'H' }, p => { p.materials.forEach(m => { m.isBaseline = false }) },
  ])('provides a screen and fix for invalid inputs %#', mutate => {
    const project = createProject(); mutate(project)
    const errors = validateInputs(project.materials, project.shared, demoDataset)
    expect(errors.length).toBeGreaterThan(0)
    for (const error of errors) { expect(error).toContain('To fix:'); expect(error).toMatch(/Comparison setup|Materials|Reference data|Settings/) }
  })
  it('gives a complete path for malformed nested reference values', () => {
    const dataset = structuredClone(demoDataset)
    dataset.cltd.A.Wall.W[12] = null
    dataset.lm[40][7].W = 'not a number'
    const errors = validateDataset(dataset)
    expect(errors.join(' ')).toContain('cltd[A][Wall][W][12]')
    expect(errors.join(' ')).toContain('lm[40][7][W]')
    errors.forEach(error => { expect(error).toContain('To fix:'); expect(error).toContain('Import dataset') })
  })
  it.each(['null', '[]', '{', '{"schemaVersion":2}'])('explains invalid project file %s', text => {
    expect(() => readProject(text)).toThrow('To fix:')
    expect(() => readProject(text)).toThrow('Import project JSON')
  })
  it('rejects malformed shared objects before they can crash rendering', () => {
    const project = createProject(); project.shared = []
    expect(() => readProject(JSON.stringify(project))).toThrow('shared an object')
  })
  it('points to the material index on a bad import', () => {
    const project = createProject(); project.materials[1] = null
    expect(() => readProject(JSON.stringify(project))).toThrow('materials[1]')
  })
  it('distinguishes invalid saved results from editable current inputs', () => {
    const project = createProject()
    project.calculation = compareMaterials(project.materials, project.shared, demoDataset)
    project.calculation.sharedConditions.latitude = 7.38
    expect(() => readProject(JSON.stringify(project))).toThrow('set calculation to null')
  })
  it('names CSV record and column and explains how to reimport', () => {
    const text = datasetCSV(demoDataset), lines = text.split('\r\n')
    lines[1] = lines[1].replace(/"[^"]*"$/, '"bad value"')
    expect(() => importDataset(lines.join('\r\n'), 'csv')).toThrow('record 2, column value')
    expect(() => importDataset(lines.join('\r\n'), 'csv')).toThrow('Reference data > Import dataset')
    expect(() => parseCSV('a,b\n1')).toThrow('record 2 has 1 columns; expected 2')
  })
})
