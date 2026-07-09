// src/utils/asyncHandler.js
//
// Express no captura errores lanzados dentro de funciones async por defecto.
// Sin este wrapper, tendrías que escribir try/catch en CADA controlador:
//
//   async function getEntries(req, res) {
//     try {
//       const entries = await prisma.entry.findMany(...)
//       res.json(entries)
//     } catch (err) {
//       next(err)   // ← fácil de olvidar, y si lo olvidas, el servidor se cuelga
//     }
//   }
//
// Con este wrapper, cualquier error dentro de la función async se atrapa
// automáticamente y se reenvía a next(), que termina en tu manejador de
// errores centralizado (ver app.js).
//
// Uso: router.get('/', asyncHandler(getEntries))

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
