import { describe, expect, it } from 'vitest'
import { correctedCLTD, compareMaterials, calcMaterialConductionLoad, validateInputs, conductionLoad } from '../domain/calculations'
import { getBaseCLTD, getLatitudeMonthCorrection, validateDataset, parseStrictJSON } from '../domain/reference'
import { changeProjectUnits, convert, convertLoad } from '../domain/units'
import { createProject, demoDataset } from '../data/demo'
import { csv, datasetCSV, importDataset, parseCSV, readProject, reportCSV } from '../services/files'

const inputs = { baseCLTD: 10, latitudeMonthCorrection: 2, colorFactor: 0.65, indoorTemperature: 24, averageOutdoorTemperature: 31.5, unitSystem: 'SI' }
function fixture() {
  const p = createProject()
  p.shared = { ...p.shared, startHour: 12, endHour: 14, indoorTemperature: 25.5, averageOutdoorTemperature: 29.4 }
  p.materials = p.materials.slice(0, 2).map((m, i) => ({ ...m, uValue: 1, groupNumber: i ? 'B' : 'A', surfaceColor: 'dark', colorFactor: 1 }))
  const d = structuredClone(demoDataset)
  d.cltd.A.Wall.W = { 12: 10, 13: 20, 14: 15 }
  d.cltd.B.Wall.W = { 12: 5, 13: 10, 14: 12 }
  d.lm[40][7].W = 0
  return { p, d }
}
describe('corrected CLTD: transparent synthetic fixtures', () => {
  it('SI: (10+2)*.65 + 1.5 + 2.1 = 11.4', () => expect(correctedCLTD(inputs).rawCorrectedCLTD).toBeCloseTo(11.4))
  it('IP: (18+3.6)*.65 + 3 + 4 = 21.04', () => expect(correctedCLTD({ ...inputs, baseCLTD: 18, latitudeMonthCorrection: 3.6, indoorTemperature: 75, averageOutdoorTemperature: 89, unitSystem: 'IP' }).rawCorrectedCLTD).toBeCloseTo(21.04))
  it('indoor correction', () => expect(correctedCLTD(inputs).indoorCorrection).toBe(1.5))
  it('outdoor correction', () => expect(correctedCLTD(inputs).outdoorCorrection).toBeCloseTo(2.1))
  it('K applies only to base plus LM', () => expect(correctedCLTD({ ...inputs, colorFactor: 1 }).rawCorrectedCLTD).toBeCloseTo(15.6))
  it('preserves negative values', () => expect(correctedCLTD({ ...inputs, baseCLTD: -30 }).appliedCorrectedCLTD).toBeLessThan(0))
  it('clamps applied values but keeps the raw audit', () => {
    const r = correctedCLTD({ ...inputs, baseCLTD: -30, negativeHandling: 'clamp' })
    expect(r.rawCorrectedCLTD).toBeLessThan(0); expect(r.appliedCorrectedCLTD).toBe(0); expect(r.wasClamped).toBe(true)
  })
  it('Q = .45 * 20 * 11.8 = 106.2 W', () => expect(conductionLoad(.45, 20, 11.8)).toBeCloseTo(106.2))
})
describe('reference lookup and strict data validation', () => {
  it('looks up group, surface, orientation and hour', () => expect(getBaseCLTD({ groupNumber: 'A', surfaceType: 'Wall', orientation: 'W', hour: 15, dataset: demoDataset })).toBe(25))
  it('looks up exact latitude, month and orientation', () => expect(getLatitudeMonthCorrection({ latitude: 40, month: 7, orientation: 'W', dataset: demoDataset })).toBe(1.5))
  it('does not extrapolate a missing latitude', () => expect(() => getLatitudeMonthCorrection({ latitude: 41, month: 7, orientation: 'W', dataset: demoDataset })).toThrow('Missing LM'))
  it('rejects missing CLTD', () => expect(() => getBaseCLTD({ groupNumber: 'A', surfaceType: 'Wall', orientation: 'N', hour: 12, dataset: demoDataset })).toThrow('Missing CLTD'))
  it('accepts the labelled demo', () => expect(validateDataset(demoDataset)).toEqual([]))
  it.each([
    d => { d.metadata.source = '' }, d => { d.metadata.unitSystem = 'mixed' }, d => { d.cltd = {} }, d => { d.lm = {} },
    d => { d.cltd.H = d.cltd.A }, d => { d.cltd.A.Wall.W[24] = 10 }, d => { d.cltd.A.Wall.W[1] = null },
    d => { d.lm[40][13] = { W: 1 } }, d => { d.cltd.A.Roof.N = { 1: 2 } }, d => { d.lm[91] = { 7: { W: 1 } } },
    d => { d.cltd.A.Wall.W[2] = '12' }, d => { d.metadata.importedAt = 'invalid' },
  ])('rejects malformed reference data %#', mutate => { const d = structuredClone(demoDataset); mutate(d); expect(validateDataset(d).length).toBeGreaterThan(0) })
  it('rejects duplicate JSON keys, including escaped aliases', () => { expect(() => parseStrictJSON('{"x":1,"x":2}')).toThrow('Duplicate'); expect(() => parseStrictJSON('{"x":1,"\\u0078":2}')).toThrow('Duplicate') })
  it('rejects prototype keys', () => expect(() => parseStrictJSON('{"__proto__": {}}')).toThrow('Unsupported'))
})
describe('hourly conduction, peaks, ranking and baseline', () => {
  it('generates inclusive hourly wall results and independent peaks', () => {
    const { p, d } = fixture(), c = compareMaterials(p.materials, p.shared, d)
    expect(c.results[0].hourlyResults.map(h => h.hour)).toEqual([12, 13, 14])
    expect(c.results.map(r => [r.peakLoad, r.peakHour])).toEqual([[240, 14], [400, 13]])
    expect(c.results.map(r => r.rank)).toEqual([1, 2])
    expect(c.results[0].averageLoad).toBe(180)
  })
  it('calculates baseline absolute and percentage differences', () => { const { p, d } = fixture(); const r = compareMaterials(p.materials, p.shared, d).results[0]; expect(r.differenceFromBaseline).toBe(-160); expect(r.percentageDifferenceFromBaseline).toBe(-40) })
  it('ties share rank, preserve order and choose earliest peak hour', () => {
    const { p, d } = fixture(); p.materials[1].groupNumber = 'A'; d.cltd.A.Wall.W[14] = 20
    const r = compareMaterials(p.materials, p.shared, d).results
    expect(r.map(r => r.rank)).toEqual([1, 1]); expect(r.map(r => r.materialId)).toEqual(p.materials.map(m => m.id)); expect(r[0].peakHour).toBe(13)
  })
  it('roof uses Horizontal lookup', () => { const { p, d } = fixture(); p.shared.surfaceType = 'Roof'; p.shared.orientation = 'Horizontal'; const r = calcMaterialConductionLoad(p.materials[0], p.shared, d); expect(r.hourlyResults[0].conductionLoad).toBe((19 + 3 + .5) * 20) })
  it('preserves every shared input and keeps a detached snapshot', () => { const { p, d } = fixture(); const before = JSON.stringify(p.shared); Object.freeze(p.shared); const c = compareMaterials(p.materials, p.shared, d); expect(JSON.stringify(p.shared)).toBe(before); expect(c.sharedConditions).not.toBe(p.shared) })
  it('U-value changes load and group changes timing', () => { const { p, d } = fixture(); const m = p.materials[0]; const a = calcMaterialConductionLoad(m, p.shared, d); const b = calcMaterialConductionLoad({ ...m, uValue: 2 }, p.shared, d); const c = calcMaterialConductionLoad({ ...m, groupNumber: 'B' }, p.shared, d); expect(b.peakLoad).toBe(a.peakLoad * 2); expect(c.peakHour).not.toBe(a.peakHour) })
  it('zero baseline returns null percentage', () => { const { p, d } = fixture(); p.shared.negativeHandling = 'clamp'; p.shared.indoorTemperature = 100; expect(compareMaterials(p.materials, p.shared, d).results[0].percentageDifferenceFromBaseline).toBeNull() })
  it('negative baseline uses absolute magnitude denominator', () => { const { p, d } = fixture(); p.shared.indoorTemperature = 100; const c = compareMaterials(p.materials, p.shared, d); expect(c.results[0].percentageDifferenceFromBaseline).toBeCloseTo(c.results[0].differenceFromBaseline / Math.abs(c.results.find(r => r.materialId === c.baselineId).peakLoad) * 100) })
  it('warns about custom factors, identical properties, partial period and demo', () => { const { p, d } = fixture(); p.materials[1] = { ...p.materials[0], id: 'copy', isBaseline: false, surfaceColor: 'custom' }; const c = compareMaterials(p.materials, p.shared, d); expect(c.warnings.length).toBe(4) })
  it.each([
    p => { p.materials = [] }, p => { p.shared.area = 0 }, p => { p.materials[0].uValue = -1 }, p => { p.materials[0].colorFactor = NaN },
    p => { p.shared.startHour = 25 }, p => { p.shared.endHour = -1 }, p => { p.shared.indoorTemperature = '' }, p => { p.shared.outdoorDesignTemperature = '' },
    p => { p.shared.surfaceType = 'Roof' }, p => { p.shared.unitSystem = 'IP' }, p => { p.materials[0].groupNumber = 'H' }, p => { p.shared.latitude = 41 },
    p => { p.materials[0].isBaseline = false }, p => { p.shared.negativeHandling = 'unknown' },
  ])('blocks invalid comparison inputs %#', mutate => { const { p, d } = fixture(); mutate(p); expect(validateInputs(p.materials, p.shared, d).length).toBeGreaterThan(0); expect(() => compareMaterials(p.materials, p.shared, d)).toThrow() })
})
describe('units and transport', () => {
  it.each(['area', 'u', 'temperature', 'difference', 'load'])('round-trips %s', kind => expect(convert(convert(20, kind, 'SI', 'IP'), kind, 'IP', 'SI')).toBeCloseTo(20, 10))
  it('known temperature and area conversions', () => { expect(convert(0, 'temperature', 'SI', 'IP')).toBe(32); expect(convert(1, 'area', 'SI', 'IP')).toBeCloseTo(10.76391) })
  it('converts project quantities together', () => { const p = createProject(), ip = changeProjectUnits(p, 'IP'), back = changeProjectUnits(ip, 'SI'); expect(ip.shared.unitSystem).toBe('IP'); expect(ip.shared.dailyRange).toBeCloseTo(21.6); expect(back.materials[0].uValue).toBeCloseTo(p.materials[0].uValue); expect(back.shared.area).toBeCloseTo(20) })
  it('JSON dataset round-trip', () => expect(importDataset(JSON.stringify(demoDataset), 'json')).toEqual(demoDataset))
  it('CSV dataset round-trip', () => expect(importDataset(datasetCSV(demoDataset), 'csv')).toEqual(demoDataset))
  it('rejects duplicate CSV keys', () => { const text = datasetCSV(demoDataset); expect(() => importDataset(text + '\r\n' + text.split('\r\n')[1], 'csv')).toThrow('Duplicate') })
  it('quoted CSV newlines and commas round-trip', () => expect(parseCSV(csv([['label', 'value'], ['a,"b"\nc', 4]]))).toEqual([{ label: 'a,"b"\nc', value: '4' }]))
  it('protects formula cells', () => expect(csv([['=HYPERLINK("x")', -4]])).toContain("'=HYPERLINK"))
  it('project round-trip recomputes tampered results', () => { const { p, d } = fixture(); p.calculation = compareMaterials(p.materials, p.shared, d); p.calculation.results[0].peakLoad = 99999; const loaded = readProject(JSON.stringify(p)); expect(loaded.calculation.results[0].peakLoad).toBe(240); expect(loaded.schemaVersion).toBe(1) })
  it('rejects unknown project schema', () => expect(() => readProject('{"schemaVersion":2}')).toThrow('schema'))
  it('exports full precision and demo provenance in summary and hourly CSV', () => { const { p, d } = fixture(); const c = compareMaterials(p.materials, p.shared, d); const summary = parseCSV(reportCSV(c)), hourly = parseCSV(reportCSV(c, true)); expect(summary.length).toBe(2); expect(hourly.length).toBe(6); expect(summary[0].Warning).toContain('not for engineering design'); expect(hourly[0]['Load (kW)']).toBe('0.1'); expect(hourly[0]['Area (m²)']).toBe('20') })
})

describe('result load units', () => {
  it('defaults watts to kilowatts and handles imperial input', () => {
    expect(convertLoad(1000, 'SI')).toBe(1)
    expect(convertLoad(12000, 'IP')).toBeCloseTo(3.516852842, 8)
    expect(convertLoad(12000, 'IP', 'tons')).toBeCloseTo(1, 12)
    expect(convertLoad(1000, 'SI', 'btu')).toBeCloseTo(3412.141633, 6)
    expect(convertLoad(-1000, 'SI')).toBe(-1)
    expect(convertLoad(0, 'SI', 'tons')).toBe(0)
  })
  it('exports selected units without modifying the calculation', () => {
    const { p, d } = fixture()
    const c = compareMaterials(p.materials, p.shared, d)
    const original = structuredClone(c)
    expect(Number(parseCSV(reportCSV(c, false, 'btu'))[0]['Peak (Btu/hr)'])).toBeCloseTo(240 * 3.412141633)
    expect(Number(parseCSV(reportCSV(c, true, 'tons'))[0]['Load (Tons)'])).toBeCloseTo(100 * 3.412141633 / 12000)
    expect(c).toEqual(original)
  })
})
