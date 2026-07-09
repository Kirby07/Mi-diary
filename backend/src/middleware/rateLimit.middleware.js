// src/middleware/rateLimit.middleware.js
//
// Sin esto, un atacante podría probar millones de contraseñas por
// segundo contra /auth/login hasta adivinar una. Este middleware
// cuenta las peticiones por IP y bloquea temporalmente si hay
// demasiadas en poco tiempo.

import rateLimit from 'express-rate-limit'

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // ventana de tiempo: 15 minutos
  max: 5,                      // máximo 5 intentos por IP en esa ventana
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
  standardHeaders: true,       // informa el límite restante en headers HTTP estándar
  legacyHeaders: false
})

// Límite más permisivo para el registro (menos crítico, pero igual
// conviene no dejarlo completamente abierto a spam de cuentas).
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,    // 1 hora
  max: 10,
  message: { error: 'Demasiados registros desde esta IP. Intenta más tarde.' }
})
