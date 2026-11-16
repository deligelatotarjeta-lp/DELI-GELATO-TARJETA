"use strict";

/**
 * Limpia los datos de PRUEBA sin borrar la configuración ni las cuentas
 * administrativas. Útil antes de entregar la plataforma a clientes reales.
 *
 * Uso:  node scripts/limpiar-datos.js
 */

const { db } = require("../src/db");

const antes = {
  clientes: db.prepare("SELECT COUNT(*) n FROM clientes").get().n,
  sellos: db.prepare("SELECT COUNT(*) n FROM sellos").get().n,
};

db.exec(`
  DELETE FROM recompensas_otorgadas;
  DELETE FROM sellos;
  DELETE FROM clientes;
  DELETE FROM auditoria;
  DELETE FROM admin_sessions;
  DELETE FROM admin_tokens;
  DELETE FROM admins WHERE rol <> 'principal';
`);

const despues = {
  clientes: db.prepare("SELECT COUNT(*) n FROM clientes").get().n,
  admins: db.prepare("SELECT COUNT(*) n FROM admins").get().n,
  recompensas: db.prepare("SELECT COUNT(*) n FROM recompensas").get().n,
};

console.log("Datos de prueba eliminados.");
console.log("  Socios:      " + antes.clientes + " -> " + despues.clientes);
console.log("  Sellos:      " + antes.sellos + " -> 0");
console.log("  Admins:      " + despues.admins + " (solo el principal)");
console.log("  Recompensas: " + despues.recompensas + " (se conservan)");
