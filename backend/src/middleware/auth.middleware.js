// src/middleware/auth.middleware.js
//
// Un "middleware" en Express es una función que se ejecuta ANTES de que
// la petición llegue al controlador final. Sirve como punto de control:
// aquí decidimos si la petición puede continuar o se rechaza.
//
// Este middleware protege rutas privadas verificando un JWT (JSON Web Token).
//
// ── ¿Qué es un JWT? ──────────────────────────────────────────────
// Es un string firmado digitalmente que contiene información (en este caso,
// el id del usuario) y una firma que prueba que el servidor lo emitió.
// El cliente lo guarda después de hacer login, y lo envía en cada petición
// futura dentro del header "Authorization: Bearer <token>".
//
// El servidor NO necesita guardar sesiones en memoria ni en base de datos
// para saber quién eres — simplemente verifica la firma del token con el
// mismo JWT_SECRET que usó para crearlo. Si la firma es válida, confía en
// el contenido. Por eso JWT_SECRET debe ser secreto: cualquiera que lo
// conozca podría fabricar tokens falsos.

import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  // El token llega en el header así: "Authorization: Bearer eyJhbGciOi..."
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    // 401 = "no autenticado". El cliente no envió credenciales válidas.
    return res.status(401).json({ error: 'Token no proporcionado' })
  }

  // "Bearer eyJhbGciOi...".split(' ')[1] → solo el token, sin la palabra "Bearer"
  const token = header.split(' ')[1]

  try {
    // jwt.verify() hace dos cosas a la vez:
    //   1. Comprueba que la firma coincide (el token no fue falsificado)
    //   2. Comprueba que no haya expirado
    // Si algo falla, lanza un error que atrapamos abajo.
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // Adjuntamos el id del usuario a la petición para que los
    // controladores siguientes sepan "quién" está pidiendo los datos.
    // Esto es CRUCIAL: nunca confiamos en un userId que venga del body
    // o de query params — siempre lo sacamos del token verificado.
    req.userId = payload.userId

    next()   // todo bien, continúa hacia el controlador real
  } catch (err) {
    // 403 = "autenticado pero no autorizado" / token inválido o vencido
    return res.status(403).json({ error: 'Token inválido o expirado' })
  }
}
