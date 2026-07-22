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
import { supabase, IMAGES_BUCKET } from '../config/supabase.js'
import { sanitize } from '../utils/sanitize.js'
import { attachSignedUrls } from '../utils/entryHelpers.js'

// ── GET /entries ────────────────────────────────────────────────
// Devuelve TODAS las entradas del usuario autenticado, cada una con
// sus imágenes (si tiene) incluyendo una URL firmada y temporal para
// mostrarlas — el bucket de Storage es privado, así que no existe una
// URL pública fija para cada foto.
export async function getEntries(req, res) {
  const entries = await prisma.entry.findMany({
    where: { userId: req.userId },
    orderBy: { date: 'desc' },
    include: { images: true }
  })
  const withUrls = await attachSignedUrls(entries)
  res.json(withUrls)
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
  //
  // include: { images: true } es importante aquí: el frontend
  // reemplaza entries.value[date] completo con lo que devuelve este
  // endpoint (ver persistEntry en App.vue) — si no incluyéramos las
  // imágenes, cada vez que el usuario guardara texto, las fotos
  // desaparecerían momentáneamente de la pantalla hasta la próxima
  // recarga completa.
  const entry = await prisma.entry.upsert({
    where: {
      userId_date: {           // Prisma genera este nombre automáticamente
        userId: req.userId,    // a partir de @@unique([userId, date])
        date
      }
    },
    update: data,                          // si ya existe, solo actualiza estos campos
    create: { ...data, date, userId: req.userId },   // si no existe, crea el registro completo
    include: { images: true }
  })

  const [withUrls] = await attachSignedUrls([entry])
  res.json(withUrls)
}

// ── DELETE /entries/:date ───────────────────────────────────────
export async function deleteEntry(req, res) {
  const { date } = req.params

  const entry = await prisma.entry.findUnique({
    where: { userId_date: { userId: req.userId, date } },
    include: { images: true }
  })

  if (!entry) {
    return res.status(404).json({ error: 'Entrada no encontrada' })
  }

  // La relación Image → Entry tiene onDelete: Cascade en schema.prisma,
  // así que borrar la fila de Entry borra automáticamente las filas de
  // Image en Postgres. PERO Postgres no sabe nada sobre Supabase
  // Storage — los ARCHIVOS reales hay que borrarlos nosotros mismos
  // aquí, o quedarían huérfanos en el bucket, ocupando espacio para
  // siempre sin que ninguna fila los referencie.
  if (entry.images.length > 0) {
    const paths = entry.images.map(img => img.storagePath)
    const { error } = await supabase.storage.from(IMAGES_BUCKET).remove(paths)
    if (error) {
      // No abortamos el borrado de la entrada por esto — preferimos
      // completar la acción que el usuario pidió y solo dejar
      // constancia en logs, en vez de bloquearlo por un problema
      // secundario de limpieza de almacenamiento.
      console.error('Error borrando imágenes de Storage:', error)
    }
  }

  await prisma.entry.delete({ where: { id: entry.id } })
  res.status(204).send()
}