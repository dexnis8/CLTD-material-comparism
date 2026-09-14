import { PALETTE } from '../app/config'
import { formatNumber, hourLabel } from '../utils/format'
export function PeakChart({ results, unit, colors }) {
  const max = Math.max(...results.map(r => Math.abs(r.peakLoad)), 1)
  return <div className="bar-chart" role="img" aria-label={`Peak conduction loads in ${unit}. Exact values in the ranked results table.`}>{results.map(r => <div className="bar-row" key={r.materialId}><div className="bar-label"><span>{r.materialName}</span><strong>{formatNumber(r.peakLoad)} <small>{unit}</small></strong></div><div className="bar-track"><div style={{ width: `${Math.max(Math.abs(r.peakLoad) / max * 100, 0.2)}%`, background: colors[r.materialId] }} /></div><small>Peak at {hourLabel(r.peakHour)}{r.peakLoad < 0 ? ' · outward heat flow' : ''}</small></div>)}</div>
}
export function HourlyChart({ results, colors, metric, unit, selectedHour, onHour }) {
  const all = results.flatMap(r => r.hourlyResults.map(h => h[metric]))
  const min = Math.min(0, ...all), max = Math.max(1, ...all), span = max - min || 1
  const hours = results[0]?.hourlyResults.map(h => h.hour) || []
  const x = h => 54 + (h - (hours[0] || 0)) / Math.max(1, (hours.at(-1) || 0) - (hours[0] || 0)) * 626
  const y = value => 216 - (value - min) / span * 180
  return <svg className="line-chart" viewBox="0 0 710 258" role="img" aria-label={`Hourly ${metric === 'conductionLoad' ? 'conduction load' : 'corrected CLTD'} in ${unit}. Select an hour below for numeric values.`}><text x="8" y="15" className="chart-unit">{unit}</text>{Array.from({ length: 5 }, (_, i) => min + span * i / 4).map(value => <g key={value}><line x1="54" x2="680" y1={y(value)} y2={y(value)} className="chart-grid" /><text x="43" y={y(value) + 4} textAnchor="end">{formatNumber(value, 0)}</text></g>)}{hours.filter((_, i) => i % Math.max(1, Math.ceil(hours.length / 8)) === 0 || i === hours.length - 1).map(hour => <text key={hour} x={x(hour)} y="241" textAnchor="middle">{hourLabel(hour)}</text>)}{hours.includes(selectedHour) && <line x1={x(selectedHour)} x2={x(selectedHour)} y1="30" y2="216" stroke="#AAA89F" strokeDasharray="4 4" />}{results.map((r, index) => <g key={r.materialId}><polyline points={r.hourlyResults.map(h => `${x(h.hour)},${y(h[metric])}`).join(' ')} fill="none" stroke={colors[r.materialId] || PALETTE[index % PALETTE.length]} strokeWidth="2.5" strokeDasharray={index % 3 === 1 ? '7 3' : index % 3 === 2 ? '2 3' : undefined} />{r.hourlyResults.map(h => <circle key={h.hour} cx={x(h.hour)} cy={y(h[metric])} r={h.hour === selectedHour ? 5 : 2.5} fill={colors[r.materialId]} stroke="var(--surface)" strokeWidth="1" onClick={() => onHour(h.hour)}><title>{r.materialName} · {hourLabel(h.hour)} · {formatNumber(h[metric], 4)} {unit}</title></circle>)}</g>)}</svg>
}
