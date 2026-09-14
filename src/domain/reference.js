import { GROUPS, ORIENTATIONS } from '../app/config'

const finite = value => typeof value === 'number' && Number.isFinite(value)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const numericKey = key => key.trim() !== '' && String(Number(key)) === key && Number.isFinite(Number(key))

// Strict exact-key lookups: no interpolation, extrapolation or implicit fallback.
export function getBaseCLTD({ groupNumber, surfaceType, orientation, hour, dataset }) {
  const value = dataset.cltd?.[groupNumber]?.[surfaceType]?.[orientation]?.[hour]
  if (!finite(value)) throw new Error(`Missing CLTD: ${groupNumber} / ${surfaceType} / ${orientation} / ${hour}:00`)
  return value
}
export function getLatitudeMonthCorrection({ latitude, month, orientation, dataset }) {
  const value = dataset.lm?.[latitude]?.[month]?.[orientation]
  if (!finite(value)) throw new Error(`Missing LM: ${latitude}° / month ${month} / ${orientation}. No interpolation is applied.`)
  return value
}
export function validateDataset(dataset) {
  const errors = []
  if (!object(dataset)) return ['Dataset must be an object.']
  const metadata = dataset.metadata
  if (!object(metadata)) errors.push('Required metadata is missing.')
  else {
    for (const key of ['id', 'name', 'source', 'edition', 'version', 'importedAt']) if (typeof metadata[key] !== 'string' || !metadata[key].trim()) errors.push(`Metadata ${key} is required.`)
    if (!['SI', 'IP'].includes(metadata.unitSystem)) errors.push('Unsupported dataset units. Use SI or IP.')
    if (!Number.isFinite(Date.parse(metadata.importedAt))) errors.push('importedAt must be a valid date.')
    if (typeof metadata.isDemo !== 'boolean') errors.push('Metadata isDemo must explicitly be true or false.')
    if (metadata.notes !== undefined && typeof metadata.notes !== 'string') errors.push('Metadata notes must be text.')
  }
  let cltdCount = 0, lmCount = 0
  if (!object(dataset.cltd)) errors.push('CLTD table is required.')
  else for (const [group, surfaces] of Object.entries(dataset.cltd)) {
    if (!GROUPS.includes(group)) errors.push(`Invalid group: ${group}`)
    if (!object(surfaces)) { errors.push(`Invalid group table: ${group}`); continue }
    for (const [surface, orientations] of Object.entries(surfaces)) {
      if (!['Wall', 'Roof'].includes(surface)) errors.push(`Invalid surface: ${surface}`)
      if (!object(orientations)) { errors.push('Invalid orientations table.'); continue }
      for (const [orientation, hours] of Object.entries(orientations)) {
        if (!(surface === 'Roof' ? ['Horizontal'] : ORIENTATIONS).includes(orientation)) errors.push(`Invalid orientation: ${surface} / ${orientation}`)
        if (!object(hours) || !Object.keys(hours).length) { errors.push('Empty or invalid hour table.'); continue }
        for (const [hour, value] of Object.entries(hours)) {
          cltdCount++
          if (!numericKey(hour) || !Number.isInteger(Number(hour)) || +hour < 0 || +hour > 23) errors.push(`Invalid hour: ${hour}`)
          if (!finite(value)) errors.push(`Missing or invalid CLTD: ${group}/${orientation}/${hour}`)
        }
      }
    }
  }
  if (!object(dataset.lm)) errors.push('LM table is required.')
  else for (const [latitude, months] of Object.entries(dataset.lm)) {
    if (!numericKey(latitude) || +latitude < -90 || +latitude > 90) errors.push(`Invalid latitude: ${latitude}`)
    if (!object(months)) { errors.push('Invalid month table.'); continue }
    for (const [month, orientations] of Object.entries(months)) {
      if (!numericKey(month) || !Number.isInteger(+month) || +month < 1 || +month > 12) errors.push(`Invalid month: ${month}`)
      if (!object(orientations) || !Object.keys(orientations).length) { errors.push('Empty or invalid LM orientation table.'); continue }
      for (const [orientation, value] of Object.entries(orientations)) {
        lmCount++
        if (![...ORIENTATIONS, 'Horizontal'].includes(orientation)) errors.push(`Invalid LM orientation: ${orientation}`)
        if (!finite(value)) errors.push(`Missing or invalid LM: ${latitude}/${month}/${orientation}`)
      }
    }
  }
  if (!cltdCount) errors.push('CLTD table is empty.')
  if (!lmCount) errors.push('LM table is empty.')
  return errors
}

// JSON.parse silently discards duplicate keys. Check each object's decoded keys first.
export function parseStrictJSON(text) {
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}[\]:,]|[^\s{}[\]:,]+/g) || []
  const stack = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '{') stack.push(new Set())
    else if (token === '[') stack.push(null)
    else if (token === '}' || token === ']') stack.pop()
    else if (token.startsWith('"') && tokens[i + 1] === ':' && stack.at(-1)) {
      const key = JSON.parse(token)
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Unsupported key: ${key}`)
      if (stack.at(-1).has(key)) throw new Error(`Duplicate JSON key: ${key}`)
      stack.at(-1).add(key)
    }
  }
  return JSON.parse(text)
}
export function referenceRows(dataset) {
  const rows = []
  for (const [group, surfaces] of Object.entries(dataset.cltd)) for (const [surface, orientations] of Object.entries(surfaces)) for (const [orientation, hours] of Object.entries(orientations)) for (const [hour, value] of Object.entries(hours)) rows.push({ table: 'CLTD', group, surface, orientation, hour, latitude: '', month: '', value })
  for (const [latitude, months] of Object.entries(dataset.lm)) for (const [month, orientations] of Object.entries(months)) for (const [orientation, value] of Object.entries(orientations)) rows.push({ table: 'LM', group: '', surface: '', orientation, hour: '', latitude, month, value })
  return rows
}
