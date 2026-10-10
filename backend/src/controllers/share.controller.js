// src/controllers/share.controller.js
//
// Link de solo lectura: el dueño (con sesión) lo genera, regenera o
// revoca; cualquiera que lo tenga puede LEER el diario, nunca escribir.
//
// El token llega en el header X-Share-Token, no en la URL de la API: así
// no queda registrado en los logs de acceso de Render. En el frontend
// viaja tras un "#", que el navegador nunca envía a Vercel.

import { prisma } from '../config/prisma.js'
import { attachSignedUrls } from '../utils/entryHelpers.js'
import {
  isValidShareToken, newShareToken, hashShareToken,
  encryptShareToken, decryptShareToken
} from '../utils/shareToken.js'

// Whitelist de la apariencia que se comparte — mismas opciones que
// SettingsPanel.vue. Nada de lo que mande el cliente se guarda tal cual.
const THEMES = ['dark', 'light', 'sepia']
const FONTS  = ['serif', 'sans', 'mono']
const SIZES  = ['sm', 'md', 'lg']

function cleanSettings(s = {}) {
  return {
    theme:    THEMES.includes(s.theme)    ? s.theme    : 'dark',
    font:     FONTS.includes(s.font)      ? s.font     : 'serif',
    fontSize: SIZES.includes(s.fontSize)  ? s.fontSize : 'md',
    accent:   /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#9B8EC4',
    name:     String(s.name || 'Mi Diario').replace(/[<>]/g, '').slice(0, 60)
  }
}

// ── GET /share ──────────────────────────────────────────────────
// { token } si hay link activo, { token: null } si no.
export async function getShare(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { shareTokenEnc: true }
  })
  res.json({ token: user?.shareTokenEnc ? decryptShareToken(user.shareTokenEnc) : null })
}

// ── POST /share ─────────────────────────────────────────────────
// Genera un link nuevo. Si ya había uno, lo REEMPLAZA: el anterior deja
// de funcionar en ese mismo instante (su hash ya no existe en la BD).
export async function createShare(req, res) {
  const token = newShareToken()
  await prisma.user.update({
    where: { id: req.userId },
    data: {
      shareTokenHash: hashShareToken(token),
      shareTokenEnc:  encryptShareToken(token),
      shareSettings:  cleanSettings(req.body?.settings)
    }
  })
  res.status(201).json({ token })
}

// ── PUT /share/settings ─────────────────────────────────────────
// Mantiene la apariencia del visitante al día cuando el dueño cambia
// su tema. updateMany para no fallar si no hay link activo.
export async function updateShareSettings(req, res) {
  await prisma.user.updateMany({
    where: { id: req.userId, shareTokenHash: { not: null } },
    data:  { shareSettings: cleanSettings(req.body?.settings) }
  })
  res.status(204).end()
}

// ── DELETE /share ───────────────────────────────────────────────
export async function deleteShare(req, res) {
  await prisma.user.update({
    where: { id: req.userId },
    data:  { shareTokenHash: null, shareTokenEnc: null, shareSettings: null }
  })
  res.status(204).end()
}

// ── GET /shared (PÚBLICA, sin cuenta) ───────────────────────────
// Devuelve SOLO lo necesario para leer: nada de email, ids de usuario ni
// rutas internas de Storage. Mismo 404 para token mal formado, revocado
// o inexistente — no damos pistas sobre cuál fue el caso.
export async function getSharedDiary(req, res) {
  res.set('Cache-Control', 'no-store')
  res.set('X-Robots-Tag', 'noindex')
  const token = req.get('X-Share-Token')
  const notFound = () => res.status(404).json({ error: 'Este link no existe o fue revocado' })
  if (!isValidShareToken(token)) return notFound()

  const owner = await prisma.user.findUnique({
    where:  { shareTokenHash: hashShareToken(token) },
    select: { id: true, shareSettings: true }
  })
  if (!owner) return notFound()

  const entries = await prisma.entry.findMany({
    where:   { userId: owner.id },
    orderBy: { date: 'desc' },
    select: {
      date: true, title: true, content: true, mood: true,
      images: {
        select: { id: true, storagePath: true, naturalWidth: true, naturalHeight: true, x: true, y: true, w: true }
      }
    }
  })
  res.json({
    settings: owner.shareSettings,
    entries:  await attachSignedUrls(entries)
  })
}
