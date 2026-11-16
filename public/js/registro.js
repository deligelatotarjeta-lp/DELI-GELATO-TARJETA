/* DELI GELATO — Registro de cliente (solo nombre) */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-registro");
  const aviso = document.getElementById("aviso");
  const btn = document.getElementById("btn-crear");
  const nombre = document.getElementById("nombre");
  const acepto = document.getElementById("acepto");

  function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = "aviso-form visible " + tipo;
  }

  nombre.addEventListener("input", () => nombre.classList.remove("error"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    aviso.className = "aviso-form";

    const valor = nombre.value.trim();
    if (valor.length < 2) {
      nombre.classList.add("error");
      mostrarAviso("Escribe tu nombre (al menos 2 letras).", "error");
      return;
    }
    if (!acepto.checked) {
      mostrarAviso("Debes aceptar el tratamiento de datos para continuar.", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Creando tu tarjeta…";

    try {
      const res = await DG.api("/api/registro", { metodo: "POST", cuerpo: { nombre: valor } });

      document.getElementById("paso-formulario").classList.add("oculto");
      const exito = document.getElementById("paso-exito");
      exito.classList.remove("oculto");
      document.getElementById("exito-nombre").textContent = res.nombre;
      document.getElementById("exito-codigo").textContent = res.codigo;
      document.getElementById("exito-enlace").value = res.enlaceAcceso;

      document.getElementById("btn-copiar").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(res.enlaceAcceso);
          DG.notificar("Copiado", "Guarda el enlace en un lugar seguro.");
        } catch {
          DG.notificar("Copia manualmente", "Selecciona el enlace y cópialo.", "error");
        }
      });

      DG.notificar("¡Registro completado!", "Tu tarjeta está lista.");
      DG.festejar();

      setTimeout(() => { window.location.href = "/tarjeta.html"; }, 6000);
    } catch (err) {
      mostrarAviso(err.message || "No se pudo completar el registro.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Crear mi tarjeta";
    }
  });
});
