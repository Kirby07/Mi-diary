// src/utils/sanitize.js
//
// IMPORTANTE: esta función es casi idéntica a la que ya tienes en el
// frontend (src/utils/sanitize.js del proyecto Vue). Eso es intencional.
//
// Regla de seguridad backend: "Nunca confíes en el cliente."
// El frontend puede sanitizar todo lo que quiera, pero un atacante
// puede ignorarlo por completo y mandar peticiones HTTP directamente
// al servidor (con curl, Postman, o un script). La ÚNICA sanitización
// que realmente protege tu base de datos es la que ocurre AQUÍ,
// del lado del servidor, justo antes de guardar.

export function sanitize(text = '') {
  return String(text)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
}
