"use strict";

/**
 * Comprueba que el envío de correos funciona con la configuración SMTP del .env.
 *
 * Uso:
 *   node scripts/probar-correo.js                 -> envía a ADMIN_EMAIL
 *   node scripts/probar-correo.js otro@correo.com -> envía a esa dirección
 *
 * Si SMTP no está configurado, lo indica y no envía nada (no simula el envío).
 */

const config = require("../src/config");
const { enviarCorreo } = require("../src/correo");

(async () => {
  const destino = process.argv[2] || config.adminEmail;

  if (!config.smtp.configurado) {
    console.log("");
    console.log("⚠️  SMTP no está configurado en el archivo .env");
    console.log("");
    console.log("Para activar el envío real de correos, rellena estas variables:");
    console.log("   SMTP_HOST   (ej. smtp.gmail.com)");
    console.log("   SMTP_PORT   (587)");
    console.log("   SMTP_USER   (tu correo de envío)");
    console.log("   SMTP_PASS   (contraseña de aplicación, no la normal)");
    console.log("");
    console.log("Con Gmail: activa la verificación en dos pasos y crea una");
    console.log("contraseña de aplicación en https://myaccount.google.com/apppasswords");
    console.log("");
    process.exit(1);
  }

  console.log("Enviando correo de prueba a " + destino + " ...");
  try {
    const r = await enviarCorreo({
      para: destino,
      asunto: "Prueba de correo — DELI GELATO",
      texto:
        "Si estás leyendo esto, el envío de correos de DELI GELATO funciona correctamente.",
      html: "<p>Si estás leyendo esto, el envío de correos de <strong>DELI GELATO</strong> funciona correctamente.</p>",
    });
    if (r.enviado) {
      console.log("✅ Correo enviado correctamente a " + destino);
      process.exit(0);
    }
    console.log("⚠️  No se pudo enviar: " + r.motivo);
    process.exit(1);
  } catch (e) {
    console.log("❌ Error al enviar el correo: " + e.message);
    console.log("   Revisa SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.");
    process.exit(1);
  }
})();
