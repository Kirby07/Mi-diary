# Handoff — Mi Diario

Documento de traspaso para continuar este proyecto en Claude Code (una sesión nueva, sin memoria de la conversación donde se construyó todo esto). Léelo completo antes de tocar código — la mitad del valor está en el "por qué", no solo en el "qué".

## Qué es esto

Diario personal web, un usuario a la vez, con cuentas reales y sincronización entre dispositivos. Construido en dos proyectos Node independientes dentro del mismo repo:

```
mi-diario/                  ← frontend: Vue 3 + Vite
└── backend/                ← backend: Node + Express + Prisma + PostgreSQL + Supabase Storage
```

**Repo:** `https://github.com/Kirby07/Mi-diary` (rama `main`, working tree limpio al momento de este handoff).

**Desplegado en:**
- Frontend → Vercel, `https://mi-diary.vercel.app`
- Backend → Render, `https://mi-diary-backend.onrender.com`
- Base de datos → Supabase (Postgres, vía connection pooler)
- Storage de imágenes → Supabase Storage, bucket privado `diary-images`

## Arquitectura, en una imagen mental

```
Navegador (Vue) ──HTTPS/JSON──▶ Express (Render) ──┬──▶ Postgres (Supabase, vía Prisma)
                ◀──────────────                     └──▶ Storage (Supabase, bucket privado)
```

El frontend nunca toca Postgres ni el bucket directamente — todo pasa por la API, que verifica un JWT en cada petición protegida. No se usa Supabase Auth ni Row Level Security: el backend tiene su propio sistema de auth (bcrypt + JWT) y habla con Storage usando la Service Role Key (acceso total, solo servidor).

## Seguridad — el hilo conductor de todo el proyecto

Este diario se construyó capa por capa, cada una con una razón concreta. Cuando toques algo, mantén esta filosofía:

| Capa | Qué protege | Dónde |
|---|---|---|
| bcrypt (12 rounds) | Contraseñas nunca en texto plano | `backend/src/controllers/auth.controller.js` |
| JWT con expiración (1h) | Sesión de cuenta, sin guardar estado en servidor | `backend/src/middleware/auth.middleware.js` |
| Rate limiting (login, registro, subida de imágenes) | Fuerza bruta y abuso | `backend/src/middleware/rateLimit.middleware.js` |
| Sanitización XSS (cliente Y servidor, el servidor es el que cuenta) | Inyección de HTML/scripts en el texto del diario | `backend/src/utils/sanitize.js` |
| Prisma ORM | Inyección SQL (queries parametrizadas por diseño) | todo el backend |
| Whitelist de tipo MIME + reprocesamiento con `sharp` | Archivos maliciosos disfrazados de imagen, EXIF/GPS, "polyglot files" | `backend/src/middleware/upload.middleware.js`, `backend/src/controllers/images.controller.js` |
| Bucket privado + URLs firmadas (expiran 1h) | Que una foto no sea accesible por URL adivinable | `backend/src/utils/entryHelpers.js` |
| Verificación de propiedad por recurso (anti-IDOR) | Que un usuario no edite/borre imágenes ajenas por id | cada `PATCH`/`DELETE` en `images.controller.js` |
| CORS restringido a un origen | Que solo el frontend real pueda llamar a la API | `backend/src/app.js`, var `CORS_ORIGIN` |
| CSP (`index.html` + `vercel.json`) | Scripts/recursos no autorizados en el frontend | debe incluir el dominio del backend en `connect-src` y el dominio de Supabase en `img-src` — **si cambias de proveedor de Storage o backend, actualiza ambos archivos o las imágenes/llamadas dejan de cargar en silencio (CSP bloquea sin avisar al usuario, solo aparece en consola)** |
| PIN local (SHA-256 + sal, Web Crypto API) | Bloqueo de pantalla del dispositivo — **no es autenticación de cuenta**, es independiente | `src/utils/crypto.js`, `src/components/LockScreen.vue` |

La distinción PIN vs. cuenta importa: el PIN nunca sale del dispositivo, la cuenta es lo que sincroniza. No los confundas al modificar el flujo de auth.

## ⚠️ Secretos — antes de hacer cualquier cosa

`backend/.env` existe en el repo local con valores reales (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) — está en `.gitignore`, nunca debería llegar a git, pero **verifica que sigue ignorado antes de cualquier commit** (`git status` no debe mostrarlo). Los valores reales viven también en el dashboard de Render (backend) y Vercel (frontend, solo `VITE_API_URL`) — cualquier cambio de configuración en producción se hace ahí, no editando `.env` local y esperando que se propague solo.

