// src/app.js
//
// Este archivo configura la aplicación Express, pero NO la arranca
// (eso pasa en server.js). Separar ambas cosas es una práctica común
// porque te permite, por ejemplo, importar "app" en tests automatizados
// sin tener que levantar un servidor real escuchando en un puerto.

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'

import authRoutes from './routes/auth.routes.js'
import entriesRoutes from './routes/entries.routes.js'

export const app = express()

// ── Middlewares globales ──────────────────────────────────────
// Se ejecutan en orden, para TODAS las peticiones, antes de llegar a
// cualquier ruta específica.

// helmet() añade automáticamente varios headers de seguridad HTTP:
// X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.
// Es el equivalente real a la tarjeta "Headers HTTP de seguridad" de
// la guía inicial — aquí ya no es una explicación, es código funcionando.
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

  // Nunca devolvemos err.message o err.stack al cliente: podrían
  // filtrar detalles internos (rutas de archivos, versiones de
  // librerías, fragmentos de queries SQL) útiles para un atacante.
  res.status(500).json({ error: 'Error interno del servidor' })
})
