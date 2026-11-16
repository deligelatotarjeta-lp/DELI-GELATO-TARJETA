"use strict";

/**
 * Rutas del panel administrativo.
 * Todas las operaciones sensibles se validan en el servidor y quedan auditadas.
 */

const express = require("express");
const config = require("../config");
const { leerConfig, leerConfigEntero, escribirConfig, db } = require("../db");
const logica = require("../logica");
const ses = require("../sesiones");
const { enviarCorreo } = require("../correo");
const {
  ponerCookie,
  borrarCookie,
  limitarPeticiones,
  requerirAdmin,
  requerirPrincipal,
  requerirPermisoCanje,
  verificarCsrf,
  sinCache,
  COOKIE_ADMIN,
} = require("../middleware");

const router = express.Router();

// ============================================================
// AUTENTICACIÓN (sin sesión previa)
// ============================================================

router.post(
  "/login",
  limitarPeticiones(8, 5 * 60 * 1000, "Demasiados intentos. Espera unos minutos."),
  (req, res) => {
    try {
      const { email, password } = req.body || {};
      const { admin, token, csrf } = ses.iniciarSesion(email, password, req.ip);
      ponerCookie(res, COOKIE_ADMIN, token, { maxAgeSeg: config.duracionSesionAdminMs / 1000 });
      res.json({
        ok: true,
        csrf,
        admin: { id: admin.id, email: admin.email, nombre: admin.nombre, rol: admin.rol, puedeCanjear: Boolean(admin.puede_canjear) },
      });
    } catch (e) {
      res.status(e.codigo || 500).json({ error: e.message || "No se pudo iniciar sesión." });
    }
  }
);

// Solicitar recuperación de contraseña
router.post(
  "/recuperar",
  limitarPeticiones(5, 15 * 60 * 1000, "Demasiadas solicitudes. Inténtalo más tarde."),
  async (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const admin = ses.buscarAdminPorEmail(email);
    // Respuesta genérica: no revelamos si el correo existe
    const respuesta = { ok: true, mensaje: "Si el correo está registrado, recibirás un enlace de recuperación." };
    if (admin && admin.activo) {
      const token = ses.crearTokenAdmin(admin.id, "recuperacion", 2);
      const enlace = `${config.baseUrl}/admin/restablecer.html?token=${token}`;
      const envio = await enviarCorreo({
        para: admin.email,
        asunto: "Recuperación de contraseña — DELI GELATO",
        texto: `Para restablecer tu contraseña entra en: ${enlace}\nEl enlace caduca en 2 horas.`,
      });
      if (!envio.enviado && !config.esProduccion) respuesta.enlaceDesarrollo = enlace;
    }
    res.json(respuesta);
  }
);