`backend/.env.example` y `.env.production` (raíz, es el `.env.example` del frontend pese al nombre) documentan qué variables existen, sin valores.

---

## Un bug real pendiente de confirmación (leer antes de tocar imágenes)

### Bug 2 — WEBP animado con ghosting — fix APLICADO (Fix B), pero sin confirmación del usuario todavía

**Contexto:** se añadió soporte para subir WEBP (estático primero, luego animado) sin cambiar el formato original para ahorrar espacio en Storage. Al reprocesar un WEBP animado con `sharp` completo (redimensionar + recodificar) para aplicar las mismas protecciones que a cualquier otra imagen (EXIF/GPS, polyglots), la animación se reproducía "fantasma": los frames parecían dibujarse unos sobre otros sin limpiar el lienzo entre cada uno (patrón clásico de un problema con el *disposal method* de cada frame).

**Lo que pasó DESPUÉS del diagnóstico (visible en el historial, 3 commits "Fix de prueba" seguidos, el mismo día):**

1. Primer intento (`088a379`) — **Fix A**: bifurcar el pipeline (detectar animación vía `sharp(file.buffer).metadata()` → `pages > 1`) y, en el camino animado, seguir recodificando con `sharp(file.buffer, { animated: true })` pero quitando el `height` explícito del `.resize()` (para evitar la ambigüedad "¿por frame o por lienzo apilado?").
2. Segundo commit (`ebf065c`) — ajuste intermedio sobre el mismo Fix A (quita una asignación redundante de `outputFormat`); no cambia el enfoque.
3. Tercer commit (`dab345c`, el que quedó como estado final) — **se abandonó Fix A y se pasó a Fix B**: para WEBP animado, ya NO se recodifica en absoluto. Se dejan pasar los bytes originales del archivo tal cual:

```js
// Estado actual, confirmado en backend/src/controllers/images.controller.js:
const meta = await sharp(file.buffer).metadata()
const isAnimatedWebp = file.mimetype === 'image/webp' && meta.pages > 1

let outputFormat, buffer, info

if (isAnimatedWebp) {
  // No redimensionamos ni recodificamos frame por frame — reconstruir
  // correctamente el metadato de disposición de cada frame es una
  // zona frágil, y un error ahí produce animaciones "fantasma".
  // Dejamos pasar los bytes originales intactos.
  outputFormat = 'webp'
  buffer = file.buffer
  info = { width: meta.width, height: meta.height }
} else {
  // Camino estático — el pipeline de siempre, sin cambios.
  outputFormat = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpeg'
  const result = await sharp(file.buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .toFormat(outputFormat, { quality: IMAGE_QUALITY })
    .toBuffer({ resolveWithObject: true })
  buffer = result.data
  info = result.info
}
```

El hecho de que se haya pasado de Fix A a Fix B en el mismo día sugiere que **Fix A no resolvió el ghosting** (o al menos no a satisfacción) — pero eso es inferencia a partir del historial de commits, no algo confirmado explícitamente en texto. No hay ningún mensaje del usuario en la conversación original confirmando que Fix B efectivamente arregló la reproducción — el último reporte del síntoma ("se ve borroso/fantasma") es **anterior** a estos tres commits.

**Lo que falta, primero antes que cualquier otra cosa con imágenes:**
- Subir un WEBP animado real a producción (o local) y confirmar visualmente si el ghosting desapareció. Si SIGUE apareciendo, el problema no era el recodificado de `sharp` — hay que buscar la causa en otro lado (el navegador reproduciendo el mismo buffer distinto a como lo hacía antes de pasar por Storage, algún header de `content-type`/`cache-control` en la subida a Supabase, o el propio componente `ImageCanvas.vue`/`PaperView.vue` renderizando el `<img>`).
- Si SÍ se confirma resuelto, mover este bug a la sección de "ya resuelto" y considerar seriamente si vale la pena reintentar un Fix A más cuidadoso (recodificar SÍ mantiene las protecciones de EXIF/GPS/polyglot para animados) en vez de quedarse indefinidamente con el trade-off de seguridad de abajo.

