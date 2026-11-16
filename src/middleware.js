"use strict";

/**
 * Middlewares de seguridad de DELI GELATO.
 */

const config = require("./config");
const { validarSesion } = require("./sesiones");
const { clientePorToken, auditar } = require("./logica");
const { limitar } = require("./security");

const COOKIE_ADMIN = "dg_sesion";
const COOKIE_CLIENTE = "dg_cliente";

// ============================================================
// COOKIES
// ============================================================

function analizarCookies(req, res, next) {
  const cabecera = req.headers.cookie || "";
  const cookies = {};
  for (const parte of cabecera.split(";")) {
    const idx = parte.indexOf("=");
    if (idx === -1) continue;
    const clave = parte.slice(0, idx).trim();
    const valor = parte.slice(idx + 1).trim();
    if (clave) cookies[clave] = decodeURIComponent(valor);
  }
  req.cookies = cookies;
  next();
}

function ponerCookie(res, nombre, valor, { maxAgeSeg, httpOnly = true } = {}) {
  const partes = [
    `${nombre}=${encodeURIComponent(valor)}`,
    "Path=/",
    "SameSite=Strict",
  ];
  if (httpOnly) partes.push("HttpOnly");
  if (config.esProduccion) partes.push("Secure");
  if (maxAgeSeg != null) partes.push(`Max-Age=${maxAgeSeg}`);
  const actuales = res.getHeader("Set-Cookie");
  const lista = actuales ? (Array.isArray(actuales) ? actuales : [actuales]) : [];
  lista.push(partes.join("; "));
  res.setHeader("Set-Cookie", lista);
}

function borrarCookie(res, nombre) {
  ponerCookie(res, nombre, "", { maxAgeSeg: 0 });
}

// ============================================================
// LÍMITE DE PETICIONES
// ============================================================

function limitarPeticiones(maximo, ventanaMs, mensaje = "Demasiadas peticiones. Inténtalo más tarde.") {
  return (req, res, next) => {
    const clave = `${req.ip}|${req.method}|${req.path}`;
    const { permitido } = limitar(clave, maximo, ventanaMs);
    if (!permitido) {
      return res.status(429).json({ error: mensaje });
    }
    next();
  };
}

// ============================================================
// AUTENTICACIÓN ADMINISTRATIVA
// ============================================================

function requerirAdmin(req, res, next) {
  const token = req.cookies[COOKIE_ADMIN];
  const sesion = validarSesion(token);
  if (!sesion) {
    return res.status(401).json({ error: "Sesión no válida o caducada." });
  }
  req.admin = sesion.admin;
  req.sesion = sesion.session;
  next();
}

function requerirPrincipal(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: "No autenticado." });
  if (req.admin.rol !== "principal") {
    return res.status(403).json({ error: "Solo el administrador principal puede realizar esta acción." });
  }
  next();
}

function requerirPermisoCanje(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: "No autenticado." });
  if (req.admin.rol === "principal" || req.admin.puede_canjear) return next();
  return res.status(403).json({ error: "No tienes autorización para confirmar canjes." });
}

/** Comprueba el token CSRF en métodos que modifican datos. */
function verificarCsrf(req, res, next) {
  const metodo = req.method.toUpperCase();
  if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return next();
  if (!req.sesion) return res.status(401).json({ error: "Sesión no válida." });
  const enviado = req.get("x-csrf-token") || (req.body && req.body._csrf);
  if (!enviado || enviado !== req.sesion.csrf_token) {
    return res.status(403).json({ error: "Token de seguridad inválido. Recarga la página." });
  }
  next();
}

// ============================================================
// AUTENTICACIÓN DE CLIENTES
// ============================================================

function requerirCliente(req, res, next) {
  const cabecera = req.get("authorization") || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : req.cookies[COOKIE_CLIENTE];
  const cliente = clientePorToken(token);
  if (!cliente) {
    return res.status(401).json({ error: "No se pudo acceder a tu tarjeta. Solicita ayuda al personal." });
  }
  req.cliente = cliente;
  next();
}

/** Evita el almacenamiento en caché de respuestas con datos personales. */
function sinCache(req, res, next) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  next();
}

/** Cabeceras de seguridad básicas. */
function cabecerasSeguridad(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  next();
}

module.exports = {
  COOKIE_ADMIN,
  COOKIE_CLIENTE,
  analizarCookies,
  ponerCookie,
  borrarCookie,
  limitarPeticiones,
  requerirAdmin,
  requerirPrincipal,
  requerirPermisoCanje,
  verificarCsrf,
  requerirCliente,
  sinCache,
  cabecerasSeguridad,
};
