/* DELI GELATO — Tarjeta del cliente */
document.addEventListener("DOMContentLoaded", () => {
  // --- Menú lateral (contraer / móvil) ---
  const lateral = document.getElementById("lateral");
  const velo = document.getElementById("velo");
  document.getElementById("btn-menu").addEventListener("click", () => {
    lateral.classList.add("abierto");
    velo.classList.add("visible");
  });
  document.getElementById("btn-contraer").addEventListener("click", () => {
    lateral.classList.toggle("contraido");
  });
  velo.addEventListener("click", () => {
    lateral.classList.remove("abierto");
    velo.classList.remove("visible");
  });

  cargarTarjeta();

  async function cargarTarjeta() {
    try {
      const t = await DG.api("/api/mi-tarjeta");
      pintar(t);
    } catch (err) {
      document.getElementById("cargando").classList.add("oculto");
      if (err.status === 401) {
        document.getElementById("sin-acceso").classList.remove("oculto");
      } else {
        DG.notificar("Error", err.message, "error");
        document.getElementById("sin-acceso").classList.remove("oculto");
      }
    }
  }

  function pintar(t) {
    document.getElementById("cargando").classList.add("oculto");
    document.getElementById("vista").classList.remove("oculto");
    document.getElementById("saludo").textContent =
      "Hola, " + t.nombre + " · Socio " + t.codigo;

    document.getElementById("nombre").textContent = t.nombre;
    document.getElementById("codigo").textContent = t.codigo;
    document.getElementById("ciclo").textContent =
      t.progreso.regla === "reiniciar" ? "Tarjeta nº " + t.sellos.ciclo : "Tarjeta de fidelidad";

    // Sellos
    const cont = document.getElementById("sellos");
    cont.innerHTML = "";
    for (let i = 1; i <= t.sellos.tamano; i++) {
      const s = document.createElement("div");
      s.className = "sello" + (i <= t.sellos.actuales ? " lleno" : "");
      s.textContent = i <= t.sellos.actuales ? "🍦" : i;
      cont.appendChild(s);
    }

    // Progreso
    document.getElementById("barra").style.width = t.sellos.porcentaje + "%";
    const faltan = Math.max(0, t.sellos.tamano - t.sellos.actuales);
    const textoProgreso = document.getElementById("progreso-texto");
    textoProgreso.classList.toggle("completa", Boolean(t.sellos.tarjetaCompleta));
    textoProgreso.textContent = t.sellos.tarjetaCompleta
      ? "¡Tarjeta completa! Tienes recompensas para canjear."
      : t.sellos.actuales + " de " + t.sellos.tamano + " sellos · te faltan " + faltan;

    // QR
    document.getElementById("qr").src = "/api/mi-tarjeta/qr?t=" + Date.now();

    // Recompensas pendientes
    const pend = document.getElementById("pendientes");
    if (!t.recompensasPendientes.length) {
      pend.innerHTML = '<p class="suave">Aún no tienes recompensas desbloqueadas. ¡Sigue acumulando sellos!</p>';
    } else {
      pend.innerHTML = "";
      t.recompensasPendientes.forEach((r) => {
        const d = document.createElement("div");
        d.className = "fila entre";
        d.style.padding = "10px 0";
        d.style.borderBottom = "1px solid var(--linea)";
        d.innerHTML =
          '<div><strong>' + DG.esc(r.nombre_snapshot) + "</strong><br>" +
          '<span class="suave" style="font-size:.84rem">Desbloqueada el ' + DG.fecha(r.desbloqueada_at) + "</span></div>" +
          '<span class="badge badge-verde">Lista para canjear</span>';
        pend.appendChild(d);
      });
    }

    // Recompensas canjeadas
    const canj = document.getElementById("canjeadas");
    if (!t.recompensasCanjeadas.length) {
      canj.innerHTML = '<p class="suave">Todavía no has canjeado ninguna recompensa.</p>';
    } else {
      canj.innerHTML = "";
      t.recompensasCanjeadas.forEach((r) => {
        const d = document.createElement("div");
        d.className = "fila entre";
        d.style.padding = "10px 0";
        d.style.borderBottom = "1px solid var(--linea)";
        d.innerHTML =
          '<div><strong>' + DG.esc(r.nombre_snapshot) + "</strong><br>" +
          '<span class="suave" style="font-size:.84rem">' + DG.fecha(r.canjeada_at) + "</span></div>" +
          '<span class="badge badge-gris">Canjeada</span>';
        canj.appendChild(d);
      });
    }

    // Historial
    const hist = document.getElementById("historial");
    if (!t.historial.length) {
      hist.innerHTML = '<p class="suave">Aún no hay movimientos. Tu primer sello aparecerá aquí.</p>';
    } else {
      const tabla = document.createElement("table");
      tabla.className = "tabla";
      tabla.innerHTML =
        "<thead><tr><th>Fecha</th><th>Sellos</th><th>Ticket</th></tr></thead><tbody>" +
        t.historial
          .map(
            (h) =>
              "<tr><td>" + DG.fecha(h.created_at) + "</td><td>+" + DG.esc(h.cantidad) +
              "</td><td>" + DG.esc(h.ticket || "—") + "</td></tr>"
          )
          .join("") +
        "</tbody>";
      hist.innerHTML = "";
      hist.appendChild(tabla);
    }

    // Festejo si hay una recompensa nueva respecto a la última visita
    try {
      const clave = "dg_ultimo_desbloqueo";
      const ultimo = localStorage.getItem(clave);
      const pendientes = t.recompensasPendientes.map((r) => r.id).join(",");
      if (pendientes && pendientes !== ultimo) {
        DG.festejar();
        DG.notificar("¡Nueva recompensa!", "Revisa tus recompensas disponibles.");
      }
      localStorage.setItem(clave, pendientes);
    } catch { /* almacenamiento no disponible */ }
  }
});
