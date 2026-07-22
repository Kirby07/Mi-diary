// src/services/api.js
//
// Centraliza TODA la comunicación con el backend en un solo lugar.
// Sin esto, terminarías escribiendo fetch(...) con headers repetidos
// en cada componente que necesite datos — difícil de mantener si,
// por ejemplo, cambia la forma de adjuntar el token.

// En desarrollo, Vite expone variables de entorno con prefijo VITE_
// a través de import.meta.env. Crea un archivo .env en la raíz del
// frontend con: VITE_API_URL=http://localhost:3000

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'

import authRoutes from './routes/auth.routes.js'
import entriesRoutes from './routes/entries.routes.js'
import imagesRoutes from './routes/images.routes.js'

export const app = express()

// ── Middlewares globales ──────────────────────────────────────
// Se ejecutan en orden, para TODAS las peticiones, antes de llegar a
// cualquier ruta específica.

// helmet() añade automáticamente varios headers de seguridad HTTP:
// X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.
// Es el equivalente real a la tarjeta "Headers HTTP de seguridad" de
// la guía inicial — aquí ya no es una explicación, es código funcionando.
app.set('trust proxy', 1)   // necesario si tu app está detrás de un proxy (ej: Render o Heroku)
app.use(helmet())

// cors() controla qué orígenes (dominios) pueden hacer peticiones a esta
// API desde un navegador. Sin esto, CUALQUIER sitio web podría hacer
// fetch() a tu API desde el navegador de un usuario. Restringimos a
// solo el origen de tu frontend (definido en .env).
app.use(cors({
  origin: process.env.CORS_ORIGIN,   // ej: 'http://localhost:5173'
  credentials: true
}))

// express.json() parsea el body de las peticiones que llegan como JSON
// (Content-Type: application/json) y lo deja disponible en req.body.
// Sin esto, req.body sería undefined aunque el cliente mande JSON válido.
app.use(express.json({ limit: '100kb' }))   // límite de tamaño: previene payloads gigantes

// ── Rutas ──────────────────────────────────────────────────────
// Todo lo que llegue a /auth/* lo maneja auth.routes.js
// Todo lo que llegue a /entries/* lo maneja entries.routes.js
app.use('/auth', authRoutes)
app.use('/entries', entriesRoutes)

// images.routes.js se monta en la raíz porque sus rutas ya declaran
// sus propios prefijos completos ('/entries/:date/images', '/images/:id')
// — necesita convivir con entriesRoutes bajo el mismo prefijo /entries
// sin que Express los confunda entre sí.
app.use(imagesRoutes)

// Ruta simple de salud — útil para verificar que el servidor responde
// sin necesidad de autenticación (la usan los servicios de hosting
// para saber si tu app sigue viva).
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// ── Manejador de errores centralizado ──────────────────────────
// Express reconoce este middleware como "manejador de errores" porque
// tiene 4 parámetros (err, req, res, next) en vez de 3. Cualquier error
// que llegue aquí mediante next(err) — incluyendo los que captura
// asyncHandler — termina en esta función en vez de colgar el servidor.
//
// IMPORTANTE: este middleware debe declararse AL FINAL, después de
// todas las rutas — Express los aplica en el orden en que aparecen.
app.use((err, req, res, next) => {
  console.error(err)   // en producción, esto iría a un servicio de logging real

  // Los errores de Multer (archivo demasiado grande, demasiados
  // archivos, tipo no permitido) son errores del CLIENTE, no fallas
  // del servidor — les damos 400 con un mensaje claro en vez del
  // genérico 500 que usamos para todo lo demás.
  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE:  'La imagen supera el tamaño máximo permitido (8MB)',
      LIMIT_FILE_COUNT: 'Puedes subir un máximo de 5 imágenes a la vez'
    }
    return res.status(400).json({ error: messages[err.code] || err.message })
  }
  // Error lanzado por nuestro propio fileFilter en upload.middleware.js
  if (err.message?.startsWith('Solo se permiten imágenes')) {
    return res.status(400).json({ error: err.message })
  }

  // Nunca devolvemos err.message o err.stack al cliente para el resto
  // de errores: podrían filtrar detalles internos (rutas de archivos,
  // versiones de librerías, fragmentos de queries SQL) útiles para
  // un atacante.
  res.status(500).json({ error: 'Error interno del servidor' })
})
