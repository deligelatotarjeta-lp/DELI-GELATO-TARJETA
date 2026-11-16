"use strict";

/**
 * Autenticación propia de administradores y personal de DELI GELATO.
 * - Contraseñas con hash scrypt.
 * - Sesiones con token aleatorio (se guarda solo el hash).
 * - Token CSRF por sesión.
 */

const { db } = require("./db");
const {
  hashPassword,
  verificarPassword,
  generarToken,
  sha256,
} = require("./security");
const config = require("./config");
const { auditar } = require("./logica");

// ============================================================
// CUENTAS
// ============================================================

function buscarAdminPorEmail(email) {
  return db.prepare("SELECT * FROM admins WHERE email = ?").get(String(email || "").trim().toLowerCase()) || null;
}

function obtenerAdmin(id) {
  return db.prepare("SELECT * FROM admins WHERE id = ?").get(id) || null;
}

/**
 * Crea una cuenta administrativa. Solo el administrador principal puede
 * crear empleados (se valida en la ruta). El principal se crea con seed.js.
 */
function crearAdmin({ email, password, nombre = "", rol = "empleado", puedeCanjear = 0, creadoPor = null, emailVerificado = 0 }) {
  const correo = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw Object.assign(new Error("Correo electrónico no válido."), { codigo: 400 });
  }
  if (String(password || "").length < 8) {
    throw Object.assign(new Error("La contraseña debe tener al menos 8 caracteres."), { codigo: 400 });
  }
  if (buscarAdminPorEmail(correo)) {
    throw Object.assign(new Error("Ya existe una cuenta con ese correo."), { codigo: 409 });
  }
  const info = db
    .prepare(
      `INSERT INTO admins (email, nombre, password_hash, rol, puede_canjear, creado_por, email_verificado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(correo, nombre, hashPassword(password), rol, puedeCanjear ? 1 : 0, creadoPor, emailVerificado ? 1 : 0);
  return obtenerAdmin(Number(info.lastInsertRowid));
}

function listarAdmins() {
  return db
    .prepare("SELECT id, email, nombre, rol, activo, email_verificado, puede_canjear, created_at, last_login_at FROM admins ORDER BY rol DESC, created_at ASC")
    .all();
}

function actualizarAdmin(id, cambios) {
  const campos = [];
  const valores = [];
  const permitidos = ["nombre", "rol", "activo", "puede_canjear", "email_verificado"];
  for (const [clave, valor] of Object.entries(cambios)) {
    if (!permitidos.includes(clave)) continue;
    campos.push(`${clave} = ?`);
    valores.push(typeof valor === "boolean" ? (valor ? 1 : 0) : valor);
  }
  if (!campos.length) return obtenerAdmin(id);
  valores.push(id);
  db.prepare(`UPDATE admins SET ${campos.join(", ")} WHERE id = ?`).run(...valores);
  return obtenerAdmin(id);
}

function cambiarPassword(adminId, nuevaPassword) {
  if (String(nuevaPassword || "").length < 8) {
    throw Object.assign(new Error("La contraseña debe tener al menos 8 caracteres."), { codigo: 400 });
  }
  db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(hashPassword(nuevaPassword), adminId);
}

// ============================================================
// SESIONES
// ============================================================

function crearSesion(admin, ip) {
  const token = generarToken(32);
  const csrf = generarToken(24);
  const expira = new Date(Date.now() + config.duracionSesionAdminMs).toISOString();
  db.prepare(
    `INSERT INTO admin_sessions (token_hash, admin_id, csrf_token, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(sha256(token), admin.id, csrf, expira);
  db.prepare("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?").run(admin.id);
  auditar({ adminId: admin.id, adminEmail: admin.email, accion: "admin.login", entidad: "admin", entidadId: admin.id, ip });
  return { token, csrf, expira };
}

function validarSesion(token) {
  if (!token) return null;
  const fila = db
    .prepare("SELECT * FROM admin_sessions WHERE token_hash = ?")
    .get(sha256(token));
  if (!fila) return null;
  if (new Date(fila.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM admin_sessions WHERE id = ?").run(fila.id);
    return null;
  }
  const admin = obtenerAdmin(fila.admin_id);
  if (!admin || !admin.activo) return null;
  return { session: fila, admin };
}

function cerrarSesion(token) {
  if (!token) return;
  db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(sha256(token));
}

/** Inicia sesión. Devuelve { admin, token, csrf } o lanza error 401. */
function iniciarSesion(email, password, ip) {
  const admin = buscarAdminPorEmail(email);
  // Verificación con mensaje genérico para no revelar si el correo existe
  if (!admin || !admin.activo || !verificarPassword(password, admin.password_hash)) {
    throw Object.assign(new Error("Correo o contraseña incorrectos."), { codigo: 401 });
  }
  const sesion = crearSesion(admin, ip);
  return { admin, ...sesion };
}

function limpiarSesionesExpiradas() {
  db.prepare("DELETE FROM admin_sessions WHERE expires_at < datetime('now')").run();
}

// ============================================================
// TOKENS DE VERIFICACIÓN / RECUPERACIÓN
// ============================================================

function crearTokenAdmin(adminId, tipo, horasValidez = 2) {
  const token = generarToken(32);
  const expira = new Date(Date.now() + horasValidez * 3600000).toISOString();
  db.prepare(
    `INSERT INTO admin_tokens (admin_id, tipo, token_hash, expires_at) VALUES (?, ?, ?, ?)`
  ).run(adminId, tipo, sha256(token), expira);
  return token;
}

function usarTokenAdmin(token, tipo) {
  const fila = db
    .prepare("SELECT * FROM admin_tokens WHERE token_hash = ? AND tipo = ?")
    .get(sha256(token), tipo);
  if (!fila) throw Object.assign(new Error("Enlace no válido."), { codigo: 400 });
  if (fila.used_at) throw Object.assign(new Error("Este enlace ya fue utilizado."), { codigo: 400 });
  if (new Date(fila.expires_at).getTime() < Date.now()) {
    throw Object.assign(new Error("El enlace ha caducado."), { codigo: 400 });
  }
  db.prepare("UPDATE admin_tokens SET used_at = datetime('now') WHERE id = ?").run(fila.id);
  return fila.admin_id;
}

module.exports = {
  buscarAdminPorEmail,
  obtenerAdmin,
  crearAdmin,
  listarAdmins,
  actualizarAdmin,
  cambiarPassword,
  crearSesion,
  validarSesion,
  cerrarSesion,
  iniciarSesion,
  limpiarSesionesExpiradas,
  crearTokenAdmin,
  usarTokenAdmin,
};
