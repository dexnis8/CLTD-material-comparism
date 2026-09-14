export const UNITS = {
  SI: { area: 'm²', u: 'W/m²·K', temperature: '°C', difference: 'K', load: 'W' },
  IP: { area: 'ft²', u: 'Btu/h·ft²·°F', temperature: '°F', difference: '°F', load: 'Btu/h' },
}
export function convert(value, kind, from, to) {
  if (value === '') return ''
  if (!['SI', 'IP'].includes(from) || !['SI', 'IP'].includes(to)) throw new Error('Unsupported conversion units.')
  if (from === to) return value
  const siToIp = from === 'SI'
  if (kind === 'temperature') return siToIp ? value * 1.8 + 32 : (value - 32) / 1.8
  const factors = { area: 10.76391041671, u: 0.1761101838, difference: 1.8, load: 3.412141633 }
  if (!(kind in factors)) throw new Error(`Unknown conversion: ${kind}`)
  return siToIp ? value * factors[kind] : value / factors[kind]
}
export function changeProjectUnits(project, to) {
  const from = project.shared.unitSystem
  const shared = { ...project.shared, unitSystem: to }
  shared.area = convert(shared.area, 'area', from, to)
  for (const key of ['indoorTemperature', 'outdoorDesignTemperature', 'averageOutdoorTemperature']) shared[key] = convert(shared[key], 'temperature', from, to)
  shared.dailyRange = convert(shared.dailyRange, 'difference', from, to)
  return { ...project, shared, materials: project.materials.map(m => ({ ...m, uValue: convert(m.uValue, 'u', from, to) })) }
}
