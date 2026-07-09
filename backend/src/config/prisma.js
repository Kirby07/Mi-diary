// src/config/prisma.js
//
// Patrón singleton: este archivo crea UNA sola instancia de PrismaClient
// y la exporta. Cualquier otro archivo que necesite hablar con la base
// de datos importa esta misma instancia, en vez de crear la suya propia.
//
// Por qué importa: cada PrismaClient mantiene un pool de conexiones
// abiertas hacia Postgres. Si cada archivo creara su propio cliente,
// terminarías con muchas más conexiones de las que Postgres permite.

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  // 'query' muestra cada SQL generado en la consola — muy útil mientras
  // aprendes, porque ves exactamente qué SQL real produce cada llamada.
  // Quítalo en producción para no llenar los logs de ruido.
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error']
})
