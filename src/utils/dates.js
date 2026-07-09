const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAYS_FULL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS     = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

/** Convierte un Date en clave 'YYYY-MM-DD'. */
export function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Convierte una clave 'YYYY-MM-DD' en Date (medianoche local). */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Ej: 'Martes, 18 de junio de 2026' */
export function fullDate(dateStr) {
  const d = parseDate(dateStr)
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

/**
 * Devuelve los 7 días (lun → dom) de la semana indicada por el offset.
 * offset=0 → semana actual, -1 → semana anterior, +1 → siguiente, etc.
 */
export function getWeekDays(offset = 0) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow  = today.getDay()
  const diff = dow === 0 ? -6 : 1 - dow          // desplazamiento hasta el lunes
  const mon  = new Date(today)
  mon.setDate(today.getDate() + diff + offset * 7)

  return Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(mon)
    d.setDate(mon.getDate() + i)
    const key = fmtDate(d)
    return { key, short: DAYS_SHORT[i], num: d.getDate(), isToday: key === fmtDate(today) }
  })
}

/** Ej: '16 – 22 de junio, 2026' o '30 jun – 6 jul, 2026' */
export function buildWeekLabel(days) {
  const first = parseDate(days[0].key)
  const last  = parseDate(days[6].key)
  const fm = MONTHS[first.getMonth()]
  const lm = MONTHS[last.getMonth()]
  const fy = first.getFullYear()
  const ly = last.getFullYear()
  if (fy !== ly) return `${first.getDate()} ${fm} ${fy} – ${last.getDate()} ${lm} ${ly}`
  if (fm !== lm) return `${first.getDate()} ${fm} – ${last.getDate()} ${lm} ${ly}`
  return `${first.getDate()} – ${last.getDate()} de ${fm}, ${fy}`
}
