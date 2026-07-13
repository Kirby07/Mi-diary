// src/server.js
//
// Este es el archivo que realmente arrancas con "npm run dev".
// Su única responsabilidad es: cargar las variables de entorno
// y poner a escuchar la app de app.js en un puerto.

import 'dotenv/config'   // lee el archivo .env y llena process.env automáticamente
import { app } from './app.js'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log('CORS_ORIGIN configurado como:', process.env.CORS_ORIGIN)
})