router.post("/restablecer", limitarPeticiones(10, 15 * 60 * 1000), (req, res) => {
  try {
    const { token, password } = req.body || {};
    const adminId = ses.usarTokenAdmin(token, "recuperacion");
    ses.cambiarPassword(adminId, password);
    // Cierra todas las sesiones abiertas de ese administrador
    db.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").run(adminId);
    logica.auditar({ adminId, accion: "admin.password_restablecida", entidad: "admin", entidadId: adminId, ip: req.ip });
    res.json({ ok: true, mensaje: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.post("/verificar-email", (req, res) => {
  try {
    const { token } = req.body || {};
    const adminId = ses.usarTokenAdmin(token, "verificacion");
    db.prepare("UPDATE admins SET email_verificado = 1 WHERE id = ?").run(adminId);
    logica.auditar({ adminId, accion: "admin.email_verificado", entidad: "admin", entidadId: adminId, ip: req.ip });
    res.json({ ok: true, mensaje: "Correo verificado correctamente." });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

// ============================================================
// A PARTIR DE AQUÍ SE REQUIERE SESIÓN
// ============================================================

router.use(requerirAdmin, sinCache);

router.get("/me", (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      email: req.admin.email,
      nombre: req.admin.nombre,
      rol: req.admin.rol,
      puedeCanjear: Boolean(req.admin.puede_canjear),
    },
    csrf: req.sesion.csrf_token,
  });
});

router.post("/logout", verificarCsrf, (req, res) => {
  ses.cerrarSesion(req.cookies[COOKIE_ADMIN]);
  borrarCookie(res, COOKIE_ADMIN);
  res.json({ ok: true });
});

// Todas las peticiones que modifican datos exigen token CSRF
router.use(verificarCsrf);

// ------------------------------------------------------------
// RESUMEN Y ESTADÍSTICAS
// ------------------------------------------------------------
router.get("/resumen", (req, res) => {
  res.json(logica.estadisticas());
});

router.get("/estadisticas", (req, res) => {
  const porDia = db
    .prepare(
      `SELECT date(created_at) AS dia, COUNT(*) AS operaciones, COALESCE(SUM(cantidad),0) AS sellos
       FROM sellos WHERE anulado = 0 AND created_at >= date('now','-14 day')
       GROUP BY date(created_at) ORDER BY dia ASC`
    )
    .all();
  res.json({ ...logica.estadisticas(), porDia });
});

// ------------------------------------------------------------
// CLIENTES
// ------------------------------------------------------------
router.get("/clientes", (req, res) => {
  const busqueda = String(req.query.q || "");
  const limite = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  res.json({
    total: logica.contarClientes(),
    clientes: logica.listarClientes({ busqueda, limite, offset }),
  });
});

router.get("/clientes/:id", (req, res) => {
  const cliente = logica.obtenerCliente(Number(req.params.id));
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado." });
  res.json(logica.tarjetaDeCliente(cliente));
});

router.get("/clientes/codigo/:codigo", (req, res) => {
  const cliente = logica.buscarPorCodigo(req.params.codigo);
  if (!cliente) return res.status(404).json({ error: "No existe un socio con ese código." });
  res.json(logica.tarjetaDeCliente(cliente));
});

// Genera un nuevo enlace de acceso para un cliente (recuperación asistida)
router.post("/clientes/:id/nuevo-enlace", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!logica.obtenerCliente(id)) return res.status(404).json({ error: "Cliente no encontrado." });
    const token = logica.regenerarTokenCliente(id, req.admin, req.ip);
    res.json({ ok: true, enlaceAcceso: `${config.baseUrl}/acceso?t=${token}` });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// SELLOS
// ------------------------------------------------------------
router.post("/sellos", (req, res) => {
  try {
    const { clienteId, codigo, cantidad, ticket, motivo } = req.body || {};
    let id = clienteId ? Number(clienteId) : null;
    if (!id && codigo) {
      const c = logica.buscarPorCodigo(codigo);
      if (!c) return res.status(404).json({ error: "No existe un socio con ese código." });
      id = c.id;
    }
    if (!id) return res.status(400).json({ error: "Indica el cliente o el código de socio." });

    const resultado = logica.agregarSellos({
      clienteId: id,
      cantidad,
      ticket,
      motivo,
      empleado: req.admin,
      ip: req.ip,
    });
    const cliente = logica.obtenerCliente(id);
    res.status(201).json({
      ok: true,
      ...resultado,
      tarjeta: logica.tarjetaDeCliente(cliente),
    });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.post("/sellos/:id/anular", requerirPrincipal, (req, res) => {
  try {
    const motivo = String((req.body && req.body.motivo) || "").trim();
    if (motivo.length < 3) return res.status(400).json({ error: "Indica el motivo de la anulación." });
    const progreso = logica.anularSello(Number(req.params.id), req.admin, motivo, req.ip);
    res.json({ ok: true, progreso });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.get("/sellos", (req, res) => {
  const limite = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filas = db
    .prepare(
      `SELECT s.*, c.nombre AS cliente, c.codigo, a.nombre AS empleado
       FROM sellos s
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN admins a ON a.id = s.empleado_id
       ORDER BY s.created_at DESC, s.id DESC LIMIT ?`
    )
    .all(limite);
  res.json({ movimientos: filas });
});

// ------------------------------------------------------------
// RECOMPENSAS (configurables)
// ------------------------------------------------------------
router.get("/recompensas", (req, res) => {
  res.json({ recompensas: logica.listarRecompensas() });
});

router.post("/recompensas", requerirPrincipal, (req, res) => {
  try {
    const { nombre, descripcion, sellos_requeridos, condiciones, icono, activo } = req.body || {};
    const n = String(nombre || "").trim();
    const s = parseInt(sellos_requeridos, 10);
    if (n.length < 2) return res.status(400).json({ error: "El nombre es obligatorio." });
    if (!Number.isFinite(s) || s < 1) return res.status(400).json({ error: "Los sellos requeridos deben ser un número mayor que 0." });
    const info = db
      .prepare(
        `INSERT INTO recompensas (nombre, descripcion, sellos_requeridos, condiciones, icono, activo)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(n, String(descripcion || ""), s, String(condiciones || ""), String(icono || "🍦"), activo === false ? 0 : 1);
    const id = Number(info.lastInsertRowid);
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "recompensa.creada", entidad: "recompensa", entidadId: id, detalle: { nombre: n, sellos: s }, ip: req.ip });
    res.status(201).json({ ok: true, recompensa: db.prepare("SELECT * FROM recompensas WHERE id = ?").get(id) });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.put("/recompensas/:id", requerirPrincipal, (req, res) => {
  try {
    const id = Number(req.params.id);
    const actual = db.prepare("SELECT * FROM recompensas WHERE id = ?").get(id);
    if (!actual) return res.status(404).json({ error: "Recompensa no encontrada." });
    const { nombre, descripcion, sellos_requeridos, condiciones, icono, activo } = req.body || {};
    const s = sellos_requeridos === undefined ? actual.sellos_requeridos : parseInt(sellos_requeridos, 10);
    if (!Number.isFinite(s) || s < 1) return res.status(400).json({ error: "Los sellos requeridos deben ser un número mayor que 0." });
    db.prepare(
      `UPDATE recompensas SET nombre = ?, descripcion = ?, sellos_requeridos = ?, condiciones = ?, icono = ?, activo = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nombre === undefined ? actual.nombre : String(nombre).trim(),
      descripcion === undefined ? actual.descripcion : String(descripcion),
      s,
      condiciones === undefined ? actual.condiciones : String(condiciones),
      icono === undefined ? actual.icono : String(icono),
      activo === undefined ? actual.activo : (activo ? 1 : 0),
      id
    );
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "recompensa.modificada", entidad: "recompensa", entidadId: id, detalle: { antes: actual.nombre, sellos: s }, ip: req.ip });
    res.json({ ok: true, recompensa: db.prepare("SELECT * FROM recompensas WHERE id = ?").get(id) });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.delete("/recompensas/:id", requerirPrincipal, (req, res) => {
  try {
    const id = Number(req.params.id);
    const actual = db.prepare("SELECT * FROM recompensas WHERE id = ?").get(id);
    if (!actual) return res.status(404).json({ error: "Recompensa no encontrada." });
    // El historial se conserva: recompensas_otorgadas guarda copia (snapshot) y el FK queda en NULL.
    db.prepare("DELETE FROM recompensas WHERE id = ?").run(id);
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "recompensa.eliminada", entidad: "recompensa", entidadId: id, detalle: { nombre: actual.nombre }, ip: req.ip });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// CANJES
// ------------------------------------------------------------
router.get("/canjes", (req, res) => {
  const estado = String(req.query.estado || "");
  const filas = db
    .prepare(
      `SELECT o.*, c.nombre AS cliente, c.codigo, a.nombre AS canjeada_por_nombre
       FROM recompensas_otorgadas o
       JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN admins a ON a.id = o.canjeada_por
       WHERE (? = '' OR o.estado = ?)
       ORDER BY o.desbloqueada_at DESC, o.id DESC LIMIT 200`
    )
    .all(estado, estado);
  res.json({ canjes: filas });
});

router.post("/canjes/:id/confirmar", requerirPermisoCanje, (req, res) => {
  try {
    const otorgada = logica.confirmarCanje(Number(req.params.id), req.admin, req.ip);
    res.json({ ok: true, canje: otorgada });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// EMPLEADOS (solo administrador principal)
// ------------------------------------------------------------
router.get("/empleados", requerirPrincipal, (req, res) => {
  res.json({ empleados: ses.listarAdmins() });
});

router.post("/empleados", requerirPrincipal, async (req, res) => {
  try {
    const { email, password, nombre, puedeCanjear } = req.body || {};
    const admin = ses.crearAdmin({
      email,
      password,
      nombre,
      rol: "empleado",
      puedeCanjear: puedeCanjear ? 1 : 0,
      creadoPor: req.admin.id,
      emailVerificado: 0,
    });
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "empleado.creado", entidad: "admin", entidadId: admin.id, detalle: { email: admin.email }, ip: req.ip });

    // Envía enlace de verificación si hay SMTP
    const token = ses.crearTokenAdmin(admin.id, "verificacion", 24);
    const enlace = `${config.baseUrl}/admin/verificar.html?token=${token}`;
    const envio = await enviarCorreo({
      para: admin.email,
      asunto: "Verifica tu cuenta — DELI GELATO",
      texto: `Bienvenido al equipo de DELI GELATO. Verifica tu correo aquí: ${enlace}`,
    });
    res.status(201).json({ ok: true, empleado: admin, verificacionEnviada: envio.enviado, enlaceVerificacionDesarrollo: envio.enviado || config.esProduccion ? undefined : enlace });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.put("/empleados/:id", requerirPrincipal, (req, res) => {
  try {
    const id = Number(req.params.id);
    const objetivo = ses.obtenerAdmin(id);
    if (!objetivo) return res.status(404).json({ error: "Cuenta no encontrada." });
    if (objetivo.rol === "principal" && req.body && req.body.activo === false) {
      return res.status(400).json({ error: "No puedes desactivar al administrador principal." });
    }
    const admin = ses.actualizarAdmin(id, req.body || {});
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "empleado.modificado", entidad: "admin", entidadId: id, detalle: req.body, ip: req.ip });
    res.json({ ok: true, empleado: { ...admin, password_hash: undefined } });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

router.post("/empleados/:id/password", requerirPrincipal, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!ses.obtenerAdmin(id)) return res.status(404).json({ error: "Cuenta no encontrada." });
    ses.cambiarPassword(id, (req.body && req.body.password) || "");
    db.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").run(id);
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "empleado.password_cambiada", entidad: "admin", entidadId: id, ip: req.ip });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// CONFIGURACIÓN (solo administrador principal)
// ------------------------------------------------------------
router.get("/config", (req, res) => {
  const filas = db.prepare("SELECT clave, valor FROM config").all();
  const obj = {};
  for (const f of filas) obj[f.clave] = f.valor;
  res.json({ config: obj });
});

router.put("/config", requerirPrincipal, (req, res) => {
  try {
    const cambios = req.body || {};
    const permitidas = [
      "sellos_por_compra",
      "tamano_tarjeta",
      "regla_reinicio",
      "nombre_negocio",
      "recompensas_visibles_publico",
    ];
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!permitidas.includes(clave)) continue;
      escribirConfig(clave, valor);
    }
    logica.auditar({ adminId: req.admin.id, adminEmail: req.admin.email, accion: "config.modificada", entidad: "config", detalle: cambios, ip: req.ip });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// AUDITORÍA (solo administrador principal)
// ------------------------------------------------------------
router.get("/auditoria", requerirPrincipal, (req, res) => {
  const limite = Math.min(300, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const filas = db.prepare("SELECT * FROM auditoria ORDER BY created_at DESC, id DESC LIMIT ?").all(limite);
  res.json({ registros: filas });
});

module.exports = router;
