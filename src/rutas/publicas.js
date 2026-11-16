"use strict";

/**
 * Rutas públicas y de clientes.
 * El registro SOLO pide el nombre. No hay correo, ni teléfono, ni contraseña.
 */

const express = require("express");
const QRCode = require("qrcode");
const config = require("../config");
const { db, leerConfig, leerConfigEntero } = require("../db");
const { crearCliente, tarjetaDeCliente } = require("../logica");
const {
  ponerCookie,
  requerirCliente,
  sinCache,
  limitarPeticiones,
  COOKIE_CLIENTE,
} = require("../middleware");

const router = express.Router();

// ------------------------------------------------------------
// Registro de cliente: únicamente el nombre
// ------------------------------------------------------------
router.post(
  "/api/registro",
  limitarPeticiones(10, 60 * 1000, "Demasiados registros seguidos. Espera un momento."),
  (req, res) => {
    try {
      const { nombre } = req.body || {};
      const { cliente, token } = crearCliente(nombre, req.ip);

      // Guardamos el token en una cookie httpOnly y devolvemos el enlace personal.
      ponerCookie(res, COOKIE_CLIENTE, token, { maxAgeSeg: config.duracionTokenClienteDias * 86400 });

      res.status(201).json({
        ok: true,
        codigo: cliente.codigo,
        nombre: cliente.nombre,
        // Enlace personal para volver a entrar (no contiene datos personales)
        enlaceAcceso: `${config.baseUrl}/acceso?t=${token}`,
        tarjeta: `${config.baseUrl}/tarjeta.html`,
      });
    } catch (e) {
      res.status(e.codigo || 500).json({ error: e.message || "No se pudo completar el registro." });
    }
  }
);

// ------------------------------------------------------------
// Enlace de acceso personal: guarda el token y redirige a la tarjeta
// ------------------------------------------------------------
router.get("/acceso", (req, res) => {
  const token = String(req.query.t || "");
  if (!token) return res.redirect("/recuperar.html");
  ponerCookie(res, COOKIE_CLIENTE, token, { maxAgeSeg: config.duracionTokenClienteDias * 86400 });
  res.redirect("/tarjeta.html");
});

// ------------------------------------------------------------
// Tarjeta del cliente autenticado
// ------------------------------------------------------------
router.get("/api/mi-tarjeta", sinCache, requerirCliente, (req, res) => {
  res.json(tarjetaDeCliente(req.cliente));
});

// Código QR personal (contiene SOLO el identificador del socio)
router.get("/api/mi-tarjeta/qr", sinCache, requerirCliente, async (req, res) => {
  try {
    const png = await QRCode.toBuffer(req.cliente.codigo, {
      type: "png",
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#6D3C1C", light: "#FFFFFF" },
    });
    res.type("png").send(png);
  } catch {
    res.status(500).json({ error: "No se pudo generar el código QR." });
  }
});

// ------------------------------------------------------------
// Estado del servicio (monitoreo y despliegues)
// No expone datos personales ni secretos.
// ------------------------------------------------------------
router.get("/api/salud", (req, res) => {
  let baseDatos = "ok";
  try {
    db.prepare("SELECT 1 AS uno").get();
  } catch {
    baseDatos = "error";
  }
  res.status(baseDatos === "ok" ? 200 : 503).json({
    ok: baseDatos === "ok",
    servicio: "DELI GELATO",
    entorno: config.entorno,
    baseDatos,
    hora: new Date().toISOString(),
  });
});

// ------------------------------------------------------------
// Información pública (landing)
// ------------------------------------------------------------
router.get("/api/info", (req, res) => {
  const mostrarRecompensas = leerConfig("recompensas_visibles_publico", "0") === "1";
  res.json({
    negocio: leerConfig("nombre_negocio", "DELI GELATO"),
    sellosPorCompra: leerConfigEntero("sellos_por_compra", 1),
    tamanoTarjeta: leerConfigEntero("tamano_tarjeta", 10),
    // En la página de REGISTRO las recompensas nunca se muestran.
    recompensas: mostrarRecompensas
      ? require("../logica").listarRecompensas({ soloActivas: true })
      : [],
  });
});

module.exports = router;
