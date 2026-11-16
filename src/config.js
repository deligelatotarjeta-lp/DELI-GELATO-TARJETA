"use strict";

/**
 * Configuración central de DELI GELATO.
 * Carga el archivo .env (si existe) sin dependencias externas.
 */

const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");

// --- Cargador mínimo de .env ---
function cargarEnv(rutaArchivo) {
  if (!fs.existsSync(rutaArchivo)) return;
  const contenido = fs.readFileSync(rutaArchivo, "utf8");
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const idx = limpia.indexOf("=");
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    let valor = limpia.slice(idx + 1).trim();
    // Quita comillas envolventes
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnv(path.join(RAIZ, ".env"));

const entorno = process.env.NODE_ENV || "development";

const config = {
  raiz: RAIZ,
  entorno,
  esProduccion: entorno === "production",
  puerto: Number(process.env.PORT || 3000),
  baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),

  // Seguridad
  sessionSecret: process.env.SESSION_SECRET || "",
  duracionSesionAdminMs: 1000 * 60 * 60 * 12, // 12 horas
  duracionTokenClienteDias: 365, // el enlace personal del cliente dura 1 año

  // Administrador principal
  adminEmail: (process.env.ADMIN_EMAIL || "deligelatotarjeta@gmail.com").toLowerCase(),
  adminPasswordInicial: process.env.ADMIN_PASSWORD || "",

  // Base de datos
  rutaBaseDatos: process.env.DB_PATH
    ? path.resolve(RAIZ, process.env.DB_PATH)
    : path.join(RAIZ, "data", "deligelato.sqlite"),

  // Correo (opcional)
  smtp: {
    host: process.env.SMTP_HOST || "",
    puerto: Number(process.env.SMTP_PORT || 587),
    usuario: process.env.SMTP_USER || "",
    clave: process.env.SMTP_PASS || "",
    remitente: process.env.SMTP_FROM || "DELI GELATO <no-reply@deligelato.bo>",
    configurado: Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ),
  },

  // Programa de fidelización (valores por defecto; se pueden cambiar en la BD)
  programa: {
    sellosPorCompra: 1,
    tamanoTarjeta: 10,
  },
};

/**
 * Avisos de seguridad al arrancar.
 */
config.avisosSeguridad = function () {
  const avisos = [];
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    avisos.push(
      "SESSION_SECRET no está definido o es demasiado corto. Define una clave aleatoria en .env"
    );
  }
  if (config.esProduccion && !config.baseUrl.startsWith("https://")) {
    avisos.push("En producción BASE_URL debe usar https:// (obligatorio para datos personales).");
  }
  return avisos;
};

module.exports = config;
