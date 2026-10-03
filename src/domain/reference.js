import { GROUPS, MONTHS, ORIENTATIONS } from '../app/config'

const finite = value => typeof value === 'number' && Number.isFinite(value)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const numericKey = key => key.trim() !== '' && String(Number(key)) === key && Number.isFinite(Number(key))
const direction = value => ({ N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest', Horizontal: 'horizontal' })[value] || value
const available = values => values.length ? values.join(', ') : 'none'
const sourceName = dataset => dataset?.metadata?.name || 'the selected dataset'

function referenceIssue(path, problem, fix) {
  return `Reference data — ${path}: ${problem} To fix: open the source JSON file at ${path} (or the corresponding CSV row), ${fix} Then open Reference data > Import dataset and select the corrected file. Use JSON template or CSV template under Start with a template if you need the file layout.`
}

// Strict exact-key lookups: no interpolation, extrapolation or implicit fallback.
export function getBaseCLTD({ groupNumber, surfaceType, orientation, hour, dataset }) {
  const hours = dataset?.cltd?.[groupNumber]?.[surfaceType]?.[orientation]
  const value = hours?.[hour]
  if (!finite(value)) throw new Error(`Missing CLTD (cooling load temperature difference): “${sourceName(dataset)}” has no numeric value for group ${groupNumber}, ${surfaceType}, ${direction(orientation)} (${orientation}), ${hour}:00. Available hours for this combination: ${available(Object.keys(hours || {}).filter(key => finite(hours[key])))}. To fix: open Reference data > Reference table inspector, select CLTD and inspect this group, surface and orientation. In Comparison setup, verify Surface type, Orientation, Start hour and End hour; in Materials, click the affected assembly > Reference group and correct it only if its assignment is wrong. If the inputs are correct, use Dataset JSON to download the active table, obtain the missing value from your verified reference source, add it at cltd[${groupNumber}][${surfaceType}][${orientation}][${hour}], then use Import dataset and Run comparison. Every selected hour needs a value; do not invent one or shorten the design period just to bypass this error.`)
  return value
}
export function getLatitudeMonthCorrection({ latitude, month, orientation, dataset }) {
  const value = dataset?.lm?.[latitude]?.[month]?.[orientation]
  if (!finite(value)) {
    const lm = dataset?.lm || {}
    const latitudes = Object.keys(lm).filter(key => finite(lm[key]?.[month]?.[orientation]))
    throw new Error(`Missing LM (latitude/month correction): “${sourceName(dataset)}” has no numeric correction for site latitude ${latitude}°, ${MONTHS[month - 1] || 'unknown month'} (month ${month}), ${direction(orientation)} (${orientation}). LM adjusts the reference cooling load for location and season. Available latitudes for this month and orientation: ${available(latitudes.map(key => `${key}°`))}. All latitude entries in this dataset: ${available(Object.keys(lm).map(key => `${key}°`))}. To fix: 1. Open Comparison setup > Location & design period and verify Site latitude and Design month; also verify Orientation. Correct these only if they do not describe your site. 2. Open Reference data > Reference table inspector and select LM to inspect coverage. 3. If your inputs are correct, use Dataset JSON to download the active table, obtain a verified correction for this exact combination and add it at lm[${latitude}][${month}][${orientation}] in the file, then use Import dataset. You can also select another verified dataset covering your site from Reference library. 4. Run comparison again. No interpolation is applied: the app cannot estimate between listed latitudes or substitute a nearby location. Do not change the real site latitude or use an assumed zero to bypass missing data.`)
  }
  return value
}
export function validateDataset(dataset) {
  const errors = []
  if (!object(dataset)) return [referenceIssue('root', 'Dataset must be an object.', 'use one JSON object containing metadata, cltd and lm, not an array, null or plain text.')]
  const metadata = dataset.metadata
  if (!object(metadata)) errors.push(referenceIssue('metadata', 'Required metadata is missing.', 'add the metadata object shown in the template to identify the source and units.'))
  else {
    for (const key of ['id', 'name', 'source', 'edition', 'version', 'importedAt']) if (typeof metadata[key] !== 'string' || !metadata[key].trim()) errors.push(referenceIssue(`metadata.${key}`, 'A non-empty text value is required.', `enter the ${key} for this dataset; use the template for an example.`))
    if (!['SI', 'IP'].includes(metadata.unitSystem)) errors.push(referenceIssue('metadata.unitSystem', 'Unsupported dataset units.', 'set SI for metric or IP for imperial, matching the actual table values; changing a label does not convert values.'))
    if (!Number.isFinite(Date.parse(metadata.importedAt))) errors.push(referenceIssue('metadata.importedAt', 'The import date is invalid.', 'enter a date such as 2026-01-15T12:00:00Z.'))
    if (typeof metadata.isDemo !== 'boolean') errors.push(referenceIssue('metadata.isDemo', 'The demonstration flag must be true or false.', 'use true for synthetic examples or false for real reference data; JSON booleans must not have quotation marks.'))
    if (metadata.notes !== undefined && typeof metadata.notes !== 'string') errors.push(referenceIssue('metadata.notes', 'Notes must be text.', 'put notes in quotation marks or remove this optional field.'))
  }
  let cltdCount = 0, lmCount = 0
  if (!object(dataset.cltd)) errors.push(referenceIssue('cltd', 'CLTD table is required.', 'add cooling load temperature differences arranged as group > surface > orientation > hour > numeric value.'))
  else for (const [group, surfaces] of Object.entries(dataset.cltd)) {
    if (!GROUPS.includes(group)) errors.push(referenceIssue(`cltd[${group}]`, 'Invalid group.', 'use a group letter A–G verified against the source assembly classification.'))
    if (!object(surfaces)) { errors.push(referenceIssue(`cltd[${group}]`, 'Invalid group table.', 'supply an object containing Wall or Roof tables.')); continue }
    for (const [surface, orientations] of Object.entries(surfaces)) {
      if (!['Wall', 'Roof'].includes(surface)) errors.push(referenceIssue(`cltd[${group}][${surface}]`, 'Invalid surface.', 'use Wall or Roof with exactly this capitalization.'))
      if (!object(orientations)) { errors.push(referenceIssue(`cltd[${group}][${surface}]`, 'Invalid orientations table.', 'supply an object keyed by compass direction for Wall or Horizontal for Roof.')); continue }
      for (const [orientation, hours] of Object.entries(orientations)) {
        const path = `cltd[${group}][${surface}][${orientation}]`
        if (!(surface === 'Roof' ? ['Horizontal'] : ORIENTATIONS).includes(orientation)) errors.push(referenceIssue(path, 'Invalid orientation.', `use ${surface === 'Roof' ? 'Horizontal' : ORIENTATIONS.join(', ')} for ${surface}.`))
        if (!object(hours) || !Object.keys(hours).length) { errors.push(referenceIssue(path, 'Empty or invalid hour table.', 'add hour keys from 0 to 23 with numeric CLTD values from your source.')); continue }
        for (const [hour, value] of Object.entries(hours)) {
          cltdCount++
          if (!numericKey(hour) || !Number.isInteger(Number(hour)) || +hour < 0 || +hour > 23) errors.push(referenceIssue(`${path}[${hour}]`, 'Invalid hour.', 'use an integer key from 0 to 23, without leading zeros or :00.'))
          if (!finite(value)) errors.push(referenceIssue(`${path}[${hour}]`, 'Missing or invalid CLTD value.', 'enter a finite number from the verified source in the declared units, without quotes in JSON.'))
        }
      }
    }
  }
  if (!object(dataset.lm)) errors.push(referenceIssue('lm', 'LM (latitude/month correction) table is required.', 'add corrections arranged as latitude > month > orientation > numeric value.'))
  else for (const [latitude, months] of Object.entries(dataset.lm)) {
    if (!numericKey(latitude) || +latitude < -90 || +latitude > 90) errors.push(referenceIssue(`lm[${latitude}]`, 'Invalid latitude.', 'use a numeric key between -90 and 90, such as 7.38 or 40, without degree signs or trailing zeros.'))
    if (!object(months)) { errors.push(referenceIssue(`lm[${latitude}]`, 'Invalid month table.', 'supply an object keyed by month number, 1 for January through 12 for December.')); continue }
    for (const [month, orientations] of Object.entries(months)) {
      const path = `lm[${latitude}][${month}]`
      if (!numericKey(month) || !Number.isInteger(+month) || +month < 1 || +month > 12) errors.push(referenceIssue(path, 'Invalid month.', 'use an integer key from 1 (January) to 12 (December), without leading zeros.'))
      if (!object(orientations) || !Object.keys(orientations).length) { errors.push(referenceIssue(path, 'Empty or invalid LM orientation table.', 'add an orientation key and its verified numeric correction, such as W for west or Horizontal for a roof.')); continue }
      for (const [orientation, value] of Object.entries(orientations)) {
        lmCount++
        if (![...ORIENTATIONS, 'Horizontal'].includes(orientation)) errors.push(referenceIssue(`${path}[${orientation}]`, 'Invalid LM orientation.', `use ${ORIENTATIONS.join(', ')} or Horizontal.`))
        if (!finite(value)) errors.push(referenceIssue(`${path}[${orientation}]`, 'Missing or invalid LM value.', 'enter a finite numeric latitude/month correction from your source in the declared units; do not use quoted numbers or null.'))
      }
    }
  }
  if (!cltdCount) errors.push(referenceIssue('cltd', 'CLTD table is empty.', 'add at least one verified hourly CLTD entry using the template layout.'))
  if (!lmCount) errors.push(referenceIssue('lm', 'LM table is empty.', 'add at least one verified latitude/month/orientation correction using the template layout.'))
  return errors
}

// JSON.parse silently discards duplicate keys. Check each object's decoded keys first.
export function parseStrictJSON(text) {
  try { JSON.parse(text) } catch (error) {
    throw new Error(`The JSON file cannot be read because its syntax is invalid. To fix: open the file in a JSON-aware text editor and correct the location reported below; check for missing commas, double quotes or closing braces. Save as .json and import again using Settings > Import project JSON for a project, or Reference data > Import dataset for reference tables. Parser details: ${error.message}`, { cause: error })
  }
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}[\]:,]|[^\s{}[\]:,]+/g) || []
  const stack = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '{') stack.push(new Set())
    else if (token === '[') stack.push(null)
    else if (token === '}' || token === ']') stack.pop()
    else if (token.startsWith('"') && tokens[i + 1] === ':' && stack.at(-1)) {
      const key = JSON.parse(token)
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Unsupported JSON key: "${key}" is reserved and cannot be imported. To fix: search the source file for this property and remove or rename it according to the project or reference template, then save and import the corrected file again.`)
      if (stack.at(-1).has(key)) throw new Error(`Duplicate JSON key: "${key}" appears more than once in the same object, making its value ambiguous. To fix: search the source file for "${key}", keep one verified value in that object, then save and import the corrected file again. The same key in separate objects is allowed.`)
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
