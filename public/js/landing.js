/* DELI GELATO — Portada */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("anio").textContent = new Date().getFullYear();

  // Sellos de la tarjeta de ejemplo (6 de 10 llenos)
  const contenedor = document.getElementById("sellos-demo");
  for (let i = 1; i <= 10; i++) {
    const s = document.createElement("div");
    s.className = "sello" + (i <= 6 ? " lleno" : "");
    s.textContent = i <= 6 ? "🍦" : i;
    contenedor.appendChild(s);
  }

  // Recompensas reales desde el servidor
  DG.api("/api/info")
    .then((info) => {
      const lista = document.getElementById("lista-recompensas");
      if (!info.recompensas || info.recompensas.length === 0) {
        lista.innerHTML = "";
        document.getElementById("recompensas").classList.add("oculto");
        return;
      }
      lista.innerHTML = "";
      info.recompensas.forEach((r, i) => {
        const art = document.createElement("article");
        art.className = "card premio" + (i === info.recompensas.length - 1 ? " destacado" : "");
        art.innerHTML =
          '<div class="premio-icono">' + DG.esc(r.icono || "🍦") + "</div>" +
          '<span class="premio-sellos">' + DG.esc(r.sellos_requeridos) + " sellos</span>" +
          "<h3>" + DG.esc(r.nombre) + "</h3>" +
          '<p class="suave">' + DG.esc(r.descripcion || "") + "</p>";
        lista.appendChild(art);
      });
    })
    .catch(() => {
      document.getElementById("recompensas").classList.add("oculto");
    });
});
