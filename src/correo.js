"use strict";

/**
 * Envío de correos (verificación de email y recuperación de contraseña).
 *
 * - Si SMTP está configurado en .env, se envía el correo de verdad con nodemailer.
 * - Si NO está configurado, NO se simula: se avisa por consola y, en desarrollo,
 *   se devuelve el enlace para poder probarlo.
 */

const config = require("./config");

let transporte = null;
function obtenerTransporte() {
  if (transporte) return transporte;
  if (!config.smtp.configurado) return null;
  try {
    const nodemailer = require("nodemailer");
    transporte = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.puerto,
      secure: config.smtp.puerto === 465,
      auth: { user: config.smtp.usuario, pass: config.smtp.clave },
    });
    return transporte;
  } catch {
    console.warn("[correo] SMTP configurado pero nodemailer no está instalado. Ejecuta: npm install nodemailer");
    return null;
  }
}

async function enviarCorreo({ para, asunto, texto, html }) {
  const t = obtenerTransporte();
  if (!t) {
    console.log("");
    console.log("[correo] SMTP no configurado. No se envió ningún correo a " + para);
    console.log("[correo] Asunto: " + asunto);
    console.log("[correo] Contenido:\n" + texto);
    console.log("");
    return { enviado: false, motivo: "SMTP no configurado" };
  }
  await t.sendMail({ from: config.smtp.remitente, to: para, subject: asunto, text: texto, html });
  return { enviado: true };
}

module.exports = { enviarCorreo };
