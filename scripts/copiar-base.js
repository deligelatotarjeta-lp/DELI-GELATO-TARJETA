"use strict";

/**
 * Crea una copia de seguridad de la base de datos SQLite.
 * Muy recomendable antes de actualizar la plataforma o en producción.
 *
 * Uso:
 *   node scripts/copiar-base.js
 *
 * Genera un archivo en la carpeta "copias/" con la fecha y la hora.
 */

const fs = require("node:fs");
const path = require("node:path");
const config = require("../src/config");
const { db } = require("../src/db");

const carpeta = path.join(config.raiz, "copias");
fs.mkdirSync(carpeta, { recursive: true });

const marca = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const destino = path.join(carpeta, `deligelato-${marca}.sqlite`);

// VACUUM INTO crea una copia consistente incluso con la base en uso.
db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);

const tamanoKb = Math.round(fs.statSync(destino).size / 1024);
console.log("Copia de seguridad creada:");
console.log("  " + destino + " (" + tamanoKb + " KB)");
