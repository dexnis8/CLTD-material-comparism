import { MapPin, LockKeyhole, Calculator } from 'lucide-react'
import { MONTHS, ORIENTATIONS } from '../../app/config'
import { UNITS } from '../../domain/units'
import { Button, Field, Segmented } from '../../components/common'

export default function SharedConditions({ shared, onChange, onUnits }) {
  const unit = UNITS[shared.unitSystem]
  const set = (key, value) => onChange({ ...shared, [key]: value })
  const inputError = (key, label) => {
    if (typeof shared[key] !== 'number' || !Number.isFinite(shared[key])) return `${label} is missing or invalid. Enter a number in this field using the displayed units, then Run comparison.`
    if (key === 'area' && shared.area <= 0) return 'Surface area must be greater than zero. Enter the actual wall or roof area in the displayed units, then Run comparison.'
    if (key === 'latitude' && Math.abs(shared.latitude) > 90) return 'Site latitude is outside -90 to 90 degrees. Enter decimal degrees, negative for south; this field is latitude, not longitude.'
    if (key === 'dailyRange' && shared.dailyRange < 0) return 'Daily range cannot be negative. Enter the daily high minus the daily low. Click Derive outdoor average again if you use a calculated average.'
    if (['startHour', 'endHour'].includes(key)) {
      if (!Number.isInteger(shared[key]) || shared[key] < 0 || shared[key] > 23) return `${label} must be a whole number from 0 (midnight) to 23 (11 pm). Correct this field, then Run comparison.`
      if (shared.startHour > shared.endHour) return 'Start hour is later than End hour. Correct the range; for overnight periods, run and export separate comparisons before and after midnight.'
    }
  }
  const number = (key, label, unitLabel, extra = {}) => <Field label={label} unit={unitLabel} type="number" step="any" value={shared[key]} onChange={e => set(key, e.target.value === '' ? '' : Number(e.target.value))} error={inputError(key, label)} {...extra} />
  return <section className="panel shared-panel"><div className="panel-heading"><div><span className="eyebrow">01 / Shared inputs</span><h2>One surface. Same conditions.</h2></div><LockKeyhole size={19} /></div>
    <p className="panel-intro">Applied equally to every assembly in this comparison.</p>
    <div className="form-section">
      <Segmented label="Surface type" value={shared.surfaceType} options={[{ label: 'Wall', value: 'Wall' }, { label: 'Roof', value: 'Roof' }]} onChange={surfaceType => onChange({ ...shared, surfaceType, orientation: surfaceType === 'Roof' ? 'Horizontal' : 'W' })} />
      <div className="field-grid">{number('area', 'Surface area', unit.area, { min: 0 })}<Field label="Orientation">{id => <select id={id} disabled={shared.surfaceType === 'Roof'} value={shared.orientation} onChange={e => set('orientation', e.target.value)}>{(shared.surfaceType === 'Roof' ? ['Horizontal'] : ORIENTATIONS).map(v => <option key={v}>{v}</option>)}</select>}</Field></div>
      <Segmented label="Unit system" value={shared.unitSystem} options={[{ label: 'SI · Metric', value: 'SI' }, { label: 'IP · Imperial', value: 'IP' }]} onChange={onUnits} />
    </div>
    <div className="form-section"><h3><MapPin size={16} /> Location & design period</h3><div className="field-grid">{number('latitude', 'Site latitude', '°', { min: -90, max: 90 })}<Field label="Design month">{id => <select id={id} value={shared.month} onChange={e => set('month', Number(e.target.value))}>{MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}</select>}</Field>{number('startHour', 'Start hour', '0–23', { min: 0, max: 23, step: 1 })}{number('endHour', 'End hour', '0–23', { min: 0, max: 23, step: 1 })}</div><p className="helper">Your exact site latitude, design month and orientation must exist in Reference data &gt; Reference table inspector &gt; LM. The app does not estimate between listed latitudes. Hours follow the reference table’s time convention. End hour is included.</p></div>
    <div className="form-section"><h3><Calculator size={16} /> Design temperatures</h3><div className="field-grid">{number('indoorTemperature', 'Indoor dry-bulb', unit.temperature)}{number('outdoorDesignTemperature', 'Outdoor dry-bulb', unit.temperature)}{number('dailyRange', 'Daily range', unit.difference, { min: 0 })}{number('averageOutdoorTemperature', 'Outdoor average', unit.temperature)}</div><Button variant="text-button" onClick={() => set('averageOutdoorTemperature', shared.outdoorDesignTemperature - shared.dailyRange / 2)} disabled={shared.outdoorDesignTemperature === '' || shared.dailyRange === ''}>Derive outdoor average <span aria-hidden="true">↗</span></Button><p className="helper">Average = outdoor design − daily range / 2. Applied only when clicked; you can override it.</p></div>
    <div className="form-section"><Segmented label="Negative cooling loads" value={shared.negativeHandling} options={[{ label: 'Preserve', value: 'preserve' }, { label: 'Clamp to zero', value: 'clamp' }]} onChange={v => set('negativeHandling', v)} /><Field label="Scenario notes (optional)">{id => <textarea id={id} rows={2} value={shared.notes} onChange={e => set('notes', e.target.value)} placeholder="Record assumptions for this surface…" />}</Field></div>
  </section>
}
