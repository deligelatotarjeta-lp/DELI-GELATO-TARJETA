/* ============================================================
   DELI GELATO — Panel administrativo
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const estado = { admin: null, csrf: null, clienteActual: null };
  const $ = (sel) => document.querySelector(sel);

  // ------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------
  async function pedir(ruta, opciones) {
    try {
      return await DG.api(ruta, opciones);
    } catch (err) {
      if (err.status === 401) {
        window.location.href = "/admin/login.html";
        throw err;
      }
      throw err;
    }
  }

  function abrirModal(titulo, html) {
    const modal = $("#modal");
    modal.innerHTML = '<div class="card-titulo"><h3>' + DG.esc(titulo) + '</h3>' +
      '<button class="btn btn-chico btn-claro" id="cerrar-modal">✕</button></div>' + html;
    $("#modal-fondo").classList.add("visible");
    $("#cerrar-modal").addEventListener("click", cerrarModal);
    return modal;
  }
  function cerrarModal() { $("#modal-fondo").classList.remove("visible"); }
  $("#modal-fondo").addEventListener("click", (e) => { if (e.target.id === "modal-fondo") cerrarModal(); });

  // ------------------------------------------------------------
  // Menú lateral y navegación
  // ------------------------------------------------------------
  const lateral = $("#lateral");
  $("#btn-menu").addEventListener("click", () => { lateral.classList.add("abierto"); $("#velo").classList.add("visible"); });
  $("#velo").addEventListener("click", () => { lateral.classList.remove("abierto"); $("#velo").classList.remove("visible"); });
  $("#btn-contraer").addEventListener("click", () => lateral.classList.toggle("contraido"));

  const TITULOS = {
    resumen: ["Resumen", "Vista general del programa"],
    clientes: ["Clientes", "Socios registrados"],
    sellos: ["Registrar sello", "Escanea el QR o introduce el código"],
    recompensas: ["Recompensas", "Configura los premios del programa"],
    canjes: ["Canjes", "Entrega de recompensas"],
    empleados: ["Empleados", "Personal autorizado"],
    estadisticas: ["Estadísticas", "Actividad del programa"],
    config: ["Configuración", "Ajustes generales"],
    auditoria: ["Auditoría", "Historial de operaciones"],
  };

  document.querySelectorAll(".lateral-enlace[data-vista]").forEach((btn) => {
    btn.addEventListener("click", () => navegar(btn.dataset.vista));
  });

  function navegar(vista) {
    document.querySelectorAll(".lateral-enlace[data-vista]").forEach((b) => b.classList.toggle("activo", b.dataset.vista === vista));
    document.querySelectorAll(".vistas > section").forEach((s) => s.classList.toggle("activa", s.id === "vista-" + vista));
    const t = TITULOS[vista] || ["Panel", ""];
    $("#titulo-vista").textContent = t[0];
    $("#subtitulo-vista").textContent = t[1];
    lateral.classList.remove("abierto");
    $("#velo").classList.remove("visible");
    cargarVista(vista);
  }

  function cargarVista(vista) {
    if (vista === "resumen") cargarResumen();
    else if (vista === "clientes") buscarClientes();
    else if (vista === "recompensas") cargarRecompensas();
    else if (vista === "canjes") cargarCanjes();
    else if (vista === "empleados") cargarEmpleados();
    else if (vista === "estadisticas") cargarEstadisticas();
    else if (vista === "config") cargarConfig();
    else if (vista === "auditoria") cargarAuditoria();
  }

  // ------------------------------------------------------------
  // Inicio de sesión / sesión actual
  // ------------------------------------------------------------
  pedir("/api/admin/me")
    .then((res) => {
      estado.admin = res.admin;
      DG.setCsrf(res.csrf);
      $("#usuario-info").textContent = res.admin.nombre || res.admin.email;
      if (res.admin.rol !== "principal") {
        document.querySelectorAll(".solo-principal").forEach((el) => el.classList.add("oculto"));
      }
      navegar("resumen");
    })
    .catch(() => {});

  $("#btn-salir").addEventListener("click", async () => {
    try { await pedir("/api/admin/logout", { metodo: "POST" }); } catch {}
    window.location.href = "/admin/login.html";
  });

  // ------------------------------------------------------------
  // RESUMEN
  // ------------------------------------------------------------
  async function cargarResumen() {
    const d = await pedir("/api/admin/resumen");
    pintarMetricas($("#metricas"), d);
    const cont = $("#ultimos-sellos");
    if (!d.ultimosSellos.length) { cont.innerHTML = '<p class="suave">Aún no hay sellos registrados.</p>'; return; }
    cont.innerHTML = tablaHTML(
      ["Fecha", "Cliente", "Código", "Sellos", "Ticket", "Empleado"],
      d.ultimosSellos.map((s) => [DG.fecha(s.created_at), s.cliente, s.codigo, "+" + s.cantidad, s.ticket || "—", s.empleado || "—"])
    );
  }

  function pintarMetricas(cont, d) {
    cont.innerHTML = "";
    const items = [
      ["Socios", d.totalClientes],
      ["Socios hoy", d.clientesHoy],
      ["Sellos totales", d.totalSellos],
      ["Sellos hoy", d.sellosHoy],
      ["Recompensas pendientes", d.recompensasPendientes],
      ["Recompensas canjeadas", d.recompensasCanjeadas],
    ];
    items.forEach(([etiqueta, valor]) => {
      const m = document.createElement("div");
      m.className = "metrica";
      m.innerHTML = '<div class="valor">' + DG.esc(valor) + '</div><div class="etiqueta">' + DG.esc(etiqueta) + "</div>";
      cont.appendChild(m);
    });
  }

  // ------------------------------------------------------------
  // CLIENTES
  // ------------------------------------------------------------
  $("#btn-buscar-clientes").addEventListener("click", () => buscarClientes());
  $("#busqueda-clientes").addEventListener("keydown", (e) => { if (e.key === "Enter") buscarClientes(); });

  async function buscarClientes() {
    const q = $("#busqueda-clientes").value.trim();
    const cont = $("#tabla-clientes");
    cont.innerHTML = '<p class="suave">Buscando…</p>';
    const d = await pedir("/api/admin/clientes?q=" + encodeURIComponent(q));
    $("#total-clientes").textContent = d.total + " socios en total";
    if (!d.clientes.length) { cont.innerHTML = '<p class="suave">No se encontraron socios.</p>'; return; }
    const tabla = document.createElement("table");
    tabla.className = "tabla";
    tabla.innerHTML = "<thead><tr><th>Nombre</th><th>Código</th><th>Sellos</th><th>Pendientes</th><th>Alta</th><th></th></tr></thead><tbody></tbody>";
    const cuerpo = tabla.querySelector("tbody");
    d.clientes.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td><strong>" + DG.esc(c.nombre) + "</strong></td>" +
        "<td>" + DG.esc(c.codigo) + "</td>" +
        "<td>" + DG.esc(c.sellos_validos) + "</td>" +
        "<td>" + (c.pendientes ? '<span class="badge badge-verde">' + c.pendientes + "</span>" : "0") + "</td>" +
        "<td>" + DG.fecha(c.created_at) + "</td>";
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "btn btn-chico btn-secundario";
      btn.textContent = "Ver";
      btn.addEventListener("click", () => verCliente(c.id));
      td.appendChild(btn);
      tr.appendChild(td);
      cuerpo.appendChild(tr);
    });
    cont.innerHTML = "";
    cont.appendChild(envolverTabla(tabla));
  }

  async function verCliente(id) {
    const t = await pedir("/api/admin/clientes/" + id);
    const sellosHTML = Array.from({ length: t.sellos.tamano }, (_, i) =>
      '<div class="sello' + (i < t.sellos.actuales ? " lleno" : "") + '" style="width:34px;height:34px;font-size:.9rem">' +
      (i < t.sellos.actuales ? "🍦" : i + 1) + "</div>").join("");
    const pend = t.recompensasPendientes.map((r) =>
      '<li><span>' + DG.esc(r.nombre_snapshot) + '</span><button class="btn btn-chico btn-secundario" data-canjear="' + r.id + '">Entregar</button></li>').join("");
    const hist = t.historial.map((h) => "<tr><td>" + DG.fecha(h.created_at) + "</td><td>+" + h.cantidad + "</td><td>" + DG.esc(h.ticket || "—") + "</td></tr>").join("");

    abrirModal("Ficha de " + t.nombre,
      '<p class="suave">Socio <strong>' + DG.esc(t.codigo) + "</strong> · " + t.sellos.actuales + " de " + t.sellos.tamano + " sellos</p>" +
      '<div class="sellos" style="grid-template-columns:repeat(5,1fr);max-width:260px">' + sellosHTML + "</div>" +
      '<div class="card-titulo mt"><h3>Recompensas pendientes</h3></div>' +
      (pend ? '<ul class="lista">' + pend + "</ul>" : '<p class="suave">Ninguna.</p>') +
      '<div class="card-titulo mt"><h3>Historial</h3></div>' +
      (hist ? '<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Fecha</th><th>Sellos</th><th>Ticket</th></tr></thead><tbody>' + hist + "</tbody></table></div>" : '<p class="suave">Sin movimientos.</p>') +
      '<div class="fila mt"><button class="btn btn-chico" id="modal-registrar">Registrar sello</button>' +
      '<button class="btn btn-chico btn-claro" id="modal-nuevo-enlace">Generar nuevo enlace</button></div>');

    $("#modal-registrar").addEventListener("click", () => {
      cerrarModal();
      navegar("sellos");
      seleccionarCliente(t);
    });
    $("#modal-nuevo-enlace").addEventListener("click", async () => {
      const r = await pedir("/api/admin/clientes/" + id + "/nuevo-enlace", { metodo: "POST" });
      abrirModal("Nuevo enlace de acceso",
        '<p class="suave">Entrega este enlace al cliente para que acceda a su tarjeta:</p>' +
        '<input readonly value="' + DG.esc(r.enlaceAcceso) + '" style="width:100%;padding:12px;border:1px solid var(--linea);border-radius:10px" />');
    });
    document.querySelectorAll("[data-canjear]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await pedir("/api/admin/canjes/" + b.dataset.canjear + "/confirmar", { metodo: "POST" });
          DG.notificar("Recompensa entregada", "El canje quedó registrado.");
          cerrarModal();
        } catch (err) { DG.notificar("No se pudo entregar", err.message, "error"); }
      });
    });
  }

  // ------------------------------------------------------------
  // REGISTRAR SELLOS (escáner + manual)
  // ------------------------------------------------------------
  let stream = null, detector = null, escaneando = false;

  $("#btn-camara").addEventListener("click", activarCamara);
  $("#btn-detener").addEventListener("click", detenerCamara);
  $("#btn-buscar-codigo").addEventListener("click", () => buscarCodigo($("#codigo-manual").value));
  $("#codigo-manual").addEventListener("keydown", (e) => { if (e.key === "Enter") buscarCodigo($("#codigo-manual").value); });

  function estadoEscanner(texto) { $("#estado-escanner").textContent = texto; }

  async function activarCamara() {
    if (!("BarcodeDetector" in window)) {
      estadoEscanner("Tu navegador no permite escanear. Usa el código manual.");
      DG.notificar("Escáner no disponible", "Introduce el código manualmente.", "error");
      return;
    }
    try {
      detector = new BarcodeDetector({ formats: ["qr_code"] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = $("#lector-qr");
      video.srcObject = stream;
      await video.play();
      escaneando = true;
      $("#btn-camara").classList.add("oculto");
      $("#btn-detener").classList.remove("oculto");
      estadoEscanner("Apunta al código QR del cliente…");
      bucleEscaneo();
    } catch {
      estadoEscanner("No se pudo acceder a la cámara. Revisa los permisos.");
    }
  }

  function detenerCamara() {
    escaneando = false;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    $("#btn-camara").classList.remove("oculto");
    $("#btn-detener").classList.add("oculto");
    estadoEscanner("Cámara detenida.");
  }

  async function bucleEscaneo() {
    if (!escaneando) return;
    try {
      const codigos = await detector.detect($("#lector-qr"));
      if (codigos.length) {
        const valor = codigos[0].rawValue;
        detenerCamara();
        buscarCodigo(valor);
        return;
      }
    } catch { /* reintentar */ }
    setTimeout(bucleEscaneo, 350);
  }

  async function buscarCodigo(codigo) {
    const limpio = String(codigo || "").trim();
    if (!limpio) return;
    const cont = $("#resultado-cliente");
    cont.innerHTML = '<p class="suave">Buscando…</p>';
    try {
      const t = await pedir("/api/admin/clientes/codigo/" + encodeURIComponent(limpio));
      cont.innerHTML = '<div class="card" style="box-shadow:none"><strong>' + DG.esc(t.nombre) + "</strong><br>" +
        '<span class="suave">' + DG.esc(t.codigo) + " · " + t.sellos.actuales + " de " + t.sellos.tamano + " sellos</span></div>";
      seleccionarCliente(t);
    } catch (err) {
      cont.innerHTML = '<div class="aviso-form visible error">' + DG.esc(err.message) + "</div>";
      $("#caja-sello").classList.add("oculto");
      estado.clienteActual = null;
    }
  }

  function seleccionarCliente(t) {
    estado.clienteActual = t;
    $("#caja-sello").classList.remove("oculto");
    $("#sello-cliente-nombre").textContent = t.nombre + " · " + t.codigo;
    $("#sello-cantidad").value = 1;
    $("#sello-ticket").value = "";
    $("#sello-motivo").value = "";
  }

  $("#btn-registrar-sello").addEventListener("click", async () => {
    if (!estado.clienteActual) return;
    const btn = $("#btn-registrar-sello");
    btn.disabled = true;
    try {
      const res = await pedir("/api/admin/sellos", {
        metodo: "POST",
        cuerpo: {
          clienteId: estado.clienteActual.id,
          cantidad: Number($("#sello-cantidad").value),
          ticket: $("#sello-ticket").value.trim() || null,
          motivo: $("#sello-motivo").value.trim() || null,
        },
      });
      DG.notificar("Sellos registrados", "+" + res.tarjeta.sellos.actuales + " / " + res.tarjeta.sellos.tamano + " sellos.");
      if (res.nuevasRecompensas && res.nuevasRecompensas.length) {
        DG.festejar();
        DG.notificar("¡Recompensa desbloqueada!", res.nuevasRecompensas.map((r) => r.nombre).join(", "));
      }
      $("#sello-ticket").value = "";
      $("#sello-motivo").value = "";
      seleccionarCliente(res.tarjeta);
    } catch (err) {
      DG.notificar("No se pudo registrar", err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ------------------------------------------------------------
  // RECOMPENSAS
  // ------------------------------------------------------------
  async function cargarRecompensas() {
    const d = await pedir("/api/admin/recompensas");
    const cont = $("#lista-recompensas-admin");
    if (!d.recompensas.length) { cont.innerHTML = '<p class="suave">No hay recompensas configuradas.</p>'; return; }
    const tabla = document.createElement("table");
    tabla.className = "tabla";
    tabla.innerHTML = "<thead><tr><th></th><th>Nombre</th><th>Sellos</th><th>Estado</th><th></th></tr></thead><tbody></tbody>";
    const cuerpo = tabla.querySelector("tbody");
    d.recompensas.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td style='font-size:1.4rem'>" + DG.esc(r.icono || "🍦") + "</td>" +
        "<td><strong>" + DG.esc(r.nombre) + "</strong><br><span class='suave' style='font-size:.82rem'>" + DG.esc(r.descripcion || "") + "</span></td>" +
        "<td>" + r.sellos_requeridos + "</td>" +
        "<td>" + (r.activo ? '<span class="badge badge-verde">Activa</span>' : '<span class="badge badge-gris">Inactiva</span>') + "</td>";
      const td = document.createElement("td");
      if (estado.admin && estado.admin.rol === "principal") {
        const editar = document.createElement("button");
        editar.className = "btn btn-chico btn-claro";
        editar.textContent = "Editar";
        editar.addEventListener("click", () => editarRecompensa(r));
        td.appendChild(editar);
      }
      tr.appendChild(td);
      cuerpo.appendChild(tr);
    });
    cont.innerHTML = "";
    cont.appendChild(envolverTabla(tabla));
  }

  const btnNueva = $("#btn-nueva-recompensa");
  if (btnNueva) btnNueva.addEventListener("click", () => editarRecompensa(null));

  function editarRecompensa(r) {
    const esNueva = !r;
    abrirModal(esNueva ? "Nueva recompensa" : "Editar recompensa",
      '<div class="campo"><label>Nombre</label><input id="r-nombre" maxlength="60" value="' + DG.esc(r ? r.nombre : "") + '" /></div>' +
      '<div class="campo"><label>Descripción</label><input id="r-desc" maxlength="140" value="' + DG.esc(r ? r.descripcion : "") + '" /></div>' +
      '<div class="rejilla-2"><div class="campo"><label>Sellos requeridos</label><input type="number" id="r-sellos" min="1" value="' + (r ? r.sellos_requeridos : 5) + '" /></div>' +
      '<div class="campo"><label>Icono</label><input id="r-icono" maxlength="4" value="' + DG.esc(r ? r.icono : "🍦") + '" /></div></div>' +
      '<div class="campo"><label>Condiciones (opcional)</label><input id="r-cond" maxlength="140" value="' + DG.esc(r ? r.condiciones : "") + '" /></div>' +
      '<div class="campo"><label class="check"><input type="checkbox" id="r-activo" ' + (!r || r.activo ? "checked" : "") + ' /><span>Recompensa activa</span></label></div>' +
      '<div class="fila"><button class="btn" id="r-guardar">Guardar</button>' +
      (esNueva ? "" : '<button class="btn btn-peligro" id="r-eliminar">Eliminar</button>') + "</div>");

    $("#r-guardar").addEventListener("click", async () => {
      const cuerpo = {
        nombre: $("#r-nombre").value.trim(),
        descripcion: $("#r-desc").value.trim(),
        sellos_requeridos: Number($("#r-sellos").value),
        icono: $("#r-icono").value.trim() || "🍦",
        condiciones: $("#r-cond").value.trim(),
        activo: $("#r-activo").checked,
      };
      try {
        if (esNueva) await pedir("/api/admin/recompensas", { metodo: "POST", cuerpo });
        else await pedir("/api/admin/recompensas/" + r.id, { metodo: "PUT", cuerpo });
        DG.notificar("Guardado", "La recompensa se actualizó.");
        cerrarModal();
        cargarRecompensas();
      } catch (err) { DG.notificar("Error", err.message, "error"); }
    });

    const btnEliminar = $("#r-eliminar");
    if (btnEliminar) btnEliminar.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta recompensa? El historial ya otorgado se conserva.")) return;
      try {
        await pedir("/api/admin/recompensas/" + r.id, { metodo: "DELETE" });
        DG.notificar("Eliminada", "La recompensa se eliminó.");
        cerrarModal();
        cargarRecompensas();
      } catch (err) { DG.notificar("Error", err.message, "error"); }
    });
  }

  // ------------------------------------------------------------
  // CANJES
  // ------------------------------------------------------------
  $("#filtro-canjes").addEventListener("change", cargarCanjes);

  async function cargarCanjes() {
    const estadoFiltro = $("#filtro-canjes").value;
    const d = await pedir("/api/admin/canjes?estado=" + encodeURIComponent(estadoFiltro));
    const cont = $("#tabla-canjes");
    if (!d.canjes.length) { cont.innerHTML = '<p class="suave">No hay registros.</p>'; return; }
    const tabla = document.createElement("table");
    tabla.className = "tabla";
    tabla.innerHTML = "<thead><tr><th>Cliente</th><th>Código</th><th>Recompensa</th><th>Desbloqueada</th><th>Estado</th><th></th></tr></thead><tbody></tbody>";
    const cuerpo = tabla.querySelector("tbody");
    d.canjes.forEach((c) => {
      const tr = document.createElement("tr");
      const badge = c.estado === "pendiente" ? '<span class="badge badge-verde">Pendiente</span>'
        : c.estado === "canjeada" ? '<span class="badge badge-gris">Canjeada</span>'
        : '<span class="badge badge-rojo">Anulada</span>';
      tr.innerHTML =
        "<td><strong>" + DG.esc(c.cliente) + "</strong></td>" +
        "<td>" + DG.esc(c.codigo) + "</td>" +
        "<td>" + DG.esc(c.nombre_snapshot) + "</td>" +
        "<td>" + DG.fecha(c.desbloqueada_at) + "</td>" +
        "<td>" + badge + "</td>";
      const td = document.createElement("td");
      if (c.estado === "pendiente") {
        const btn = document.createElement("button");
        btn.className = "btn btn-chico";
        btn.textContent = "Entregar";
        btn.addEventListener("click", async () => {
          try {
            await pedir("/api/admin/canjes/" + c.id + "/confirmar", { metodo: "POST" });
            DG.notificar("Entregada", "El canje quedó registrado.");
            cargarCanjes();
          } catch (err) { DG.notificar("No se pudo entregar", err.message, "error"); }
        });
        td.appendChild(btn);
      }
      tr.appendChild(td);
      cuerpo.appendChild(tr);
    });
    cont.innerHTML = "";
    cont.appendChild(envolverTabla(tabla));
  }

  // ------------------------------------------------------------
  // EMPLEADOS
  // ------------------------------------------------------------
  async function cargarEmpleados() {
    const d = await pedir("/api/admin/empleados");
    const cont = $("#tabla-empleados");
    const tabla = document.createElement("table");
    tabla.className = "tabla";
    tabla.innerHTML = "<thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Canjes</th><th>Estado</th><th></th></tr></thead><tbody></tbody>";
    const cuerpo = tabla.querySelector("tbody");
    d.empleados.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td><strong>" + DG.esc(e.nombre || "—") + "</strong></td>" +
        "<td>" + DG.esc(e.email) + "</td>" +
        "<td>" + (e.rol === "principal" ? '<span class="badge badge-caramelo">Principal</span>' : "Empleado") + "</td>" +
        "<td>" + (e.puede_canjear ? "Sí" : "No") + "</td>" +
        "<td>" + (e.activo ? '<span class="badge badge-verde">Activo</span>' : '<span class="badge badge-rojo">Inactivo</span>') + "</td>";
      const td = document.createElement("td");
      if (e.rol !== "principal") {
        const btn = document.createElement("button");
        btn.className = "btn btn-chico btn-claro";
        btn.textContent = "Editar";
        btn.addEventListener("click", () => editarEmpleado(e));
        td.appendChild(btn);
      }
      tr.appendChild(td);
      cuerpo.appendChild(tr);
    });
    cont.innerHTML = "";
    cont.appendChild(envolverTabla(tabla));
  }

  $("#btn-nuevo-empleado").addEventListener("click", () => editarEmpleado(null));

  function editarEmpleado(e) {
    const esNuevo = !e;
    abrirModal(esNuevo ? "Nuevo empleado" : "Editar empleado",
      '<div class="campo"><label>Nombre</label><input id="e-nombre" value="' + DG.esc(e ? e.nombre : "") + '" /></div>' +
      (esNuevo ? '<div class="campo"><label>Correo</label><input type="email" id="e-email" /></div>' +
        '<div class="campo"><label>Contraseña inicial (mín. 8)</label><input type="text" id="e-pass" /></div>' : "") +
      '<div class="campo"><label class="check"><input type="checkbox" id="e-canjear" ' + (e && e.puede_canjear ? "checked" : "") + ' /><span>Puede confirmar canjes</span></label></div>' +
      (esNuevo ? "" : '<div class="campo"><label class="check"><input type="checkbox" id="e-activo" ' + (e.activo ? "checked" : "") + ' /><span>Cuenta activa</span></label></div>') +
      '<button class="btn" id="e-guardar">Guardar</button>');

    $("#e-guardar").addEventListener("click", async () => {
      try {
        if (esNuevo) {
          const r = await pedir("/api/admin/empleados", { metodo: "POST", cuerpo: {
            nombre: $("#e-nombre").value.trim(), email: $("#e-email").value.trim(),
            password: $("#e-pass").value, puedeCanjear: $("#e-canjear").checked } });
          if (r.enlaceVerificacionDesarrollo) DG.notificar("Empleado creado", "Verificación (dev): " + r.enlaceVerificacionDesarrollo);
          else DG.notificar("Empleado creado", "Se envió un correo de verificación.");
        } else {
          await pedir("/api/admin/empleados/" + e.id, { metodo: "PUT", cuerpo: {
            nombre: $("#e-nombre").value.trim(), puedeCanjear: $("#e-canjear").checked, activo: $("#e-activo").checked } });
          DG.notificar("Guardado", "Empleado actualizado.");
        }
        cerrarModal();
        cargarEmpleados();
      } catch (err) { DG.notificar("Error", err.message, "error"); }
    });
  }

  // ------------------------------------------------------------
  // ESTADÍSTICAS
  // ------------------------------------------------------------
  async function cargarEstadisticas() {
    const d = await pedir("/api/admin/estadisticas");
    pintarMetricas($("#metricas-2"), d);
    const cont = $("#grafico-dias");
    if (!d.porDia.length) { cont.innerHTML = '<p class="suave">Sin datos todavía.</p>'; return; }
    const max = Math.max(...d.porDia.map((x) => x.sellos), 1);
    cont.innerHTML = d.porDia.map((x) =>
      '<div class="fila" style="align-items:center;margin-bottom:6px">' +
      '<span style="width:90px;font-size:.82rem" class="suave">' + DG.esc(x.dia) + "</span>" +
      '<div style="flex:1;background:var(--azul-suave);border-radius:8px;overflow:hidden">' +
      '<div style="height:20px;background:var(--caramelo);width:' + Math.round((x.sellos / max) * 100) + '%"></div></div>' +
      '<span style="width:40px;text-align:right;font-weight:700">' + DG.esc(x.sellos) + "</span></div>"
    ).join("");
  }

  // ------------------------------------------------------------
  // CONFIGURACIÓN
  // ------------------------------------------------------------
  async function cargarConfig() {
    const d = await pedir("/api/admin/config");
    const c = d.config;
    $("#cfg-sellos").value = c.sellos_por_compra;
    $("#cfg-tamano").value = c.tamano_tarjeta;
    $("#cfg-regla").value = c.regla_reinicio;
    $("#cfg-nombre").value = c.nombre_negocio;
    $("#cfg-recompensas").checked = c.recompensas_visibles_publico === "1";
  }

  $("#btn-guardar-config").addEventListener("click", async () => {
    try {
      await pedir("/api/admin/config", { metodo: "PUT", cuerpo: {
        sellos_por_compra: $("#cfg-sellos").value,
        tamano_tarjeta: $("#cfg-tamano").value,
        regla_reinicio: $("#cfg-regla").value,
        nombre_negocio: $("#cfg-nombre").value.trim(),
        recompensas_visibles_publico: $("#cfg-recompensas").checked ? "1" : "0",
      } });
      DG.notificar("Guardado", "La configuración se actualizó.");
    } catch (err) { DG.notificar("Error", err.message, "error"); }
  });

  // ------------------------------------------------------------
  // AUDITORÍA
  // ------------------------------------------------------------
  async function cargarAuditoria() {
    const d = await pedir("/api/admin/auditoria");
    const cont = $("#tabla-auditoria");
    if (!d.registros.length) { cont.innerHTML = '<p class="suave">Sin registros.</p>'; return; }
    cont.innerHTML = tablaHTML(
      ["Fecha", "Usuario", "Acción", "Entidad", "Motivo"],
      d.registros.map((r) => [DG.fecha(r.created_at), r.admin_email || "—", r.accion, r.entidad || "—", r.motivo || "—"])
    );
  }

  // ------------------------------------------------------------
  // Auxiliares de tablas
  // ------------------------------------------------------------
  function tablaHTML(cabeceras, filas) {
    return '<div class="tabla-scroll"><table class="tabla"><thead><tr>' + cabeceras.map((c) => "<th>" + DG.esc(c) + "</th>").join("") +
      "</tr></thead><tbody>" + filas.map((f) => "<tr>" + f.map((v) => "<td>" + DG.esc(v) + "</td>").join("") + "</tr>").join("") +
      "</tbody></table></div>";
  }

  /** Envuelve una tabla en un contenedor con desplazamiento horizontal. */
  function envolverTabla(tabla) {
    const caja = document.createElement("div");
    caja.className = "tabla-scroll";
    caja.appendChild(tabla);
    return caja;
  }
});
