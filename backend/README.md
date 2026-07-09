# Backend — Mi Diario API

API REST con Node.js + Express + PostgreSQL (vía Prisma) que reemplaza el
`localStorage` del frontend, permitiendo sincronizar entradas entre dispositivos.

---

## 1. Levantar PostgreSQL

No necesitas instalar Postgres en tu sistema — usa Docker:

```bash
cd backend
docker compose up -d
```

Esto crea una base de datos en `localhost:5432` con las credenciales que ya
están en `docker-compose.yml` y coinciden con `.env.example`.

Verifica que está corriendo:
```bash
docker compose ps
```

---

## 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Abre `.env` y genera un `JWT_SECRET` real:
```bash
openssl rand -base64 48
```
Copia el resultado y pégalo como valor de `JWT_SECRET`.

---

## 3. Instalar dependencias y crear las tablas

```bash
npm install

# Crea las tablas en Postgres a partir de prisma/schema.prisma
npx prisma migrate dev --name init

# Genera el cliente de Prisma tipado (se regenera automáticamente
# tras cada "migrate dev", pero puedes forzarlo manualmente):
npx prisma generate
```

`prisma migrate dev` hace dos cosas: genera un archivo SQL de migración
en `prisma/migrations/` (quedará en tu control de versiones — así
cualquiera que clone el repo puede reconstruir la BD desde cero) y
lo ejecuta contra la base de datos.

---

## 4. Arrancar el servidor

```bash
npm run dev
```

Deberías ver:
```
✦ Servidor del diario corriendo en http://localhost:3000
```

Pruébalo:
```bash
curl http://localhost:3000/health
# { "status": "ok" }
```

---

## 5. Explorar la base de datos visualmente (opcional)

Prisma incluye una interfaz web para ver y editar tus tablas sin SQL:

```bash
npx prisma studio
```
Abre `http://localhost:5555`.

---

## Endpoints disponibles

| Método | Ruta            | Auth | Descripción                          |
|--------|-----------------|------|---------------------------------------|
| POST   | `/auth/register`| No   | Crea una cuenta, devuelve JWT        |
| POST   | `/auth/login`    | No   | Verifica credenciales, devuelve JWT  |
| GET    | `/entries`       | Sí   | Lista todas las entradas del usuario |
| PUT    | `/entries/:date` | Sí   | Crea o actualiza la entrada de esa fecha |
| DELETE | `/entries/:date` | Sí   | Borra la entrada de esa fecha        |
| GET    | `/health`        | No   | Verifica que el servidor responde    |

Las rutas marcadas "Sí" requieren el header:
```
Authorization: Bearer <token-que-recibiste-en-login>
```

---

## Probar manualmente con curl

```bash
# Registro
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"contraseña123","name":"Mi Diario"}'

# Guarda el "token" de la respuesta, lo necesitas para lo siguiente:

# Crear una entrada
curl -X PUT http://localhost:3000/entries/2026-06-29 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{"title":"Mi primer día","content":"Hoy aprendí sobre backends.","mood":"😊"}'

# Listar entradas
curl http://localhost:3000/entries \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

---

## Despliegue en producción

Servicios con buen soporte para Node + Postgres administrado:
- **Railway** — Postgres y el servidor Node en un solo lugar, despliegue por git push
- **Render** — similar, con base de datos administrada incluida
- **Fly.io** — más control, requiere algo más de configuración

En todos los casos: nunca subas tu `.env` real — configura las variables
de entorno desde el dashboard de la plataforma.

---

## Próximos pasos sugeridos

- [ ] Refresh tokens (el JWT actual expira en 1h y no hay forma de renovarlo sin volver a loguearse)
- [ ] Verificación de email al registrarse
- [ ] Endpoint para cambiar contraseña
- [ ] Tests automatizados con Vitest + Supertest
- [ ] Logging estructurado (Winston o Pino) en vez de `console.error`
