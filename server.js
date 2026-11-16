"use strict";

/**
 * Servidor principal de DELI GELATO.
 */

const path = require("node:path");
const express = require("express");

const config = require("./src/config");
const { cabecerasSeguridad, analizarCookies } = require("./src/middleware");
const rutasPublicas = require("./src/rutas/publicas");
const rutasAdmin = require("./src/rutas/admin");
const { sembrarAdminPrincipal } = require("./src/seed");
const { limpiarSesionesExpiradas } = require("./src/sesiones");

const app = express();

// Detrás de un proxy (producción) para obtener la IP real del cliente
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Seguridad y análisis de cookies (antes de las rutas)
app.use(cabecerasSeguridad);
app.use(analizarCookies);

// Cuerpo de las peticiones (limitado para evitar abusos)
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

// ---------------- API ----------------
app.use(rutasPublicas);
app.use("/api/admin", rutasAdmin);

// ---------------- Archivos estáticos ----------------
const PUBLICO = path.join(__dirname, "public");
app.use(
  express.static(PUBLICO, {
    extensions: ["html"],
    setHeaders(res, ruta) {
      if (ruta.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// Redirecciones cómodas del panel
app.get("/admin", (req, res) => res.redirect("/admin/index.html"));
app.get("/panel", (req, res) => res.redirect("/admin/index.html"));

// ---------------- 404 de API ----------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Recurso no encontrado." });
});

// ---------------- Manejo de errores ----------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "La petición es demasiado grande." });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Datos con formato inválido." });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

// ---------------- Arranque ----------------
function arrancar() {
  // Crea el administrador principal si es la primera vez
  sembrarAdminPrincipal();

  // Limpieza periódica de sesiones caducadas
  limpiarSesionesExpiradas();
  setInterval(limpiarSesionesExpiradas, 1000 * 60 * 30).unref();

  const avisos = config.avisosSeguridad();
  for (const a of avisos) console.warn("[seguridad] " + a);

  app.listen(config.puerto, () => {
    console.log("");
    console.log("🍦 DELI GELATO — plataforma de fidelización");
    console.log("   Entorno:  " + config.entorno);
    console.log("   Web:      " + config.baseUrl);
    console.log("   Panel:    " + config.baseUrl + "/admin");
    console.log("   Base de datos: " + config.rutaBaseDatos);
    console.log("");
  });
}

if (require.main === module) arrancar();

module.exports = app;
