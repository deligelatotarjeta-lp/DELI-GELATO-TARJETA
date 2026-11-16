"use strict";

/**
 * Utilidades de seguridad: contraseñas, tokens, firmas y límite de peticiones.
 * Todo se apoya en el módulo criptográfico nativo de Node (node:crypto).
 */

const crypto = require("node:crypto");

// ============================================================
// CONTRASEÑAS (scrypt)
// ============================================================

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = { N: 16384, r: 8, p: 1 };

/**
 * Devuelve un hash con formato "scrypt$N$r$p$salt$hash".
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, SCRYPT_COST);
  return [
    "scrypt",
    SCRYPT_COST.N,
    SCRYPT_COST.r,
    SCRYPT_COST.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

/**
 * Compara una contraseña con un hash almacenado (tiempo constante).
 */
function verificarPassword(password, almacenado) {
  try {
    const partes = String(almacenado).split("$");
    if (partes.length !== 6 || partes[0] !== "scrypt") return false;
    const [, N, r, p, saltB64, hashB64] = partes;
    const salt = Buffer.from(saltB64, "base64");
    const esperado = Buffer.from(hashB64, "base64");
    const calculado = crypto.scryptSync(String(password), salt, esperado.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

// ============================================================
// TOKENS Y HASHES
// ============================================================

/** Token aleatorio seguro, apto para URL. */
function generarToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Hash SHA-256 en hexadecimal (para almacenar tokens sin exponerlos). */
function sha256(valor) {
  return crypto.createHash("sha256").update(String(valor)).digest("hex");
}

/** Comparación en tiempo constante de dos cadenas. */
function compararSeguro(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Firma HMAC-SHA256 en base64url (para cookies). */
function firmar(valor, secreto) {
  return crypto.createHmac("sha256", secreto).update(String(valor)).digest("base64url");
}

/** Genera un código de socio con formato DG-XXXXXX (sin caracteres ambiguos). */
function generarCodigoSocio() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0, I/1/L
  let sufijo = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) sufijo += alfabeto[bytes[i] % alfabeto.length];
  return "DG-" + sufijo;
}

// ============================================================
// LÍMITE DE PETICIONES (en memoria)
// ============================================================

const intentos = new Map();

/**
 * Ventana deslizante simple por clave (ej. IP + ruta).
 * Devuelve { permitido, restantes }.
 */
function limitar(clave, maximo, ventanaMs) {
  const ahora = Date.now();
  const registro = intentos.get(clave) || { inicio: ahora, cuenta: 0 };
  if (ahora - registro.inicio > ventanaMs) {
    registro.inicio = ahora;
    registro.cuenta = 0;
  }
  registro.cuenta += 1;
  intentos.set(clave, registro);
  return { permitido: registro.cuenta <= maximo, restantes: Math.max(0, maximo - registro.cuenta) };
}

// Limpieza periódica para no crecer sin límite
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, reg] of intentos) {
    if (ahora - reg.inicio > 1000 * 60 * 60) intentos.delete(clave);
  }
}, 1000 * 60 * 10).unref();

module.exports = {
  hashPassword,
  verificarPassword,
  generarToken,
  sha256,
  compararSeguro,
  firmar,
  generarCodigoSocio,
  limitar,
};