**Trade-off de seguridad activo ahora mismo, con Fix B en producción:** para WEBP animados (solo ellos — estáticos y JPG/PNG siguen recodificándose normalmente) se perdió la protección de "reconstruir desde cero neutraliza EXIF/GPS y polyglots". El archivo llega a Storage con sus bytes originales intactos. Quedan igual activas: la whitelist de Multer, y que `sharp(file.buffer).metadata()` ya validó que es un WEBP real y bien formado (si no lo fuera, esa llamada falla y se rechaza antes de llegar a Storage). Para un diario personal de un solo usuario es un riesgo razonable, pero es una decisión de producto que el usuario nunca confirmó explícitamente haber aceptado (se documentó el trade-off, se pidió comentarlo antes de aplicar, y el historial muestra que se aplicó de todas formas) — vale la pena mencionárselo directamente la próxima vez que surja el tema.

---

## Inconsistencias menores encontradas, sin resolver (no bloqueantes)

1. **`backend/src/middleware/upload.middleware.js`** — el límite real es `files: 3` pero el comentario en la misma línea dice `// máximo 5 imágenes por petición`, y la ruta en `images.routes.js` también dice `upload.array('images', 5)`. Hay tres números que deberían ser el mismo y no lo son. No se confirmó nunca con el usuario cuál es el valor deseado — decidir y unificar los tres lugares. (Confirmado que sigue así en el código actual.)

2. **Historial de commits** tiene algunos mensajes exploratorios (`"idk"`, `"Código mezclado jaja"`) — el working tree está limpio ahora, pero si algo se comporta raro y no aparece en este handoff, vale la pena revisar el diff de esos commits puntuales antes de asumir que es un bug nuevo.

---

## Cosas ya resueltas en este proyecto (para no re-investigar de cero)

Por si alguna de estas vuelve a aparecer — ya se diagnosticaron y corrigieron una vez:

- **Sesión "fantasma" tras token expirado** — con un JWT vencido guardado en `localStorage`, al recargar la página la app entraba directo al diario sin pedir login, pero sin ninguna entrada visible (se resolvía solo con un login manual de nuevo). Causa raíz: `loadEntriesFromServer()` en `src/App.vue` atrapaba su propio error de `401`/`403` sin volver a lanzarlo, así que el `catch` externo en `onMounted` nunca se enteraba y marcaba `user.value` como autenticado igual. **Confirmado corregido** — `loadEntriesFromServer()` ahora detecta `err instanceof api.ApiError && (err.status === 401 || err.status === 403)`, llama a `logout()` de verdad y re-lanza el error (`throw err`) para que quien la llamó también reaccione; el bloque en `onMounted` ya no necesita el `api.setToken(null)` manual porque `logout()` lo hace. Verificado leyendo el `src/App.vue` actual — no hace falta tocar nada aquí salvo que reaparezca el síntoma.
- **Mensaje de error de `fileFilter` sin mencionar WEBP** (`backend/src/middleware/upload.middleware.js`) — decía `'Solo se permiten imágenes JPG, JPEG o PNG'` aunque `ALLOWED_MIME_TYPES` ya incluía `image/webp`. **Confirmado corregido** — ahora dice `'Solo se permiten imágenes JPG, JPEG, PNG o WEBP'`.
- **`SyntaxError: Identifier already declared`** en `supabase.js` — venía de pegar dos veces el mismo bloque de validación al editar a mano. El archivo actual ya tiene la validación de variables requeridas + normalización de `SUPABASE_URL` (quita `/` final) aplicada correctamente — no la dupliques si vuelves a tocar este archivo.
- **`StorageApiError: Invalid path specified in request URL`** — causado por copiar la URL de la sección equivocada del dashboard de Supabase (`.../rest/v1/` en vez de la "Project URL" raíz). `SUPABASE_URL` debe ser solo `https://xxxxx.supabase.co`, sin sufijo.
- **CSP bloqueando conexión al backend** (`connect-src`) y **bloqueando carga de imágenes de Supabase** (`img-src`) — cada vez que se añade un dominio externo nuevo (backend, Storage), hay que añadirlo en **ambos** lugares: `index.html` (meta tag, cubre dev) y `vercel.json` (header HTTP real, el que manda en producción).
- **`trust proxy` de Express** — Render pone la app detrás de un proxy; sin `app.set('trust proxy', 1)` en `app.js`, `express-rate-limit` no identifica IPs correctamente. Ya está aplicado.
- **Import accidental de `express` en el frontend** (`src/services/api.js`) — rompía el build de Vercel (`Rollup failed to resolve import "express"`). Ya no está; si algún cambio futuro rompe el build con un error de "no se pudo resolver X", sospecha primero de un import cruzado entre `backend/` y la raíz del frontend — son dos `package.json` completamente independientes.
- **Vercel/Render no reflejan cambios de variables de entorno automáticamente** — tras editar una env var en cualquiera de los dos dashboards, hace falta forzar **Manual Deploy** explícitamente; guardar la variable sola no siempre reinicia el proceso.

