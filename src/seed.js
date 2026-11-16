"use strict";

/**
 * Crea el administrador principal de DELI GELATO si no existe.
 * Se ejecuta al arrancar el servidor y también manualmente con: npm run seed
 *
 * La contraseña se toma de ADMIN_PASSWORD (.env). Si no está definida,
 * se genera una aleatoria y se muestra UNA SOLA VEZ por consola.
 */

const config = require("./config");
const { db } = require("./db");
const { hashPassword, verificarPassword } = require("./security");
const { buscarAdminPorEmail } = require("./sesiones");

function sembrarAdminPrincipal({ silencioso = false } = {}) {
  const email = config.adminEmail;
  const existente = buscarAdminPorEmail(email);
  if (existente) {
    if (existente.rol !== "principal") {
      db.prepare("UPDATE admins SET rol = 'principal', activo = 1 WHERE id = ?").run(existente.id);
    }
    // Si ADMIN_PASSWORD está definida, esa es la contraseña oficial del
    // administrador principal: se impone en cada arranque para que no se pierda
    // aunque la base de datos se reinicie o el servicio se redespliegue.
    if (
      config.adminPasswordInicial &&
      !verificarPassword(config.adminPasswordInicial, existente.password_hash)
    ) {
      db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(
        hashPassword(config.adminPasswordInicial),
        existente.id
      );
      db.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").run(existente.id);
      if (!silencioso) {
        console.log("[seed] Contraseña del administrador principal fijada desde ADMIN_PASSWORD.");
      }
    }
    if (!silencioso) console.log(`[seed] Administrador principal ya existe: ${email}`);
    return { creado: false, email, password: null };
  }

  let password = config.adminPasswordInicial;
  let generada = false;
  if (!password) {
    password = require("node:crypto").randomBytes(12).toString("base64url");
    generada = true;
  }

  db.prepare(
    `INSERT INTO admins (email, nombre, password_hash, rol, activo, email_verificado, puede_canjear)
     VALUES (?, ?, ?, 'principal', 1, 1, 1)`
  ).run(email, "Administrador principal", hashPassword(password));

  if (!silencioso) {
    console.log("");
    console.log("========================================================");
    console.log(" ADMINISTRADOR PRINCIPAL CREADO");
    console.log(" Correo:    " + email);
    if (generada) {
      console.log(" Contraseña: " + password);
      console.log(" ¡GUÁRDALA AHORA! No se volverá a mostrar.");
    } else {
      console.log(" Contraseña: (la definida en ADMIN_PASSWORD)");
    }
    console.log("========================================================");
    console.log("");
  }

  return { creado: true, email, password: generada ? password : null };
}

module.exports = { sembrarAdminPrincipal };

// Ejecución directa: node src/seed.js
if (require.main === module) {
  sembrarAdminPrincipal();
}
