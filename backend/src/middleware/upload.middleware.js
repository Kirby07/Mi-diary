// Multer es quien sabe leer peticiones "multipart/form-data" — el formato
// que usan los navegadores para subir archivos. express.json() (que usamos
// para el resto de la API) NO puede leer archivos, solo JSON — por eso
// esta ruta necesita su propio middleware especializado.
//
// Decisión importante: storage: multer.memoryStorage()
// Esto mantiene el archivo subido como un Buffer en memoria RAM,
// NUNCA lo escribe al disco de Render. Dos razones:
//   1. El disco de Render es efímero — cualquier archivo escrito ahí
//      desaparece en el próximo redeploy o reinicio.
//   2. Ni siquiera lo necesitamos: el archivo solo pasa "de paso" por
//      el servidor camino a Supabase Storage, que es donde vive de verdad.

import multer from 'multer'

// Whitelist de tipos MIME aceptados. "Whitelist" (permitir solo lo
// conocido) es siempre más seguro que "blacklist" (bloquear lo malo
// conocido) — una blacklist siempre puede tener un hueco que no
// anticipaste; una whitelist rechaza todo por defecto.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    // cb(error) le dice a multer "rechaza este archivo" — el error
    // termina en el manejador de errores centralizado de app.js.
    return cb(new Error('Solo se permiten imágenes JPG, JPEG o PNG'))
  }
  cb(null, true)   // null = sin error, true = acepta el archivo
}

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,   // 8MB por archivo — evita que alguien
                                   // intente agotar el almacenamiento o
                                   // la memoria del servidor con un solo
                                   // archivo gigante
    files: 3                      // máximo 5 imágenes por petición
  }
})

// Nota de seguridad importante: file.mimetype viene del header
// "Content-Type" que el NAVEGADOR reporta al subir el archivo — un
// atacante podría mentir aquí (renombrar un .exe a foto.jpg y forzar
// el mimetype). Esta validación es la primera línea de defensa, pero
// NO es suficiente por sí sola — por eso en images.controller.js
// reprocesamos el archivo con sharp, que solo puede reprocesar
// imágenes REALES (si el contenido no es una imagen válida, sharp
// falla y rechazamos la subida). Es la misma idea de "defensa en
// profundidad" que ya aplicamos con sanitize.js en cliente Y servidor.
