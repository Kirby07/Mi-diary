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
// Subir imágenes es una operación costosa (ancho de banda, reprocesamiento
// con sharp, almacenamiento en Supabase) — un límite más bajo que el resto
// de la API evita que una cuenta comprometida o un bug en el frontend
// llene el bucket de Storage a base de peticiones repetidas.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                      // 40 imágenes cada 15 min es generoso para uso normal
  message: { error: 'Demasiadas imágenes subidas en poco tiempo. Espera un momento.' }
})