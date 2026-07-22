// Maneja la subida, el reposicionamiento/redimensionado, y el borrado
// de imágenes adjuntas a una entrada. A diferencia de entries.controller.js,
// aquí cada imagen se identifica por SU PROPIO id (no por fecha), porque
// una entrada puede tener varias fotos.

import crypto from 'node:crypto'
import sharp from 'sharp'
import { prisma } from '../config/prisma.js'
import { supabase, IMAGES_BUCKET } from '../config/supabase.js'
import { findOrCreateEntry, attachSignedUrls } from '../utils/entryHelpers.js'

const MAX_IMAGES_PER_ENTRY = 12
const MAX_DIMENSION = 2000       // px — de sobra para verse bien en cualquier pantalla
const JPEG_QUALITY = 85

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

// ── POST /entries/:date/images ────────────────────────────────────
export async function uploadImages(req, res) {
  const { date } = req.params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido' })
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' })
  }

  // Si el día todavía no tiene entrada de texto (el usuario sube una
  // foto antes de escribir nada), la creamos vacía automáticamente.
  const entry = await findOrCreateEntry(req.userId, date)

  const existingCount = await prisma.image.count({ where: { entryId: entry.id } })
  if (existingCount + req.files.length > MAX_IMAGES_PER_ENTRY) {
    return res.status(400).json({
      error: `Esta entrada ya tiene ${existingCount} imágenes. Máximo ${MAX_IMAGES_PER_ENTRY} por entrada.`
    })
  }

  const created = []
  const failed  = []

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i]
    try {
      // ── Reprocesar con sharp ──────────────────────────────────
      // Esto hace TRES cosas a la vez, y las tres importan:
      //
      //  1. .rotate() sin argumentos lee la orientación EXIF (los
      //     celulares suelen guardar "gira 90°" como metadato en vez
      //     de rotar los píxeles reales) y aplica esa rotación de
      //     verdad ANTES de que el paso 3 la elimine.
      //
      //  2. .resize() limita el tamaño máximo — protege contra
      //     "bombas de píxeles": un archivo pequeño en disco pero con
      //     dimensiones absurdas, diseñado para agotar memoria del
      //     servidor al intentar procesarlo.
      //
      //  3. Re-codificar la imagen DESDE CERO descarta cualquier byte
      //     que no sea información real de píxeles. Esto incluye
      //     metadatos EXIF (que pueden contener tu ubicación GPS
      //     exacta — un problema de privacidad real en un diario
      //     personal) y neutraliza los llamados "polyglot files":
      //     archivos construidos para ser una imagen válida Y OTRA
      //     COSA a la vez (como HTML o un script), dependiendo de
      //     qué programa los interprete. Al reconstruir el archivo
      //     píxel por píxel, cualquier payload escondido desaparece.
      const outputFormat = file.mimetype === 'image/png' ? 'png' : 'jpeg'
      const { data: buffer, info } = await sharp(file.buffer)
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true   // nunca agranda una imagen que ya era pequeña
        })
        .toFormat(outputFormat, { quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true })

      // Nunca confiamos en file.originalname (el nombre que manda el
      // cliente) para construir la ruta de guardado — podría contener
      // secuencias como "../../" o caracteres problemáticos. Generamos
      // un nombre propio, impredecible, con un UUID.
      const ext = outputFormat === 'png' ? 'png' : 'jpg'
      const storagePath = `${req.userId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(storagePath, buffer, {
          contentType: outputFormat === 'png' ? 'image/png' : 'image/jpeg',
          upsert: false
        })
      if (uploadError) throw uploadError

      // Posición inicial ligeramente escalonada: si subes 3 fotos a
      // la vez, no quedan exactamente superpuestas — el usuario las
      // reacomoda a su gusto arrastrándolas en el lienzo.
      const idx = existingCount + i
      const stagger = (idx % 5) * 4

      const image = await prisma.image.create({
        data: {
          entryId: entry.id,
          storagePath,
          naturalWidth:  info.width,
          naturalHeight: info.height,
          x: 5 + stagger,
          y: 5 + stagger,
          w: 30
        }
      })

      created.push(image)
    } catch (err) {
      console.error('Error procesando imagen', file.originalname, err)
      failed.push(file.originalname || 'archivo')
    }
  }

  if (created.length === 0) {
    return res.status(400).json({
      error: 'No se pudo procesar ninguna imagen. Verifica que sean archivos JPG/PNG válidos.'
    })
  }

  // Firmamos las URLs antes de responder, para que el frontend pueda
  // mostrar las fotos inmediatamente sin tener que recargar todas
  // las entradas desde cero.
  const [withUrls] = await attachSignedUrls([{ ...entry, images: created }])
  res.status(201).json({ images: withUrls.images, failed })
}

// ── PATCH /images/:id ────────────────────────────────────────────
// Actualiza posición (x, y) y/o ancho (w) de una imagen ya subida.
// Se llama al soltar el arrastre o el redimensionado en el lienzo.
export async function updateImage(req, res) {
  const { id } = req.params
  const { x, y, w } = req.body

  // "IDOR" (Insecure Direct Object Reference): el riesgo de rutas como
  // /images/:id es que CUALQUIER usuario autenticado podría mandar el
  // id de una imagen ajena e intentar editarla, si no verificamos
  // explícitamente que le pertenece a él. Por eso siempre traemos la
  // entrada dueña de la imagen (vía include) y comparamos su userId
  // contra req.userId — nunca confiamos en que "estar logueado" sea
  // suficiente, hay que estar autorizado para ESTE recurso específico.
  const image = await prisma.image.findUnique({
    where: { id },
    include: { entry: true }
  })

  if (!image || image.entry.userId !== req.userId) {
    // 404 en vez de 403 a propósito: no le confirmamos a quien está
    // probando ids ajenos que el recurso existe pero no es suyo —
    // simplemente "no existe" desde su punto de vista.
    return res.status(404).json({ error: 'Imagen no encontrada' })
  }

  // Nunca confiamos ciegamente en números que manda el cliente:
  // podrían ser negativos, gigantes, o no ser números en absoluto
  // (NaN pasaría silenciosamente a la base de datos sin este chequeo).
  const data = {}
  if (typeof x === 'number' && Number.isFinite(x)) data.x = clamp(x, 0, 100)
  if (typeof y === 'number' && Number.isFinite(y)) data.y = clamp(y, 0, 100)
  if (typeof w === 'number' && Number.isFinite(w)) data.w = clamp(w, 5, 100)

  const updated = await prisma.image.update({ where: { id }, data })

  // Igual que en el resto de la API, nunca exponemos storagePath al
  // cliente — es un detalle interno de cómo organizamos el bucket,
  // no algo que el frontend necesite (usa "id" para futuras peticiones).
  const { storagePath, ...safe } = updated
  res.json(safe)
}

// ── DELETE /images/:id ───────────────────────────────────────────
export async function deleteImage(req, res) {
  const { id } = req.params

  const image = await prisma.image.findUnique({
    where: { id },
    include: { entry: true }
  })

  if (!image || image.entry.userId !== req.userId) {
    return res.status(404).json({ error: 'Imagen no encontrada' })
  }

  // Borramos el archivo real de Storage ANTES que la fila de la base
  // de datos. Si lo hiciéramos al revés y el borrado de Storage
  // fallara después, quedaría un archivo huérfano en el bucket que ya
  // ninguna fila referencia — y sin esa fila, no habría forma de
  // encontrarlo después para limpiarlo.
  const { error: storageError } = await supabase.storage
    .from(IMAGES_BUCKET)
    .remove([image.storagePath])

  if (storageError) {
    console.error('Error borrando de Supabase Storage:', storageError)
    return res.status(500).json({ error: 'No se pudo borrar la imagen' })
  }

  await prisma.image.delete({ where: { id } })
  res.status(204).send()
}
