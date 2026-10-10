// Aplica tema, tipografía, tamaño y color de acento al documento.
// La usan App.vue (config local del dueño) y SharedView.vue (la config
// que el dueño compartió junto a su link).
export function applyTheme({ theme, font, fontSize, accent }) {
  const el = document.getElementById('app')
  if (!el) return
  el.className = `th-${theme} ff-${font} fs-${fontSize}`
  document.documentElement.style.setProperty('--a', accent)
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent)
  if (m) document.documentElement.style.setProperty('--ad', `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},.15)`)
}
