/* ============================================================
   TARJETA DE LEALTAD — Lógica de la página
   ============================================================ */

// --- Año automático en el pie de página ---
document.getElementById("year").textContent = new Date().getFullYear();

// --- Animación sencilla del contador de puntos de la tarjeta de ejemplo ---
(function animatePoints() {
  const el = document.getElementById("demoPoints");
  if (!el) return;
  const target = parseInt(el.textContent, 10) || 0;
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * progress);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// --- Formulario: validación y creación de la tarjeta ---
const form = document.getElementById("joinForm");
const msg = document.getElementById("formMsg");

form.addEventListener("submit", function (event) {
  event.preventDefault();

  const nombre = document.getElementById("nombre");
  const email = document.getElementById("email");
  const acepto = document.getElementById("acepto");

  limpiarErrores();
  let valido = true;

  if (nombre.value.trim().length < 2) {
    marcarError(nombre);
    valido = false;
  }
  if (!emailValido(email.value.trim())) {
    marcarError(email);
    valido = false;
  }
  if (!acepto.checked) {
    valido = false;
  }

  if (!valido) {
    mostrarMensaje("Revisa los campos marcados en rojo.", "error");
    return;
  }

  // Creamos un número de tarjeta de ejemplo y lo guardamos en el navegador.
  // Nota: esto es una demostración local. Para guardar socios de verdad
  // hace falta un servidor o un servicio externo (te explico cómo después).
  const numeroTarjeta = "LC-" + Math.floor(100000 + Math.random() * 900000);
  const socio = {
    nombre: nombre.value.trim(),
    email: email.value.trim(),
    telefono: document.getElementById("telefono").value.trim(),
    numeroTarjeta: numeroTarjeta,
    puntos: 0,
    alta: new Date().toISOString()
  };

  try {
    localStorage.setItem("socioLealtad", JSON.stringify(socio));
  } catch (e) {
    /* Si el navegador bloquea el almacenamiento, seguimos igualmente. */
  }

  mostrarMensaje(
    "¡Bienvenido/a, " + socio.nombre + "! Tu tarjeta " + numeroTarjeta +
    " está lista. Revísala en tu correo (demo).",
    "ok"
  );
  form.reset();
});

// --- Funciones auxiliares ---
function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function marcarError(campo) {
  campo.classList.add("invalid");
}

function limpiarErrores() {
  document.querySelectorAll(".invalid").forEach(function (el) {
    el.classList.remove("invalid");
  });
  msg.textContent = "";
  msg.className = "form-msg";
}

function mostrarMensaje(texto, tipo) {
  msg.textContent = texto;
  msg.className = "form-msg " + tipo;
}

// Quita el borde rojo en cuanto el usuario corrige un campo
["nombre", "email"].forEach(function (id) {
  const campo = document.getElementById(id);
  campo.addEventListener("input", function () {
    campo.classList.remove("invalid");
  });
});
