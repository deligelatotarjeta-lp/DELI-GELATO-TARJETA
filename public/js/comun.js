/* ============================================================
   DELI GELATO — Utilidades compartidas del frontend
   (No usa librerías externas ni scripts en línea: compatible con la CSP)
   ============================================================ */

const DG = (() => {
  let csrf = null;

  /** Petición a la API con manejo de errores uniforme. */
  async function api(ruta, { metodo = "GET", cuerpo = null, cabeceras = {} } = {}) {
    const opciones = {
      method: metodo,
      credentials: "same-origin",
      headers: { ...cabeceras },
    };
    if (cuerpo !== null) {
      opciones.headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }
    if (csrf) opciones.headers["x-csrf-token"] = csrf;

    let respuesta;
    try {
      respuesta = await fetch(ruta, opciones);
    } catch {
      throw new Error("No hay conexión con el servidor.");
    }

    let datos = null;
    const tipo = respuesta.headers.get("content-type") || "";
    if (tipo.includes("application/json")) {
      datos = await respuesta.json().catch(() => null);
    }
    if (!respuesta.ok) {
      const err = new Error((datos && datos.error) || `Error ${respuesta.status}`);
      err.status = respuesta.status;
      err.datos = datos;
      throw err;
    }
    return datos;
  }

  function setCsrf(valor) { csrf = valor; }

  /** Notificación flotante. */
  function notificar(titulo, mensaje = "", tipo = "ok") {
    let cont = document.getElementById("notificaciones");
    if (!cont) {
      cont = document.createElement("div");
      cont.id = "notificaciones";
      document.body.appendChild(cont);
    }
    const n = document.createElement("div");
    n.className = "notificacion " + tipo;
    const t = document.createElement("div");
    t.className = "titulo";
    t.textContent = titulo;
    n.appendChild(t);
    if (mensaje) {
      const m = document.createElement("div");
      m.textContent = mensaje;
      n.appendChild(m);
    }
    cont.appendChild(n);
    setTimeout(() => {
      n.style.transition = "opacity .4s";
      n.style.opacity = "0";
      setTimeout(() => n.remove(), 400);
    }, 4200);
  }

  /** Lluvia de confeti (recompensa desbloqueada). */
  function festejar() {
    let capa = document.getElementById("festejo");
    if (!capa) {
      capa = document.createElement("div");
      capa.id = "festejo";
      document.body.appendChild(capa);
    }
    capa.classList.add("visible");
    const colores = ["#6d3c1c", "#d0fdd7", "#b9d9eb", "#8b5a33", "#ffffff"];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement("div");
      c.className = "confeti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.top = "-20px";
      c.style.background = colores[i % colores.length];
      c.style.animationDelay = Math.random() * 0.7 + "s";
      c.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      capa.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
    setTimeout(() => capa.classList.remove("visible"), 4000);
  }

  /** Escapa texto para insertarlo en HTML de forma segura. */
  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fecha(valor) {
    if (!valor) return "—";
    const d = new Date(String(valor).replace(" ", "T") + (String(valor).includes("Z") ? "" : "Z"));
    if (isNaN(d)) return valor;
    return d.toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return { api, setCsrf, notificar, festejar, esc, fecha };
})();

/* Relleno automático de año y fecha en cualquier página */
document.addEventListener("DOMContentLoaded", () => {
  const anio = document.getElementById("anio");
  if (anio) anio.textContent = new Date().getFullYear();
  const fecha = document.getElementById("fecha");
  if (fecha) fecha.textContent = new Date().toLocaleDateString("es-BO");
});
