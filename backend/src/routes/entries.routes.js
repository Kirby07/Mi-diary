// src/routes/entries.routes.js
//
// A diferencia de auth.routes.js, TODAS estas rutas pasan primero por
// requireAuth. Eso significa que ninguna petición llega al controlador
// sin un JWT válido — si el token falta o es inválido, el middleware
// responde con 401/403 y la petición nunca avanza más allá de esta línea.

import { Router } from 'express'
import { getEntries, upsertEntry, deleteEntry } from '../controllers/entries.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// router.use() aplica el middleware a TODAS las rutas definidas
// después de esta línea, dentro de este router — más limpio que
// repetir requireAuth en cada línea individual.
router.use(requireAuth)

router.get('/',            asyncHandler(getEntries))
router.put('/:date',       asyncHandler(upsertEntry))
router.delete('/:date',    asyncHandler(deleteEntry))

export default router
