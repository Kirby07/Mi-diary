// src/controllers/auth.controller.js
//
// Un "controlador" es la función que finalmente maneja una petición HTTP
// concreta — recibe el request, habla con la base de datos si es necesario,
// y devuelve una respuesta. Las rutas (routes/) solo dicen "esta URL llama
// a esta función"; aquí vive la lógica real.

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'

// Factor de coste de bcrypt: cuántas veces se repite internamente el
// algoritmo de hashing. Más alto = más lento = más resistente a fuerza
// bruta, pero también más lento para tus propios usuarios al hacer login.
// 12 es el estándar recomendado actualmente (2024+).
const BCRYPT_ROUNDS = 12

// ── POST /auth/register ──────────────────────────────────────────
export async function register(req, res) {
  const { email, password, name } = req.body

  // Validación básica — nunca confíes en que el frontend ya validó esto.
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  // Comprobamos si el email ya existe ANTES de intentar crear el usuario,
  // para poder devolver un mensaje de error claro (en vez de un error
  // genérico de base de datos por violar la restricción @unique).
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })
  }

  // bcrypt.hash() genera automáticamente una sal aleatoria por usuario
  // y la incluye dentro del propio hash resultante — no necesitas
  // gestionar la sal por separado como hicimos con SHA-256 en el frontend.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || 'Mi Diario'
    }
  })

  // Generamos el token igual que en login, para que el usuario quede
  // autenticado inmediatamente después de registrarse (sin tener que
  // loguearse otra vez por separado).
  const token = signToken(user.id)

  // 201 = "creado". Nunca devolvemos passwordHash en la respuesta,
  // aunque esté hasheado — simplemente no es información que el
  // cliente necesite ver.
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name }
  })
}

// ── POST /auth/login ──────────────────────────────────────────────
export async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Detalle de seguridad importante: si el usuario no existe, devolvemos
  // EXACTAMENTE el mismo mensaje de error que si la contraseña fuera
  // incorrecta. Si dijéramos "usuario no existe" vs "contraseña incorrecta",
  // un atacante podría usar esa diferencia para descubrir qué emails
  // están registrados en tu sistema (esto se llama "enumeración de usuarios").
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  // bcrypt.compare() hashea la contraseña recibida con la MISMA sal
  // que está embebida en el hash guardado, y compara los resultados.
  // Nunca "desencriptamos" el hash guardado — eso es imposible por diseño.
  const validPassword = await bcrypt.compare(password, user.passwordHash)

  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  const token = signToken(user.id)

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name }
  })
}

// ── Helper interno: firma un JWT para un usuario dado ─────────────
function signToken(userId) {
  // jwt.sign(payload, secreto, opciones)
  // El payload (lo que va dentro del token) debe ser mínimo — aquí solo
  // guardamos el id. Nunca metas datos sensibles dentro del JWT: aunque
  // está firmado (no se puede falsificar), NO está cifrado — cualquiera
  // puede decodificar y LEER su contenido en jwt.io, solo no puede
  // modificarlo sin invalidar la firma.
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  )
}
