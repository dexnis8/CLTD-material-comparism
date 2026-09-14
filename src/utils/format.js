export const formatNumber = (value, digits = 1) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)
export const hourLabel = hour => `${String(hour).padStart(2, '0')}:00`
