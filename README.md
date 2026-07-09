# Mi Diario ✦

Diario personal con **Vue 3 + Vite** en el frontend y **Node.js + Express + PostgreSQL** en el backend. Incluye autenticación real, sincronización entre dispositivos, vista de papel, bloqueo local con PIN y sanitización XSS en ambas capas.

---

## Arquitectura

```
┌─────────────────┐         HTTPS / JSON          ┌──────────────────┐
│  Frontend (Vue) │ ───────────────────────────▶  │ Backend (Express)│
│  localhost:5173 │ ◀───────────────────────────  │  localhost:3000  │
└─────────────────┘                                └────────┬─────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │   PostgreSQL     │
                                                     │  (vía Prisma)    │
                                                     └──────────────────┘
```

El frontend nunca toca la base de datos directamente — todo pasa por la API.

---

## Inicio rápido

**1. Backend** (instrucciones completas en `backend/README.md`):
```bash
cd backend
docker compose up -d              # levanta PostgreSQL
cp .env.example .env               # configura JWT_SECRET, DATABASE_URL, etc.
npm install
npx prisma migrate dev --name init
npm run dev                        # http://localhost:3000
```

**2. Frontend** (en otra terminal, desde la raíz del proyecto):
```bash
cp .env.example .env                # configura VITE_API_URL
npm install
npm run dev                         # http://localhost:5173
```

Abre `http://localhost:5173`, crea una cuenta desde la pantalla de registro, y ya puedes escribir — las entradas se guardan en PostgreSQL y estarán disponibles si abres el diario desde otro dispositivo con la misma cuenta.

---

## Estructura del proyecto

```
mi-diario/
├── src/                      # Frontend (Vue 3)
│   ├── main.js
│   ├── App.vue                # coordina sesión, entradas y vistas
│   ├── components/
│   │   ├── AuthScreen.vue     # registro / login contra el backend
│   │   ├── LockScreen.vue     # bloqueo LOCAL con PIN (independiente de la cuenta)
│   │   ├── WeekGrid.vue
│   │   ├── PaperView.vue
│   │   ├── EntryEditor.vue
│   │   └── SettingsPanel.vue
│   ├── services/
│   │   └── api.js             # cliente HTTP — toda la comunicación con el backend
│   ├── utils/
│   │   ├── crypto.js          # SHA-256 — solo para el PIN local
│   │   └── dates.js
│   └── styles/main.css
│
└── backend/                  # Backend (Node + Express + PostgreSQL)
    ├── prisma/schema.prisma   # definición de las tablas User y Entry
    ├── docker-compose.yml     # PostgreSQL local sin instalación nativa
    └── src/
        ├── server.js
        ├── app.js              # middlewares de seguridad, CORS, rutas
        ├── config/prisma.js
        ├── middleware/         # auth (JWT) y rate limiting
        ├── controllers/        # lógica de auth y entradas
        ├── routes/
        └── utils/sanitize.js   # sanitización del LADO DEL SERVIDOR
```

---

## Dos capas de seguridad distintas (no las confundas)

| Capa | Qué protege | Dónde vive |
|------|-------------|------------|
| **Cuenta (email + contraseña)** | Quién puede ver y sincronizar TUS entradas entre dispositivos | Backend — bcrypt + JWT |
| **PIN local** | Que alguien que toma tu celular desbloqueado no vea el diario abierto | Frontend — SHA-256, solo en ese dispositivo |

Son independientes: puedes tener cuenta sin PIN, o cambiar el PIN sin afectar tu cuenta. El PIN nunca sale de tu dispositivo; la cuenta es lo que sincroniza.

---

## Despliegue

### Backend
Plataformas con buen soporte Node + Postgres administrado: **Railway**, **Render**, **Fly.io**. Configura las variables de entorno desde su dashboard — nunca subas `.env`.

### Frontend
**Vercel** o **Netlify** (ver `vercel.json` / `public/_headers` para los headers de seguridad). Configura `VITE_API_URL` apuntando a la URL pública de tu backend ya desplegado.

---

## Seguridad implementada

| Medida                    | Dónde                          |
|---------------------------|-------------------------------|
| Contraseñas hasheadas (bcrypt) | `backend/src/controllers/auth.controller.js` |
| Tokens JWT con expiración | `backend/src/middleware/auth.middleware.js` |
| Rate limiting en login    | `backend/src/middleware/rateLimit.middleware.js` |
| Sanitización XSS (servidor)| `backend/src/utils/sanitize.js` — la que realmente importa |
| Prevención de inyección SQL | Prisma ORM (queries parametrizadas automáticamente) |
| CORS restringido           | `backend/src/app.js` |
| Headers de seguridad HTTP  | `helmet()` en backend + `vercel.json`/`_headers` en frontend |
| PIN hasheado (SHA-256+sal) | `src/utils/crypto.js` + `SettingsPanel.vue` |

---

## Próximos pasos sugeridos

- [ ] Refresh tokens (actualmente el JWT expira en 1h sin forma de renovarlo)
- [ ] Endpoint `/auth/me` para verificar sesión sin depender de `fetchEntries()`
- [ ] Verificación de email al registrarse
- [ ] Tests con Vitest (frontend) y Supertest (backend)
- [ ] Cifrado de entradas en reposo (AES-GCM) si el contenido es muy sensible
