// src/controllers/entries.controller.js
//
// CRUD = Create, Read, Update, Delete — las cuatro operaciones básicas
// sobre cualquier recurso. Aquí reemplazamos lo que antes hacía
// localStorage.setItem / getItem / removeItem en el frontend.
//
// Regla de seguridad que se repite en TODA función de este archivo:
// el userId SIEMPRE viene de req.userId (puesto por el middleware
// requireAuth tras verificar el JWT), JAMÁS del body o de query params
// que controla el cliente. Si no fuera así, cualquier usuario podría
// mandar el id de otra persona y leer o borrar sus entradas privadas.

import { prisma } from '../config/prisma.js'
import { sanitize } from '../utils/sanitize.js'

// ── GET /entries ────────────────────────────────────────────────
// Devuelve TODAS las entradas del usuario autenticado.
// Para un diario personal, traer todo de una vez es razonable
// (probablemente nunca superen unos pocos miles de registros).
// Si la app creciera mucho, aquí se añadiría paginación o un
// filtro por rango de fechas (?from=2026-01-01&to=2026-12-31).
export async function getEntries(req, res) {
  const entries = await prisma.entry.findMany({
    where: { userId: req.userId },
    orderBy: { date: 'desc' }
  })
  res.json(entries)
}

// ── PUT /entries/:date ──────────────────────────────────────────
// "Upsert" = UPDATE si ya existe una entrada en esa fecha, o
// INSERT si no existe. Esto refleja exactamente la misma lógica
// que ya tenías en App.vue (persistEntry), solo que ahora vive
// en el servidor y queda respaldada en disco real, no en el
// navegador de un solo dispositivo.
export async function upsertEntry(req, res) {
  const { date } = req.params           // viene de la URL: /entries/2026-06-18
  const { title, content, mood } = req.body

  // Validación de formato de fecha — protege contra basura como
  // "/entries/<script>" llegando hasta la base de datos.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido' })
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'El contenido no puede estar vacío' })
  }

  // Sanitizamos Y truncamos en el servidor, exactamente como en el
  // frontend — pero esta es la capa que realmente protege la base
  // de datos, porque un atacante puede saltarse el frontend entero.
  const data = {
    title:   sanitize(title || '').slice(0, 100),
    content: sanitize(content).slice(0, 10_000),
    mood:    mood || null
  }

  // prisma.entry.upsert necesita saber CÓMO identificar el registro
  // único a actualizar. Usamos la restricción compuesta que definimos
  // en schema.prisma: la combinación (userId, date) es única.
  const entry = await prisma.entry.upsert({
    where: {
      userId_date: {           // Prisma genera este nombre automáticamente
        userId: req.userId,    // a partir de @@unique([userId, date])
        date
      }
    },
    update: data,                          // si ya existe, solo actualiza estos campos
    create: { ...data, date, userId: req.userId }   // si no existe, crea el registro completo
  })

  res.json(entry)
}

// ── DELETE /entries/:date ───────────────────────────────────────
export async function deleteEntry(req, res) {
  const { date } = req.params

  // deleteMany (en vez de delete) porque nos permite filtrar por
  // userId Y date a la vez de forma segura. Si usáramos delete()
  // con solo el id de la entrada, tendríamos que verificar el
  // userId en una consulta separada antes — más código y una
  // ventana donde algo podría salir mal entre ambas consultas.
  const result = await prisma.entry.deleteMany({
    where: { userId: req.userId, date }
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Entrada no encontrada' })
  }

  res.status(204).send()   // 204 = "éxito, sin contenido que devolver"
}
