/**
 * Elimina etiquetas HTML y patrones peligrosos del texto ingresado.
 * Se aplica sobre el contenido ANTES de guardarlo en localStorage.
 * Esto protege contra inyecciones XSS en caso de que el contenido
 * se renderice como HTML en el futuro (v-html, SSR, etc.).
 *
 * Vue 3 ya escapa automáticamente las interpolaciones {{ }},
 * pero sanitizar en origen es siempre una buena práctica.
 */
export function sanitize(text = '') {
  return String(text)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // <script>
    .replace(/<[^>]+>/g, '')        // cualquier otra etiqueta HTML
    .replace(/javascript:/gi, '')   // protocol handler en atributos href
    .replace(/on\w+\s*=/gi, '')     // manejadores inline (onclick=, onerror=…)
    .replace(/data:/gi, '')         // data URIs (pueden transportar JS)
}
