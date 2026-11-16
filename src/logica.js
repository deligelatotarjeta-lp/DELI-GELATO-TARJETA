"use strict";

/**
 * Lógica de negocio de DELI GELATO.
 * Toda operación sensible se ejecuta y se valida AQUÍ (en el servidor),
 * nunca en el navegador del cliente.
 */

const { db, leerConfig, leerConfigEntero } = require("./db");
const {
  generarToken,
  sha256,
  generarCodigoSocio,
} = require("./security");
const config = require("./config");

// ============================================================
// AUDITORÍA
// ============================================================

function auditar({ adminId = null, adminEmail = null, accion, entidad = null, entidadId = null, detalle = null, motivo = null, ip = null }) {
  db.prepare(
    `INSERT INTO auditoria (admin_id, admin_email, accion, entidad, entidad_id, detalle, motivo, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    adminId,
    adminEmail,
    accion,
    entidad,
    entidadId == null ? null : String(entidadId),
    detalle == null ? null : (typeof detalle === "string" ? detalle : JSON.stringify(detalle)),
    motivo,
    ip
  );
}

// ============================================================
// CLIENTES
// ============================================================

/** Crea un socio nuevo. Devuelve { cliente, token } (el token solo se ve una vez). */
function crearCliente(nombre, ip = null) {
  const limpio = String(nombre || "").trim().replace(/\s+/g, " ");
  if (limpio.length < 2 || limpio.length > 80) {
    throw Object.assign(new Error("El nombre debe tener entre 2 y 80 caracteres."), { codigo: 400 });
  }

  const token = generarToken(32);
  const tokenHash = sha256(token);
  const expira = new Date(Date.now() + config.duracionTokenClienteDias * 86400000).toISOString();

  // Reintenta si por azar el código ya existe
  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigoSocio();
    try {
      const info = db
        .prepare(
          `INSERT INTO clientes (codigo, nombre, access_token_hash, token_expira)
           VALUES (?, ?, ?, ?)`
        )
        .run(codigo, limpio, tokenHash, expira);
      const cliente = obtenerCliente(Number(info.lastInsertRowid));
      auditar({ accion: "cliente.creado", entidad: "cliente", entidadId: cliente.id, detalle: { codigo }, ip });
      return { cliente, token };
    } catch (e) {
      if (String(e.message).includes("UNIQUE") && intento < 4) continue;
      throw e;
    }
  }
  throw new Error("No se pudo generar un código de socio único.");
}

function obtenerCliente(id) {
  return db.prepare("SELECT * FROM clientes WHERE id = ?").get(id) || null;
}

function buscarPorCodigo(codigo) {
  const c = String(codigo || "").trim().toUpperCase();
  return db.prepare("SELECT * FROM clientes WHERE codigo = ?").get(c) || null;
}

/** Autentica a un cliente por su token personal. */
function clientePorToken(token) {
  if (!token) return null;
  const hash = sha256(token);
  const cliente = db
    .prepare("SELECT * FROM clientes WHERE access_token_hash = ? AND activo = 1")
    .get(hash);
  if (!cliente) return null;
  if (cliente.token_expira && new Date(cliente.token_expira).getTime() < Date.now()) return null;
  return cliente;
}

/** El personal autorizado genera un nuevo enlace de acceso (recuperación). */
function regenerarTokenCliente(clienteId, admin, ip) {
  const token = generarToken(32);
  const expira = new Date(Date.now() + config.duracionTokenClienteDias * 86400000).toISOString();
  db.prepare("UPDATE clientes SET access_token_hash = ?, token_expira = ? WHERE id = ?").run(
    sha256(token),
    expira,
    clienteId
  );
  auditar({ adminId: admin.id, adminEmail: admin.email, accion: "cliente.token_regenerado", entidad: "cliente", entidadId: clienteId, ip });
  return token;
}

function listarClientes({ busqueda = "", limite = 50, offset = 0 } = {}) {
  const like = `%${String(busqueda).trim()}%`;
  const filas = db
    .prepare(
      `SELECT c.*,
              (SELECT COALESCE(SUM(s.cantidad),0) FROM sellos s WHERE s.cliente_id = c.id AND s.anulado = 0) AS sellos_validos,
              (SELECT COUNT(*) FROM recompensas_otorgadas o WHERE o.cliente_id = c.id AND o.estado = 'pendiente') AS pendientes
       FROM clientes c
       WHERE (? = '%%' OR c.nombre LIKE ? OR c.codigo LIKE ?)
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(like, like, like, limite, offset);
  return filas;
}

function contarClientes() {
  return db.prepare("SELECT COUNT(*) AS n FROM clientes").get().n;
}

// ============================================================
// SELLOS Y PROGRESO
// ============================================================

function sellosValidos(clienteId) {
  const fila = db
    .prepare("SELECT COALESCE(SUM(cantidad),0) AS n FROM sellos WHERE cliente_id = ? AND anulado = 0")
    .get(clienteId);
  return Number(fila.n) || 0;
}

/**
 * Calcula el progreso de la tarjeta según la regla configurada.
 *  - "reiniciar": la tarjeta se completa y vuelve a empezar (ciclos).
 *  - "acumular": los sellos siguen sumando sin reiniciar.
 */
function progreso(clienteId) {
  const total = sellosValidos(clienteId);
  const tamano = Math.max(1, leerConfigEntero("tamano_tarjeta", 10));
  const regla = leerConfig("regla_reinicio", "acumular");

  let enTarjeta;
  let ciclo;
  if (regla === "reiniciar") {
    enTarjeta = total === 0 ? 0 : ((total - 1) % tamano) + 1;
    ciclo = total === 0 ? 1 : Math.ceil(total / tamano);
  } else {
    enTarjeta = total;
    ciclo = 1;
  }

  return {
    regla,
    total,
    tamano,
    enTarjeta,
    ciclo,
    tarjetaCompleta: regla === "reiniciar" ? enTarjeta >= tamano : enTarjeta >= tamano,
    porcentaje: Math.min(100, Math.round((enTarjeta / tamano) * 100)),
  };
}

/**
 * Registra sellos. Valida en el servidor: cantidad, ticket duplicado, etc.
 * Devuelve { sello, nuevasRecompensas, progreso }.
 */
function agregarSellos({ clienteId, cantidad, ticket, empleado, motivo = null, ip = null }) {
  const cliente = obtenerCliente(clienteId);
  if (!cliente) throw Object.assign(new Error("Cliente no encontrado."), { codigo: 404 });
  if (!cliente.activo) throw Object.assign(new Error("El cliente está inactivo."), { codigo: 400 });

  let cant = parseInt(cantidad, 10);
  if (!Number.isFinite(cant) || cant === 0) cant = leerConfigEntero("sellos_por_compra", 1);
  if (cant < 1 || cant > 50) {
    throw Object.assign(new Error("La cantidad de sellos debe estar entre 1 y 50."), { codigo: 400 });
  }

  const ticketLimpio = ticket ? String(ticket).trim().slice(0, 40) : null;

  let info;
  try {
    info = db
      .prepare(
        `INSERT INTO sellos (cliente_id, cantidad, ticket, empleado_id, motivo)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(clienteId, cant, ticketLimpio, empleado.id, motivo);
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      throw Object.assign(
        new Error("Ya existe un sello registrado con ese número de ticket para este cliente."),
        { codigo: 409 }
      );
    }
    throw e;
  }

  const selloId = Number(info.lastInsertRowid);
  auditar({
    adminId: empleado.id,
    adminEmail: empleado.email,
    accion: "sello.agregado",
    entidad: "sello",
    entidadId: selloId,
    detalle: { clienteId, codigo: cliente.codigo, cantidad: cant, ticket: ticketLimpio },
    motivo,
    ip,
  });

  const nuevasRecompensas = evaluarRecompensas(clienteId, empleado, ip);
  return { selloId, nuevasRecompensas, progreso: progreso(clienteId) };
}

/** Anula un sello (solo administrador, con motivo). */
function anularSello(selloId, admin, motivo, ip) {
  const sello = db.prepare("SELECT * FROM sellos WHERE id = ?").get(selloId);
  if (!sello) throw Object.assign(new Error("Sello no encontrado."), { codigo: 404 });
  if (sello.anulado) throw Object.assign(new Error("El sello ya estaba anulado."), { codigo: 409 });

  db.prepare(
    "UPDATE sellos SET anulado = 1, anulado_por = ?, anulado_at = datetime('now') WHERE id = ?"
  ).run(admin.id, selloId);

  auditar({
    adminId: admin.id,
    adminEmail: admin.email,
    accion: "sello.anulado",
    entidad: "sello",
    entidadId: selloId,
    detalle: { clienteId: sello.cliente_id, cantidad: sello.cantidad },
    motivo,
    ip,
  });
  return progreso(sello.cliente_id);
}

function historialSellos(clienteId, limite = 100) {
  return db
    .prepare(
      `SELECT s.*, a.nombre AS empleado_nombre, a.email AS empleado_email
       FROM sellos s LEFT JOIN admins a ON a.id = s.empleado_id
       WHERE s.cliente_id = ?
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ?`
    )
    .all(clienteId, limite);
}

// ============================================================
// RECOMPENSAS
// ============================================================

function listarRecompensas({ soloActivas = false } = {}) {
  const sql = soloActivas
    ? "SELECT * FROM recompensas WHERE activo = 1 ORDER BY sellos_requeridos ASC"
    : "SELECT * FROM recompensas ORDER BY sellos_requeridos ASC, id ASC";
  return db.prepare(sql).all();
}

/**
 * Otorga las recompensas alcanzadas por el cliente.
 * Usa el índice único (cliente, recompensa, ciclo) para no duplicar.
 */
function evaluarRecompensas(clienteId, admin = null, ip = null) {
  const p = progreso(clienteId);
  const activas = listarRecompensas({ soloActivas: true });
  const nuevas = [];

  for (const r of activas) {
    if (p.enTarjeta < r.sellos_requeridos) continue;
    const ciclo = p.regla === "reiniciar" ? p.ciclo : 1;
    const info = db
      .prepare(
        `INSERT OR IGNORE INTO recompensas_otorgadas
           (cliente_id, recompensa_id, nombre_snapshot, descripcion_snapshot, sellos_requeridos_snapshot, ciclo, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`
      )
      .run(clienteId, r.id, r.nombre, r.descripcion, r.sellos_requeridos, ciclo);
    if (info.changes > 0) {
      nuevas.push({ ...r, ciclo, id_otorgada: Number(info.lastInsertRowid) });
      auditar({
        adminId: admin ? admin.id : null,
        adminEmail: admin ? admin.email : null,
        accion: "recompensa.desbloqueada",
        entidad: "recompensas_otorgadas",
        entidadId: Number(info.lastInsertRowid),
        detalle: { clienteId, recompensa: r.nombre, ciclo },
        ip,
      });
    }
  }
  return nuevas;
}

function recompensasDeCliente(clienteId) {
  return db
    .prepare(
      `SELECT o.*, a.nombre AS canjeada_por_nombre
       FROM recompensas_otorgadas o LEFT JOIN admins a ON a.id = o.canjeada_por
       WHERE o.cliente_id = ?
       ORDER BY o.desbloqueada_at DESC, o.id DESC`
    )
    .all(clienteId);
}

/** Confirma la entrega de una recompensa. Evita el doble canje. */
function confirmarCanje(otorgadaId, admin, ip) {
  const o = db.prepare("SELECT * FROM recompensas_otorgadas WHERE id = ?").get(otorgadaId);
  if (!o) throw Object.assign(new Error("Recompensa no encontrada."), { codigo: 404 });
  if (o.estado === "canjeada") {
    throw Object.assign(new Error("Esta recompensa ya fue canjeada."), { codigo: 409 });
  }
  if (o.estado !== "pendiente") {
    throw Object.assign(new Error("La recompensa no está disponible para canje."), { codigo: 409 });
  }

  const info = db
    .prepare(
      `UPDATE recompensas_otorgadas
       SET estado = 'canjeada', canjeada_at = datetime('now'), canjeada_por = ?
       WHERE id = ? AND estado = 'pendiente'`
    )
    .run(admin.id, otorgadaId);

  if (info.changes === 0) {
    throw Object.assign(new Error("La recompensa ya había sido canjeada."), { codigo: 409 });
  }

  auditar({
    adminId: admin.id,
    adminEmail: admin.email,
    accion: "recompensa.canjeada",
    entidad: "recompensas_otorgadas",
    entidadId: otorgadaId,
    detalle: { clienteId: o.cliente_id, recompensa: o.nombre_snapshot, ciclo: o.ciclo },
    ip,
  });
  return db.prepare("SELECT * FROM recompensas_otorgadas WHERE id = ?").get(otorgadaId);
}

// ============================================================
// TARJETA COMPLETA (para el cliente)
// ============================================================

function tarjetaDeCliente(cliente) {
  const p = progreso(cliente.id);
  const otorgadas = recompensasDeCliente(cliente.id);
  const pendientes = otorgadas.filter((o) => o.estado === "pendiente");
  const canjeadas = otorgadas.filter((o) => o.estado === "canjeada");

  return {
    nombre: cliente.nombre,
    codigo: cliente.codigo,
    activo: Boolean(cliente.activo),
    creado: cliente.created_at,
    progreso: p,
    sellos: {
      actuales: p.enTarjeta,
      totales: p.total,
      tamano: p.tamano,
      ciclo: p.ciclo,
      porcentaje: p.porcentaje,
      tarjetaCompleta: p.tarjetaCompleta,
    },
    recompensasPendientes: pendientes,
    recompensasCanjeadas: canjeadas,
    historial: historialSellos(cliente.id, 50),
  };
}

// ============================================================
// ESTADÍSTICAS
// ============================================================

function estadisticas() {
  const totalClientes = contarClientes();
  const totalSellos = db.prepare("SELECT COALESCE(SUM(cantidad),0) AS n FROM sellos WHERE anulado = 0").get().n;
  const sellosHoy = db
    .prepare("SELECT COALESCE(SUM(cantidad),0) AS n FROM sellos WHERE anulado = 0 AND date(created_at) = date('now')")
    .get().n;
  const pendientes = db.prepare("SELECT COUNT(*) AS n FROM recompensas_otorgadas WHERE estado = 'pendiente'").get().n;
  const canjeadas = db.prepare("SELECT COUNT(*) AS n FROM recompensas_otorgadas WHERE estado = 'canjeada'").get().n;
  const clientesHoy = db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE date(created_at) = date('now')").get().n;

  const ultimosSellos = db
    .prepare(
      `SELECT s.id, s.cantidad, s.ticket, s.created_at, c.nombre AS cliente, c.codigo, a.nombre AS empleado
       FROM sellos s
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN admins a ON a.id = s.empleado_id
       WHERE s.anulado = 0
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT 10`
    )
    .all();

  return {
    totalClientes,
    clientesHoy,
    totalSellos: Number(totalSellos),
    sellosHoy: Number(sellosHoy),
    recompensasPendientes: pendientes,
    recompensasCanjeadas: canjeadas,
    ultimosSellos,
  };
}

module.exports = {
  auditar,
  crearCliente,
  obtenerCliente,
  buscarPorCodigo,
  clientePorToken,
  regenerarTokenCliente,
  listarClientes,
  contarClientes,
  sellosValidos,
  progreso,
  agregarSellos,
  anularSello,
  historialSellos,
  listarRecompensas,
  evaluarRecompensas,
  recompensasDeCliente,
  confirmarCanje,
  tarjetaDeCliente,
  estadisticas,
};
