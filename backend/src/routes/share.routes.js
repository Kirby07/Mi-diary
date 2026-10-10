// src/routes/share.routes.js
//
// /share/*  → gestión del link (requiere sesión del dueño)
// /shared   → lectura pública con el token (sin cuenta, con rate limit)
//
// OJO: este router se monta en app.js ANTES que images.routes.js, que
// aplica requireAuth a todo lo que le llega — si fuera después, /shared
// respondería 401 a los visitantes.

import { Router } from 'express'
import {
  getShare, createShare, updateShareSettings, deleteShare, getSharedDiary
} from '../controllers/share.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { sharedViewLimiter } from '../middleware/rateLimit.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/shared', sharedViewLimiter, asyncHandler(getSharedDiary))

router.get('/share',          requireAuth, asyncHandler(getShare))
router.post('/share',         requireAuth, asyncHandler(createShare))
router.put('/share/settings', requireAuth, asyncHandler(updateShareSettings))
router.delete('/share',       requireAuth, asyncHandler(deleteShare))

export default router
