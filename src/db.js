"use strict";

/**
 * Conexión y esquema de la base de datos de DELI GELATO.
 * Usa el módulo nativo node:sqlite (Node >= 22.5) y, si no está
 * disponible, recurre a better-sqlite3.
 */

const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");

// --- Abrir la base de datos ---
function abrir() {
  fs.mkdirSync(path.dirname(config.rutaBaseDatos), { recursive: true });

  let db;
  try {
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(config.rutaBaseDatos);
  } catch {
    const Database = require("better-sqlite3");
    db = new Database(config.rutaBaseDatos);
  }
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

const db = abrir();

// ============================================================
// ESQUEMA
// ============================================================

db.exec(`
-- Administradores y personal autorizado
CREATE TABLE IF NOT EXISTS admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre         TEXT NOT NULL DEFAULT '',
  password_hash  TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'empleado' CHECK (rol IN ('principal','empleado')),
  activo         INTEGER NOT NULL DEFAULT 1,
  email_verificado INTEGER NOT NULL DEFAULT 0,
  puede_canjear  INTEGER NOT NULL DEFAULT 0,
  creado_por     INTEGER REFERENCES admins(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at  TEXT
);

-- Sesiones de administrador (token almacenado como hash)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash  TEXT NOT NULL UNIQUE,
  admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tokens de verificación de email / recuperación de contraseña
CREATE TABLE IF NOT EXISTS admin_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('verificacion','recuperacion')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Clientes / socios (SOLO nombre, sin datos personales adicionales)
CREATE TABLE IF NOT EXISTS clientes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo             TEXT NOT NULL UNIQUE,
  nombre             TEXT NOT NULL,
  access_token_hash  TEXT NOT NULL UNIQUE,
  token_expira       TEXT,
  activo             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);

-- Movimientos de sellos (cada fila = un movimiento auditado)
CREATE TABLE IF NOT EXISTS sellos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  cantidad      INTEGER NOT NULL,
  ticket        TEXT,
  empleado_id   INTEGER REFERENCES admins(id),
  motivo        TEXT,
  anulado       INTEGER NOT NULL DEFAULT 0,
  anulado_por   INTEGER REFERENCES admins(id),
  anulado_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sellos_cliente ON sellos(cliente_id);
-- Evita registrar dos veces el mismo ticket para el mismo cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellos_ticket_unico
  ON sellos(cliente_id, ticket) WHERE ticket IS NOT NULL AND anulado = 0;

-- Recompensas configurables desde el panel (nada fijo en el código)
CREATE TABLE IF NOT EXISTS recompensas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre            TEXT NOT NULL,
  descripcion       TEXT NOT NULL DEFAULT '',
  sellos_requeridos INTEGER NOT NULL CHECK (sellos_requeridos > 0),
  condiciones       TEXT NOT NULL DEFAULT '',
  icono             TEXT NOT NULL DEFAULT '🍦',
  activo            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recompensas desbloqueadas por cliente (con copia histórica de sus datos)
CREATE TABLE IF NOT EXISTS recompensas_otorgadas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id          INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  recompensa_id       INTEGER REFERENCES recompensas(id) ON DELETE SET NULL,
  nombre_snapshot     TEXT NOT NULL,
  descripcion_snapshot TEXT NOT NULL DEFAULT '',
  sellos_requeridos_snapshot INTEGER NOT NULL,
  ciclo               INTEGER NOT NULL DEFAULT 1,
  estado              TEXT NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','canjeada','anulada')),
  desbloqueada_at     TEXT NOT NULL DEFAULT (datetime('now')),
  canjeada_at         TEXT,
  canjeada_por        INTEGER REFERENCES admins(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otorgadas_cliente ON recompensas_otorgadas(cliente_id);
-- Una misma recompensa solo puede otorgarse una vez por ciclo y cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_otorgadas_unica
  ON recompensas_otorgadas(cliente_id, recompensa_id, ciclo);

-- Registro de auditoría (todas las operaciones administrativas)
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER REFERENCES admins(id),
  admin_email TEXT,
  accion      TEXT NOT NULL,
  entidad     TEXT,
  entidad_id  TEXT,
  detalle     TEXT,
  motivo      TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuración general del programa (clave/valor editable)
CREATE TABLE IF NOT EXISTS config (
  clave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ============================================================
// VALORES INICIALES
// ============================================================

const CONFIG_DEFECTO = {
  sellos_por_compra: String(config.programa.sellosPorCompra),
  tamano_tarjeta: String(config.programa.tamanoTarjeta),
  // "acumular": al completar la tarjeta, los sellos siguen sumando.
  // "reiniciar": al completar, el progreso vuelve a cero (se conserva el historial).
  regla_reinicio: "acumular",
  nombre_negocio: "DELI GELATO",
  // 1 = mostrar las recompensas en la página pública. El REGISTRO nunca las muestra.
  recompensas_visibles_publico: "1",
};

function sembrarConfig() {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)"
  );
  for (const [clave, valor] of Object.entries(CONFIG_DEFECTO)) insert.run(clave, valor);
}

function sembrarRecompensas() {
  const hay = db.prepare("SELECT COUNT(*) AS n FROM recompensas").get().n;
  if (hay > 0) return;
  const insert = db.prepare(
    `INSERT INTO recompensas (nombre, descripcion, sellos_requeridos, condiciones, icono)
     VALUES (?, ?, ?, ?, ?)`
  );
  insert.run("Galleta de miel", "Una galleta de miel artesanal.", 3, "", "🍪");
  insert.run("Mini bolita extra", "Una mini bolita extra para tu helado.", 6, "", "🍨");
  insert.run("Helado gratis", "Un helado gratis de dos sabores.", 10, "Válido en compras posteriores.", "🍦");
}

sembrarConfig();
sembrarRecompensas();

// ============================================================
// AYUDAS DE CONFIGURACIÓN
// ============================================================

function leerConfig(clave, porDefecto = null) {
  const fila = db.prepare("SELECT valor FROM config WHERE clave = ?").get(clave);
  return fila ? fila.valor : porDefecto;
}

function escribirConfig(clave, valor) {
  db.prepare(
    `INSERT INTO config (clave, valor, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = datetime('now')`
  ).run(clave, String(valor));
}

function leerConfigEntero(clave, porDefecto = 0) {
  const v = parseInt(leerConfig(clave, String(porDefecto)), 10);
  return Number.isFinite(v) ? v : porDefecto;
}

module.exports = { db, leerConfig, escribirConfig, leerConfigEntero, CONFIG_DEFECTO };
