// src/utils/shareToken.js
//
// Criptografía del link para compartir el diario en modo solo lectura.
//
//   token  → 32 bytes aleatorios (256 bits) en base64url. Es lo único que
//            viaja en el link; adivinarlo por fuerza bruta es inviable.
//   hash   → HMAC-SHA256(token). Se guarda con índice único y sirve para
//            BUSCAR al dueño cuando llega una visita. Al ser HMAC (con
//            clave) y no un SHA-256 simple, sin la clave ni siquiera se
//            puede comprobar si un token candidato es válido.
//   enc    → token cifrado con AES-256-GCM, para que el dueño pueda volver
//            a copiar su link desde Ajustes. GCM además detecta si alguien
//            manipuló el valor guardado.
//
// Las dos subclaves se derivan de SHARE_TOKEN_KEY con HKDF, así una sola
// variable de entorno alimenta ambos usos sin reutilizar la misma clave.

import crypto from 'node:crypto'

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/   // 32 bytes en base64url = 43 caracteres

let keys = null
function getKeys() {
  if (keys) return keys
  const master = Buffer.from(process.env.SHARE_TOKEN_KEY || '', 'base64')
  // Se valida al USARSE y no al arrancar: si falta la variable, solo deja
  // de funcionar compartir (500), no se cae el diario entero.
  if (master.length < 32) {
    throw new Error('SHARE_TOKEN_KEY falta o es demasiado corta (32 bytes en base64). Revisa Render → Environment.')
  }
  const derive = info => Buffer.from(crypto.hkdfSync('sha256', master, '', info, 32))
  keys = { hmac: derive('mi-diario/share/hmac'), enc: derive('mi-diario/share/enc') }
  return keys
}

export function isValidShareToken(t) {
  return typeof t === 'string' && TOKEN_RE.test(t)
}

export function newShareToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashShareToken(token) {
  return crypto.createHmac('sha256', getKeys().hmac).update(token).digest('base64url')
}

// Formato guardado: iv.authTag.cifrado (cada parte en base64url)
export function encryptShareToken(token) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeys().enc, iv)
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.')
}

export function decryptShareToken(stored) {
  const [iv, tag, data] = stored.split('.').map(p => Buffer.from(p, 'base64url'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKeys().enc, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
