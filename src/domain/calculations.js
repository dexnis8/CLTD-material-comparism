import { DEMO_WARNING, GROUPS, ORIENTATIONS } from '../app/config'
import { getBaseCLTD, getLatitudeMonthCorrection, validateDataset } from './reference'

// Reference design temperatures specified by this tool's CLTD method.
// SI and IP reference temperatures are independently rounded, as in the supplied equations.
export const REFERENCE_TEMPERATURES = { SI: { indoor: 25.5, outdoor: 29.4 }, IP: { indoor: 78, outdoor: 85 } }
export const DARK_FACTOR = 1.0
export const LIGHT_FACTOR = 0.65
export function correctedCLTD({ baseCLTD, latitudeMonthCorrection, colorFactor, indoorTemperature, averageOutdoorTemperature, unitSystem, negativeHandling = 'preserve' }) {
  const reference = REFERENCE_TEMPERATURES[unitSystem]
  if (!reference) throw new Error('Unsupported calculation units.')
  const indoorCorrection = reference.indoor - indoorTemperature
  const outdoorCorrection = averageOutdoorTemperature - reference.outdoor
  const rawCorrectedCLTD = (baseCLTD + latitudeMonthCorrection) * colorFactor + indoorCorrection + outdoorCorrection
  const wasClamped = negativeHandling === 'clamp' && rawCorrectedCLTD < 0
  return { baseCLTD, latitudeMonthCorrection, colorFactor, indoorCorrection, outdoorCorrection, rawCorrectedCLTD, appliedCorrectedCLTD: wasClamped ? 0 : rawCorrectedCLTD, wasClamped }
}
export const conductionLoad = (uValue, area, cltd) => uValue * area * cltd
export function findPeak(hourlyResults) {
  // Earliest hour wins exact ties, independently for each assembly.
  return hourlyResults.reduce((peak, row) => row.conductionLoad > peak.conductionLoad ? row : peak)
}
export function validateInputs(materials, shared, dataset) {
  const errors = []
  if (!shared || !Array.isArray(materials)) return ['Shared conditions and a material array are required.']
  if (!dataset) return ['Select a reference dataset.']
  errors.push(...validateDataset(dataset))
  if (materials.length < 2) errors.push('Add at least two materials.')
  for (const [key, label] of Object.entries({ area: 'Surface area', indoorTemperature: 'Indoor temperature', outdoorDesignTemperature: 'Outdoor design temperature', dailyRange: 'Daily temperature range', averageOutdoorTemperature: 'Average outdoor temperature', latitude: 'Latitude' })) {
    if (typeof shared[key] !== 'number' || !Number.isFinite(shared[key])) errors.push(`${label} is required and must be numeric.`)
  }
  if (shared.area <= 0) errors.push('Surface area must be greater than zero.')
  if (shared.dailyRange < 0) errors.push('Daily temperature range cannot be negative.')
  if (Math.abs(shared.latitude) > 90) errors.push('Latitude must be between -90° and 90°.')
  if (!Number.isInteger(shared.month) || shared.month < 1 || shared.month > 12) errors.push('Select a valid month.')
  if (!['SI', 'IP'].includes(shared.unitSystem) || dataset.metadata?.unitSystem !== shared.unitSystem) errors.push('Dataset units must match the comparison units. Import a matching dataset.')
  if (!['Wall', 'Roof'].includes(shared.surfaceType)) errors.push('Select Wall or Roof.')
  if (!(shared.surfaceType === 'Roof' ? ['Horizontal'] : ORIENTATIONS).includes(shared.orientation)) errors.push('Orientation is incompatible with surface type.')
  if (!Number.isInteger(shared.startHour) || !Number.isInteger(shared.endHour) || shared.startHour < 0 || shared.endHour > 23 || shared.startHour > shared.endHour) errors.push('Hours must be integers from 0 to 23, with start ≤ end. Overnight ranges must be split.')
  if (!['preserve', 'clamp'].includes(shared.negativeHandling)) errors.push('Select a valid negative-load handling option.')
  if (materials.filter(m => m.isBaseline).length !== 1) errors.push('Select exactly one baseline material.')
  if (new Set(materials.map(m => m.id)).size !== materials.length) errors.push('Material IDs must be unique.')
  for (const material of materials) {
    if (!material.id || typeof material.name !== 'string' || !material.name.trim()) errors.push('Each material needs an ID and name.')
    if (typeof material.uValue !== 'number' || !Number.isFinite(material.uValue) || material.uValue <= 0) errors.push(`${material.name}: U-value must be greater than zero.`)
    if (!GROUPS.includes(material.groupNumber)) errors.push(`${material.name}: Select a group A–G.`)
    if (typeof material.colorFactor !== 'number' || !Number.isFinite(material.colorFactor) || material.colorFactor <= 0 || material.colorFactor > 1) errors.push(`${material.name}: Colour factor must be greater than zero and no greater than 1.`)
    if (!['dark', 'light', 'custom'].includes(material.surfaceColor)) errors.push(`${material.name}: Invalid surface colour.`)
    if (material.surfaceColor === 'dark' && material.colorFactor !== DARK_FACTOR || material.surfaceColor === 'light' && material.colorFactor !== LIGHT_FACTOR) errors.push(`${material.name}: Colour factor does not match the selected colour.`)
  }
  if (!errors.length) {
    try { getLatitudeMonthCorrection({ ...shared, dataset }) } catch (error) { errors.push(error.message) }
    for (const material of materials) for (let hour = shared.startHour; hour <= shared.endHour; hour++) {
      try { getBaseCLTD({ ...shared, groupNumber: material.groupNumber, hour, dataset }) } catch (error) { errors.push(error.message) }
    }
  }
  return [...new Set(errors)]
}
export function calcMaterialConductionLoad(material, sharedConditions, referenceDataset) {
  if (sharedConditions.unitSystem !== referenceDataset.metadata.unitSystem) throw new Error('Dataset units must match comparison units.')
  const lm = getLatitudeMonthCorrection({ ...sharedConditions, dataset: referenceDataset })
  const hourlyResults = []
  for (let hour = sharedConditions.startHour; hour <= sharedConditions.endHour; hour++) {
    const baseCLTD = getBaseCLTD({ ...sharedConditions, groupNumber: material.groupNumber, hour, dataset: referenceDataset })
    const details = correctedCLTD({ ...sharedConditions, baseCLTD, latitudeMonthCorrection: lm, colorFactor: material.colorFactor })
    hourlyResults.push({ hour, ...details, lm, correctedCLTD: details.appliedCorrectedCLTD, conductionLoad: conductionLoad(material.uValue, sharedConditions.area, details.appliedCorrectedCLTD) })
  }
  const peak = findPeak(hourlyResults)
  return { materialId: material.id, materialName: material.name, uValue: material.uValue, groupNumber: material.groupNumber, colorFactor: material.colorFactor, hourlyResults, peakLoad: peak.conductionLoad, peakHour: peak.hour, averageLoad: hourlyResults.reduce((sum, row) => sum + row.conductionLoad, 0) / hourlyResults.length }
}
export function comparisonFingerprint(materials, shared, dataset) { return JSON.stringify({ materials, shared, dataset }) }
export function compareMaterials(materials, sharedConditions, referenceDataset) {
  const errors = validateInputs(materials, sharedConditions, referenceDataset)
  if (errors.length) throw new Error(errors.join('\n'))
  const results = materials.map(m => calcMaterialConductionLoad(m, sharedConditions, referenceDataset))
  const baseline = results.find(r => r.materialId === materials.find(m => m.isBaseline).id)
  // Stable sort preserves user order for ties; competition ranks are 1, 1, 3.
  results.sort((a, b) => a.peakLoad - b.peakLoad)
  results.forEach((result, i) => {
    result.rank = i > 0 && result.peakLoad === results[i - 1].peakLoad ? results[i - 1].rank : i + 1
    result.differenceFromBaseline = result.peakLoad - baseline.peakLoad
    result.percentageDifferenceFromBaseline = baseline.peakLoad === 0 ? null : result.differenceFromBaseline / Math.abs(baseline.peakLoad) * 100
  })
  const warnings = []
  if (referenceDataset.metadata.isDemo) warnings.push(DEMO_WARNING)
  if (materials.some(m => m.surfaceColor === 'custom')) warnings.push('Custom colour factors are in use. Verify their applicability to the source method.')
  if (results.some(r => r.hourlyResults.some(h => h.rawCorrectedCLTD < 0))) warnings.push('Negative corrected CLTD occurs; preserved values represent outward heat flow.')
  if (results.some(r => r.hourlyResults.some(h => h.wasClamped))) warnings.push('Negative cooling loads were clamped to zero. Raw values remain in the calculation audit.')
  if (sharedConditions.startHour !== 0 || sharedConditions.endHour !== 23) warnings.push('The selected period may exclude the true daily peak.')
  const properties = materials.map(m => `${m.uValue}/${m.groupNumber}/${m.colorFactor}`)
  if (new Set(properties).size < properties.length) warnings.push('Some materials have identical comparison properties.')
  return {
    calculatedAt: new Date().toISOString(), fingerprint: comparisonFingerprint(materials, sharedConditions, referenceDataset),
    sharedConditions: structuredClone(sharedConditions), materials: structuredClone(materials), referenceDataset: structuredClone(referenceDataset),
    baselineId: baseline.materialId, results, warnings,
    assumptions: ['Opaque-surface conduction only; excludes windows, infiltration, ventilation, internal loads and whole-building sizing.', 'Exact latitude, month, orientation and hour lookups only. No interpolation or extrapolation.', 'Hours use the reference dataset’s time convention; no timezone or solar-time adjustment is applied.', 'Ranking compares each material’s own peak within the selected period. Equal peaks share a rank; earliest hour resolves timing ties.', 'U-values, assembly group assignments, colour factors and source tables require engineering verification.', 'SI and IP use the supplied independently rounded reference temperatures; converted runs can differ slightly.', 'Percentage differences use the absolute baseline peak as the denominator; zero baseline is reported as N/A.'],
  }
}
