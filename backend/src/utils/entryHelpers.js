// Lógica compartida entre entries.controller.js e images.controller.js.
// Cuando una función la necesitan DOS controladores distintos, vive aquí
// en vez de que un controlador importe directamente de otro — así cada
// controlador se queda enfocado solo en manejar peticiones HTTP.

import { prisma } from '../config/prisma.js'
import { supabase, IMAGES_BUCKET } from '../config/supabase.js'

const SIGNED_URL_TTL = 60 * 60   // 1 hora, en segundos — cuánto dura cada URL firmada

// Busca la entrada de un usuario en una fecha dada; si no existe, la crea
// vacía. Esto permite subir una foto en un día donde el usuario todavía
// no ha escrito texto, sin obligarlo a guardar contenido primero.
export async function findOrCreateEntry(userId, date) {
  let entry = await prisma.entry.findUnique({
    where: { userId_date: { userId, date } }
  })
  if (!entry) {
    entry = await prisma.entry.create({
      data: { userId, date, title: '', content: '' }
    })
  }
  return entry
}

// Convierte un array de entradas (con .images trayendo storagePath, tal
// como sale de Prisma) en entradas listas para el cliente: cada imagen
// obtiene una "url" firmada y temporal en vez de exponer storagePath.
//
// Usamos createSignedUrls (PLURAL) para pedir todas las URLs de una sola
// vez — una sola llamada a Supabase sin importar cuántas entradas o
// imágenes haya en la respuesta, en vez de una llamada por imagen.
export async function attachSignedUrls(entryList) {
  const allPaths = entryList.flatMap(e => e.images.map(img => img.storagePath))
  if (allPaths.length === 0) return entryList

  const { data: signed, error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .createSignedUrls(allPaths, SIGNED_URL_TTL)

  if (error) {
    console.error('Error firmando URLs de Storage:', error)
    // Degradamos con gracia: devolvemos las entradas SIN url en vez de
    // tumbar toda la petición por un problema puntual de Storage.
    return entryList
  }

  const urlByPath = new Map(signed.map(s => [s.path, s.signedUrl]))

  return entryList.map(entry => ({
    ...entry,
    images: entry.images.map(({ storagePath, ...rest }) => ({
      ...rest,
      url: urlByPath.get(storagePath) || null
    }))
  }))
}