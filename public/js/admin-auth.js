/* DELI GELATO — Login, recuperación y verificación de administradores */
document.addEventListener("DOMContentLoaded", () => {
  const aviso = document.getElementById("aviso");
  const avisoRec = document.getElementById("aviso-rec");

  function mostrar(el, texto, tipo) {
    el.textContent = texto;
    el.className = "aviso-form visible " + tipo;
  }

  // --- Cambiar entre login y recuperación ---
  const cajaLogin = document.getElementById("caja-login");
  const cajaRec = document.getElementById("caja-recuperar");
  const enlaceOlvide = document.getElementById("enlace-olvide");
  const enlaceVolver = document.getElementById("enlace-volver");
  if (enlaceOlvide) {
    enlaceOlvide.addEventListener("click", (e) => {
      e.preventDefault();
      cajaLogin.classList.add("oculto");
      cajaRec.classList.remove("oculto");
    });
    enlaceVolver.addEventListener("click", (e) => {
      e.preventDefault();
      cajaRec.classList.add("oculto");
      cajaLogin.classList.remove("oculto");
    });
  }

  // --- Inicio de sesión ---
  const formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const btn = document.getElementById("btn-entrar");
      btn.disabled = true;
      btn.textContent = "Entrando…";
      try {
        const res = await DG.api("/api/admin/login", { metodo: "POST", cuerpo: { email, password } });
        DG.setCsrf(res.csrf);
        window.location.href = "/admin/index.html";
      } catch (err) {
        mostrar(aviso, err.message || "No se pudo iniciar sesión.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Iniciar sesión";
      }
    });
  }

  // --- Recuperar contraseña ---
  const formRec = document.getElementById("form-recuperar");
  if (formRec) {
    formRec.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email-rec").value.trim();
      try {
        const res = await DG.api("/api/admin/recuperar", { metodo: "POST", cuerpo: { email } });
        let texto = res.mensaje;
        if (res.enlaceDesarrollo) {
          texto += " (Modo desarrollo, SMTP no configurado. Enlace: " + res.enlaceDesarrollo + ")";
        }
        mostrar(avisoRec, texto, "ok");
      } catch (err) {
        mostrar(avisoRec, err.message || "No se pudo procesar la solicitud.", "error");
      }
    });
  }

  // --- Restablecer contraseña (página admin/restablecer.html) ---
  const formRest = document.getElementById("form-restablecer");
  if (formRest) {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    formRest.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("password-nueva").value;
      const avisoR = document.getElementById("aviso-rest");
      if (password.length < 8) return mostrar(avisoR, "La contraseña debe tener al menos 8 caracteres.", "error");
      try {
        const res = await DG.api("/api/admin/restablecer", { metodo: "POST", cuerpo: { token, password } });
        mostrar(avisoR, res.mensaje, "ok");
        setTimeout(() => (window.location.href = "/admin/login.html"), 2500);
      } catch (err) {
        mostrar(avisoR, err.message || "No se pudo restablecer la contraseña.", "error");
      }
    });
  }

  // --- Verificar correo (página admin/verificar.html) ---
  const cajaVerificar = document.getElementById("caja-verificar");
  if (cajaVerificar) {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    DG.api("/api/admin/verificar-email", { metodo: "POST", cuerpo: { token } })
      .then((res) => {
        cajaVerificar.innerHTML = "<h3>✅ " + DG.esc(res.mensaje) + "</h3><p class='suave'>Ya puedes iniciar sesión.</p>" +
          "<a class='btn mt' href='/admin/login.html'>Ir al acceso</a>";
      })
      .catch((err) => {
        cajaVerificar.innerHTML = "<h3>⚠️ No se pudo verificar</h3><p class='suave'>" + DG.esc(err.message) + "</p>" +
          "<a class='btn mt' href='/admin/login.html'>Volver</a>";
      });
  }
});
