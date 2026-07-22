// src/services/api.js
// Centraliza TODA la comunicación con el backend en un solo lugar.
// Sin esto, terminarías escribiendo fetch(...) con headers repetidos
// en cada componente que necesite datos — difícil de mantener si,
// por ejemplo, cambia la forma de adjuntar el token.

// En desarrollo, Vite expone variables de entorno con prefijo VITE_
// a través de import.meta.env. Crea un archivo .env en la raíz del
// frontend con: VITE_API_URL=http://localhost:3000
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Guardamos el token en memoria (variable de módulo) y en
// localStorage. El localStorage aquí NO guarda datos del diario
// (eso ya vive en Postgres) — solo guarda la "llave de sesión"
// para no pedir login cada vez que se recarga la página.
let token = localStorage.getItem('diary:token') || null

export function setToken(newToken) {
  token = newToken
  if (newToken) {
    localStorage.setItem('diary:token', newToken)
  } else {
    localStorage.removeItem('diary:token')
  }
}

export function getToken() {
  return token
}

// Función interna que usan todas las demás — centraliza headers,
// manejo de errores HTTP, y parseo de JSON.
async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData

  const headers = {
    // OJO: si el body es FormData (subida de archivos), NO fijamos
    // Content-Type manualmente. El navegador necesita generarlo él
    // mismo, porque incluye un "boundary" único que separa cada
    // archivo dentro de la petición — si lo sobreescribimos con
    // 'application/json', el backend no podría leer los archivos.
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers
  }

  // Si hay token guardado, lo adjuntamos automáticamente.
  // Así ningún componente tiene que acordarse de hacerlo manualmente.
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  // fetch() NO lanza una excepción cuando el servidor responde 400/401/500
  // —solo lo hace si la red falla por completo. Por eso comprobamos
  // res.ok manualmente y lanzamos el error nosotros mismos.
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error || 'Error de red', res.status)
  }

  // 204 No Content no tiene body que parsear (lo usa DELETE /entries/:date)
  if (res.status === 204) return null

  return res.json()
}

// Clase de error personalizada para distinguir errores de la API
// (con un status HTTP claro) de otros errores genéricos de JavaScript.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// ── Auth ────────────────────────────────────────────────────────
export function register(email, password, name) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) })
}

export function login(email, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

// ── Entradas ────────────────────────────────────────────────────
export function fetchEntries() {
  return request('/entries')
}

export function saveEntry(date, data) {
  // PUT es "idempotente" por convención HTTP: llamarlo una vez o diez
  // veces con los mismos datos produce el mismo resultado final. Por
  // eso lo usamos para upsert (crear-o-actualizar) en vez de POST.
  return request(`/entries/${date}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function removeEntry(date) {
  return request(`/entries/${date}`, { method: 'DELETE' })
}

// ── Imágenes ────────────────────────────────────────────────────
// Whitelist de tipos aceptados — MISMA lista que el backend
// (upload.middleware.js). Validar aquí también da feedback inmediato
// al usuario sin esperar un viaje de ida y vuelta al servidor, pero
// la validación que realmente protege es la del servidor: cualquiera
// puede saltarse este chequeo mandando la petición directamente.
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024   // 8MB, igual que el backend

// Sube una o más imágenes a la entrada de una fecha dada.
// files: array de objetos File (los que vienen de <input type="file"> o
// de un evento drop).
export function uploadImages(date, files) {
  const formData = new FormData()
  // 'images' debe llamarse EXACTAMENTE igual que en
  // upload.array('images', 5) del backend — FormData no tiene forma
  // de "adivinar" el nombre de campo que Multer espera.
  for (const file of files) formData.append('images', file)

  return request(`/entries/${date}/images`, { method: 'POST', body: formData })
}

// Actualiza posición/tamaño tras arrastrar o redimensionar en el lienzo.
export function updateImage(id, { x, y, w }) {
  return request(`/images/${id}`, { method: 'PATCH', body: JSON.stringify({ x, y, w }) })
}

export function deleteImage(id) {
  return request(`/images/${id}`, { method: 'DELETE' })
}