---

## Rutina antes de cada push (para no repetir el ciclo de "push → falla en Vercel/Render → adivinar")

```bash
# Frontend — reproduce exactamente lo que corre Vercel
cd mi-diario
npm run build

# Backend — chequeo rápido de sintaxis sin arrancar el servidor completo
cd backend
node --check src/server.js
```

Recordatorio de scope: `npm install <paquete>` siempre se corre parado en la carpeta correcta (`mi-diario/` para frontend, `mi-diario/backend/` para backend) — cada uno tiene su propio `package.json` y `node_modules`, no se comparten.

## Endpoints actuales de la API (referencia rápida)

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| POST | `/auth/register` | No | Crea cuenta, devuelve JWT |
| POST | `/auth/login` | No | Verifica credenciales, devuelve JWT |
| GET | `/entries` | Sí | Todas las entradas del usuario, con imágenes (URLs firmadas) |
| PUT | `/entries/:date` | Sí | Crea/actualiza la entrada de esa fecha |
| DELETE | `/entries/:date` | Sí | Borra la entrada y limpia sus imágenes del bucket |
| POST | `/entries/:date/images` | Sí | Sube 1-N imágenes (JPG/PNG/WEBP) |
| PATCH | `/images/:id` | Sí | Actualiza posición (`x`,`y`) o ancho (`w`) de una imagen |
| DELETE | `/images/:id` | Sí | Borra una imagen puntual (bucket + fila) |
| GET | `/health` | No | Liveness check |

Todas las rutas "Sí" requieren `Authorization: Bearer <token>`.

## Estado del modelo de imágenes (por si se retoma la idea de rediseño)

En algún punto se evaluó (y se descartó a favor de algo más simple) rediseñar cómo se insertan las imágenes: en vez de un lienzo libre con `x`/`y`/`w` arrastrable sobre la entrada, intercalarlas como bloques dentro del flujo del texto (tipo "imagen entre párrafos"), usando un marcador `[[img:uuid]]` serializado dentro de `content`. **Se decidió NO hacerlo** — el modelo actual (`Image.x`, `Image.y`, `Image.w` en `schema.prisma`, componente `ImageCanvas.vue` con lienzo posicionable) sigue vigente y es el que está en producción. Si se retoma esa idea más adelante, implica migración de schema y reescritura de `ImageCanvas.vue`/`EntryEditor.vue`/`PaperView.vue` — no es un cambio menor, avisar antes de emprenderlo.

El dropzone (`ImageCanvas.vue`) ya tiene el fix de "transparente en modo solo-lectura" aplicado — en `PaperView` (tras guardar) no muestra el fondo/borde punteado de edición, solo las fotos flotando sobre el papel.

## Dependencias clave y versiones (backend)

```
@prisma/client ^5.14.0    bcrypt ^5.1.1           multer ^1.4.5-lts.1
@supabase/supabase-js ^2.45.0   express ^4.19.2   sharp ^0.33.4
jsonwebtoken ^9.0.2       helmet ^7.1.0           express-rate-limit ^7.2.0
```

Frontend: `vue ^3.4.21`, `vite ^5.2.0` — sin librerías de UI externas, todo CSS a mano con variables por tema (oscuro/claro/sepia).

---

## Sugerencia de por dónde empezar

1. **Confirmar con un WEBP animado real si el ghosting ya desapareció.** El Fix B ya está en producción (ver sección "Bug 2" arriba) pero nadie confirmó el resultado visual todavía — es la única duda real abierta en el proyecto ahora mismo. Si sigue fallando, el problema no estaba donde se pensaba.
2. Decidir y unificar el límite de imágenes por petición (inconsistencia #1: `files: 3` vs comentario "máximo 5" vs `upload.array('images', 5)`).
3. Si el punto 1 confirma que el ghosting está resuelto, comentarle al usuario el trade-off de seguridad que quedó activo (WEBP animados ya no se re-encodean, así que no se les aplica el strip de EXIF/GPS ni la neutralización de polyglots) y preguntar si prefiere aceptarlo así o invertir en un Fix A más cuidadoso que sí re-encode preservando la animación.
