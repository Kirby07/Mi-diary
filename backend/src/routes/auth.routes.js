// src/routes/auth.routes.js
//
// Las rutas son deliberadamente "tontas" — solo dicen QUÉ función
// maneja cada combinación de verbo HTTP + URL. Toda la lógica real
// vive en los controladores. Esto facilita encontrar cosas: si algo
// falla en /auth/login, sabes que la lógica está en auth.controller.js.

import { Router } from 'express'
import { register, login } from '../controllers/auth.controller.js'
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Nota: estas rutas son PÚBLICAS — no pasan por requireAuth,
// porque su propósito es justamente crear la sesión inicial.
router.post('/register', registerLimiter, asyncHandler(register))
router.post('/login',    loginLimiter,    asyncHandler(login))

export default router
