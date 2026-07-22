// Cliente de Supabase, usado ÚNICAMENTE para hablar con Storage
// (guardar/borrar/firmar URLs de imágenes). NO usamos Supabase Auth
// ni Supabase como ORM — Prisma sigue siendo el único que toca las
// tablas. Este cliente solo entra en juego dentro de images.controller.js.
//
// ── Sobre las dos claves de Supabase ──────────────────────────────
// Supabase te da dos claves distintas en su dashboard:
//
//   ANON KEY (pública)   → pensada para usarse desde el NAVEGADOR,
//                           donde Row Level Security (RLS) limita lo
//                           que cada usuario puede hacer.
//
//   SERVICE ROLE KEY      → ignora RLS por completo, tiene acceso total.
//                           SOLO debe vivir en el servidor, nunca en
//                           código que llegue al navegador.
//
// Como nuestro backend ya tiene su propio sistema de autenticación
// (bcrypt + JWT — no usamos Supabase Auth), no tiene sentido meter
// también el sistema de permisos de Supabase (RLS). En su lugar, el
// backend actúa como intermediario de confianza: usa la Service Role
// Key para hablar con Storage, y es el middleware requireAuth (JWT)
// quien decide si el usuario tiene permiso, ANTES de llegar aquí.

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Nombre del bucket de Storage donde viven las imágenes del diario.
// Configurable por variable de entorno para poder usar buckets
// distintos en desarrollo y producción si algún día lo necesitas.
export const IMAGES_BUCKET = process.env.SUPABASE_BUCKET || 'diary-images'
