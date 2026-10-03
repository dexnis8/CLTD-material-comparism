import { DEMO_WARNING, GROUPS, ORIENTATIONS } from '../app/config'
import { getBaseCLTD, getLatitudeMonthCorrection, validateDataset } from './reference'

// Reference design temperatures specified by this tool's CLTD method.
// SI and IP reference temperatures are independently rounded, as in the supplied equations.
export const REFERENCE_TEMPERATURES = { SI: { indoor: 25.5, outdoor: 29.4 }, IP: { indoor: 78, outdoor: 85 } }
export const DARK_FACTOR = 1.0
export const LIGHT_FACTOR = 0.65
export function correctedCLTD({ baseCLTD, latitudeMonthCorrection, colorFactor, indoorTemperature, averageOutdoorTemperature, unitSystem, negativeHandling = 'preserve' }) {
  const reference = REFERENCE_TEMPERATURES[unitSystem]
  if (!reference) throw new Error('Unsupported calculation units. To fix: open Comparison setup > Unit system and select SI (metric) or IP (imperial), then select matching tables in Reference data and run again.')
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
  if (!shared || typeof shared !== 'object' || Array.isArray(shared) || !Array.isArray(materials) || materials.some(m => !m || typeof m !== 'object' || Array.isArray(m))) return ['The project is missing valid comparison inputs or assemblies. To fix: open Settings > Import project JSON and load a valid backup, or export a backup before using New / reset project to re-enter your inputs.']
  if (!dataset) return ['No active reference dataset was found. To fix: open Reference data > Reference library and select a dataset matching your units and site. Use Import dataset if your verified tables are not listed, then Run comparison.']
  errors.push(...validateDataset(dataset))
  if (materials.length < 2) errors.push('At least two assemblies are needed to compare loads. To fix: open Materials > Add assembly, enter Assembly name, U-value and Reference group, then Save assembly. Repeat until there are at least two assemblies, then Run comparison.')
  for (const [key, label] of Object.entries({ area: 'Surface area', indoorTemperature: 'Indoor dry-bulb', outdoorDesignTemperature: 'Outdoor dry-bulb', dailyRange: 'Daily range', averageOutdoorTemperature: 'Outdoor average', latitude: 'Site latitude' })) {
    if (typeof shared[key] !== 'number' || !Number.isFinite(shared[key])) errors.push(`Comparison setup > ${label} is missing or is not a finite number (received: ${JSON.stringify(shared[key])}). To fix: enter a numeric value in this field using the displayed units, then Run comparison.`)
  }
  if (shared.area <= 0) errors.push('Comparison setup > Surface area must be greater than zero. To fix: enter the actual wall or roof area in the displayed units, then Run comparison.')
  if (shared.dailyRange < 0) errors.push('Comparison setup > Daily range cannot be negative. To fix: enter the daily high minus the daily low as zero or a positive number. If you use a derived average, click Derive outdoor average after correcting the range, then Run comparison.')
  if (Math.abs(shared.latitude) > 90) errors.push('Comparison setup > Location & design period > Site latitude must be between -90° and 90°. To fix: enter decimal degrees, using a minus sign for southern latitudes. Do not enter longitude here. Then Run comparison.')
  if (!Number.isInteger(shared.month) || shared.month < 1 || shared.month > 12) errors.push('Comparison setup > Design month is invalid. To fix: select your design month (January through December), then Run comparison.')
  if (!['SI', 'IP'].includes(shared.unitSystem) || dataset.metadata?.unitSystem !== shared.unitSystem) errors.push('Dataset units must match the comparison units. To fix: check Comparison setup > Unit system, then open Reference data > Reference library and select or import tables in that same SI or IP system. Switching project units converts inputs but does not convert reference tables. Do not just relabel a dataset; use values in the correct units, then Run comparison.')
  if (!['Wall', 'Roof'].includes(shared.surfaceType)) errors.push('Comparison setup > Surface type is invalid. To fix: select Wall or Roof for the surface being compared, then Run comparison.')
  if (!(shared.surfaceType === 'Roof' ? ['Horizontal'] : ORIENTATIONS).includes(shared.orientation)) errors.push('Comparison setup > Orientation is incompatible with Surface type. To fix: select N, NE, E, SE, S, SW, W or NW for a Wall. For a Roof, select Roof again to set Horizontal automatically, then Run comparison.')
  if (!Number.isInteger(shared.startHour) || !Number.isInteger(shared.endHour) || shared.startHour < 0 || shared.endHour > 23 || shared.startHour > shared.endHour) errors.push('Comparison setup > Location & design period has an invalid hour range. To fix: set Start hour and End hour to whole numbers from 0 (midnight) to 23 (11 pm), with Start hour no later than End hour. Both endpoints are included. For overnight periods run two comparisons (for example 22–23 and 0–6), exporting each result before changing the period.')
  if (!['preserve', 'clamp'].includes(shared.negativeHandling)) errors.push('Comparison setup > Negative cooling loads is invalid. To fix: select Preserve to keep outward heat flow as negative values, or Clamp to zero to report no cooling load for those hours, then Run comparison.')
  if (materials.filter(m => m.isBaseline).length !== 1) errors.push('Exactly one baseline assembly is needed to calculate differences. To fix: open Materials and choose Set as baseline beneath one assembly name, then Run comparison.')
  if (new Set(materials.map(m => m.id)).size !== materials.length) errors.push('Assemblies share an internal ID and cannot be distinguished. To fix: export a backup in Settings > Export project JSON, give every materials[].id a different non-empty string in that file, and reimport through Settings > Import project JSON.')
  for (const material of materials) {
    if (!material.id || typeof material.name !== 'string' || !material.name.trim()) errors.push('An assembly has no internal ID or name. To fix: open Materials, click its Edit button and enter Assembly name, then Save assembly. For a missing internal ID, export the project from Settings, give materials[].id a unique non-empty string in the JSON file and reimport it.')
    if (typeof material.uValue !== 'number' || !Number.isFinite(material.uValue) || material.uValue <= 0) errors.push(`Materials > ${material.name || "Unnamed assembly"} > U-value must be a finite number greater than zero. To fix: edit this assembly, enter its verified thermal transmittance (heat transfer per area and temperature difference) in the displayed units, then Save assembly and Run comparison.`)
    if (!GROUPS.includes(material.groupNumber)) errors.push(`Materials > ${material.name || "Unnamed assembly"} > Reference group is invalid. To fix: edit the assembly and select A–G according to its construction classification in your reference source, then Save assembly and Run comparison.`)
    if (typeof material.colorFactor !== 'number' || !Number.isFinite(material.colorFactor) || material.colorFactor <= 0 || material.colorFactor > 1) errors.push(`Materials > ${material.name || "Unnamed assembly"} > Custom colour factor K must be a finite number greater than zero and no greater than 1. To fix: edit the assembly and enter a verified factor in that range, or select Dark (1.00) or Light (0.65), then Save assembly and Run comparison.`)
    if (!['dark', 'light', 'custom'].includes(material.surfaceColor)) errors.push(`Materials > ${material.name || "Unnamed assembly"} > Exterior surface colour is invalid. To fix: edit the assembly and select Dark or Light, or enable advanced custom colour factor and select Custom with a verified value, then Save assembly and Run comparison.`)
    if (material.surfaceColor === 'dark' && material.colorFactor !== DARK_FACTOR || material.surfaceColor === 'light' && material.colorFactor !== LIGHT_FACTOR) errors.push(`Materials > ${material.name || "Unnamed assembly"}: Colour factor does not match the selected colour. To fix: edit the assembly and select Dark again for K = 1.00 or Light again for K = 0.65. For another verified factor enable Custom. Click Save assembly and Run comparison.`)
  }
  if (!errors.length) {
    try { getLatitudeMonthCorrection({ ...shared, dataset }) } catch (error) { errors.push(error.message) }
    for (const material of materials) for (let hour = shared.startHour; hour <= shared.endHour; hour++) {
      try { getBaseCLTD({ ...shared, groupNumber: material.groupNumber, hour, dataset }) } catch (error) { errors.push(`Assembly "${material.name}": ${error.message}`) }
    }
  }
  return [...new Set(errors)]
}
export function calcMaterialConductionLoad(material, sharedConditions, referenceDataset) {
  if (sharedConditions.unitSystem !== referenceDataset.metadata.unitSystem) throw new Error('Dataset units must match comparison units. To fix: check Comparison setup > Unit system and select matching tables in Reference data > Reference library, then Run comparison.')
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
