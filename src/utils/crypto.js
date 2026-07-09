/**
 * Genera un hash SHA-256 usando la Web Crypto API nativa del navegador.
 * El PIN nunca se almacena en texto plano — solo su hash + sal.
 *
 * Por qué SHA-256 y no bcrypt aquí:
 *   bcrypt no está disponible en la Web Crypto API. En un backend
 *   Node.js usaríamos bcrypt (ver README). En el cliente, SHA-256
 *   con una sal aleatoria de 128 bits es suficiente para este caso de uso.
 *
 * @param {string} text  Texto a hashear (PIN + sal)
 * @returns {Promise<string>} Hash en hexadecimal
 */
export async function sha256(text) {
  const data = new TextEncoder().encode(text)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Genera una sal criptográficamente segura de 128 bits (16 bytes).
 * Se usa una sal única por usuario para que dos PINs iguales
 * produzcan hashes diferentes y se prevengan ataques de tabla arcoíris.
 *
 * @returns {string} Sal en hexadecimal (32 caracteres)
 */
export function generateSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
