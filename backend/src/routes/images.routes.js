// A diferencia de entries.routes.js (que se monta bajo el prefijo
// '/entries'), aquí declaramos rutas con dos prefijos distintos en el
// mismo router: '/entries/:date/images' para subir (necesita una fecha,
// como el resto de la API de entradas) y '/images/:id' para editar o
// borrar una imagen puntual (se identifica por su propio id, no por
// fecha, porque una entrada puede tener varias). Por eso este router
// se monta en la RAÍZ de la app (ver app.js), no bajo un prefijo fijo.

import { Router } from 'express'
import { uploadImages, updateImage, deleteImage } from '../controllers/images.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { upload } from '../middleware/upload.middleware.js'
import { uploadLimiter } from '../middleware/rateLimit.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.use(requireAuth)   // todas las rutas de este archivo requieren sesión

// POST /entries/:date/images
// upload.array('images', 5) → 'images' debe coincidir EXACTAMENTE con
// el nombre de campo que usa el frontend al construir el FormData
// (ver services/api.js), y 5 es el máximo de archivos por petición.
router.post(
  '/entries/:date/images',
  uploadLimiter,
  upload.array('images', 5),
  asyncHandler(uploadImages)
)

// PATCH /images/:id — reposicionar o redimensionar
router.patch('/images/:id', asyncHandler(updateImage))

// DELETE /images/:id — borrar
router.delete('/images/:id', asyncHandler(deleteImage))

export default router