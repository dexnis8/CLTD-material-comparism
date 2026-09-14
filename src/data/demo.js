import { DEMO_WARNING, SCHEMA_VERSION } from '../app/config'
// Synthetic teaching fixtures, deliberately limited to 40° latitude / July / west wall and roof.
// These profiles are NOT transcribed, verified or derived from an ASHRAE table.
const profiles = {
  A: [4, 3, 2, 2, 1, 1, 2, 4, 7, 10, 13, 16, 19, 22, 24, 25, 24, 21, 17, 13, 10, 8, 6, 5],
  B: [6, 5, 4, 3, 3, 2, 2, 3, 5, 7, 10, 13, 16, 19, 21, 23, 24, 23, 21, 17, 13, 10, 8, 7],
  C: [8, 7, 6, 5, 4, 3, 3, 3, 4, 5, 7, 10, 13, 16, 19, 21, 23, 24, 23, 21, 18, 15, 12, 10],
  D: [10, 9, 8, 7, 6, 5, 4, 4, 4, 5, 6, 8, 10, 13, 16, 18, 20, 22, 23, 22, 20, 17, 14, 12],
  E: [12, 11, 10, 9, 8, 7, 6, 5, 5, 5, 6, 7, 9, 11, 13, 15, 17, 19, 21, 22, 21, 19, 16, 14],
  F: [13, 12, 11, 10, 9, 8, 7, 6, 6, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 21, 21, 20, 18, 15],
  G: [14, 13, 12, 11, 10, 9, 8, 7, 7, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 20, 20, 18, 16],
}
export const demoDataset = {
  metadata: { id: 'demo-si-v1', name: 'Illustrative assembly profiles', source: DEMO_WARNING, edition: 'Synthetic teaching fixture', unitSystem: 'SI', version: '1.0', importedAt: '2026-01-01T00:00:00.000Z', isDemo: true, notes: '40° latitude, July, west-facing walls and horizontal roofs, hours 0–23. Group letters and roof curves are illustrative, not authoritative assembly classifications. Hours are illustrative local design hours.' },
  cltd: Object.fromEntries(Object.entries(profiles).map(([group, values]) => [group, { Wall: { W: Object.fromEntries(values.map((v, h) => [h, v])) }, Roof: { Horizontal: Object.fromEntries(values.map((v, h) => [h, v + 3])) } }])),
  lm: { 40: { 7: { W: 1.5, Horizontal: 0.5 } } },
}
export const defaultMaterial = () => ({ id: crypto.randomUUID(), name: 'New assembly', description: '', uValue: 0.45, groupNumber: 'C', surfaceColor: 'light', colorFactor: 0.65, isBaseline: false })
export function createProject(sample = true) {
  return {
    schemaVersion: SCHEMA_VERSION, id: crypto.randomUUID(), name: sample ? 'West façade · Assembly study' : 'Untitled comparison', description: 'A controlled comparison of opaque wall assemblies under the same summer design conditions.',
    shared: { surfaceType: 'Wall', area: 20, unitSystem: 'SI', orientation: 'W', latitude: 40, month: 7, startHour: 0, endHour: 23, indoorTemperature: 24, outdoorDesignTemperature: 35, dailyRange: 12, averageOutdoorTemperature: 29, negativeHandling: 'preserve', notes: '' },
    materials: sample ? [
      { ...defaultMaterial(), name: 'Brick veneer', description: 'Illustrative baseline assembly; verify U-value and group.', uValue: 1.2, groupNumber: 'B', surfaceColor: 'dark', colorFactor: 1, isBaseline: true },
      { ...defaultMaterial(), name: 'Insulated concrete', description: 'Illustrative insulated heavyweight assembly.', uValue: 0.45, groupNumber: 'E' },
      { ...defaultMaterial(), name: 'Timber frame', description: 'Illustrative insulated lightweight assembly.', uValue: 0.35, groupNumber: 'A' },
    ] : [], datasets: [structuredClone(demoDataset)], activeDatasetId: demoDataset.metadata.id, calculation: null,
  }
}
