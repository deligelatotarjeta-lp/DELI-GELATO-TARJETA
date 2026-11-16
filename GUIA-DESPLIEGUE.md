# 🚀 Guía: publicar DELI GELATO en internet (Render) y activar el correo

Esta guía está pensada para seguirla paso a paso. No necesitas saber programar.

---

## PARTE 1 — Activar el correo real con Gmail

La plataforma usará la cuenta **deligelatotarjeta@gmail.com** para enviar los
correos de verificación y de recuperación de contraseña del panel.

> ⚠️ Google no permite usar la contraseña normal en aplicaciones. Hay que crear
> una **«contraseña de aplicación»** (16 letras). Es segura y se puede revocar.

### Paso a paso

1. Entra en https://myaccount.google.com/security con la cuenta
   `deligelatotarjeta@gmail.com`.
2. Activa la **Verificación en dos pasos** (si no la tienes ya). Sin esto no se
   pueden crear contraseñas de aplicación.
3. Entra en https://myaccount.google.com/apppasswords
4. En «Nombre de la aplicación» escribe `DELI GELATO` y pulsa **Crear**.
5. Google te mostrará un código de 16 letras (por ejemplo `abcd efgh ijkl mnop`).
   **Cópialo** (se muestra una sola vez).
6. Abre el archivo `.env` del proyecto y rellena estas líneas (pega el código
   **sin espacios**):

   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=deligelatotarjeta@gmail.com
   SMTP_PASS=abcdefghijklmnop
   SMTP_FROM="DELI GELATO <deligelatotarjeta@gmail.com>"
   ```

7. Comprueba que funciona:

   ```bash
   npm run correo
   ```

   Debe aparecer: `✅ Correo enviado correctamente a deligelatotarjeta@gmail.com`.

Si falla, revisa que `SMTP_PASS` no tenga espacios y que la verificación en dos
pasos esté activa.

---

## PARTE 2 — Publicar en Render (plan gratuito)

Render publica tu plataforma en una dirección `https://…onrender.com` y te da
**HTTPS gratis**. Necesitas una cuenta de GitHub (gratuita).

### 2.1. Crear la cuenta de GitHub

1. Entra en https://github.com/signup y crea una cuenta (es gratis).
2. Confirma tu correo.

### 2.2. Subir el proyecto a GitHub

Git ya está instalado en tu equipo. Abre la carpeta del proyecto y ejecuta en una
terminal (PowerShell), **reemplazando `TU-USUARIO`** por tu usuario de GitHub:

```powershell
cd "C:\Users\Alom\OneDrive\Documentos\Proyecto predeterminado"
git init
git add .
git commit -m "Plataforma DELI GELATO"
git branch -M main
```

Ahora crea un repositorio **vacío** en https://github.com/new con el nombre
`deli-gelato` (no marques ninguna casilla de README ni .gitignore) y ejecuta:

```powershell
git remote add origin https://github.com/TU-USUARIO/deli-gelato.git
git push -u origin main
```

La primera vez te pedirá iniciar sesión en GitHub (se abre el navegador).

> 🔒 Los archivos `.env`, la base de datos (`data/`) y `node_modules/` **no** se
> suben, porque están excluidos en `.gitignore`. Tus secretos quedan a salvo.

### 2.3. Desplegar en Render

1. Entra en https://render.com y regístrate (puedes entrar con GitHub).
2. Pulsa **New > Blueprint**.
3. Conecta tu cuenta de GitHub y elige el repositorio `deli-gelato`.
4. Render leerá el archivo `render.yaml` y creará el servicio automáticamente.
5. Cuando te pida las variables, rellena:
   - `BASE_URL` → la dirección que te dé Render (ej. `https://deli-gelato.onrender.com`)
   - `ADMIN_PASSWORD` → la contraseña del panel que tú quieras
   - `SMTP_USER` → `deligelatotarjeta@gmail.com`
   - `SMTP_PASS` → la contraseña de aplicación de la Parte 1
   - `SMTP_HOST` → `smtp.gmail.com`
6. Pulsa **Deploy**. En unos minutos tendrás la plataforma publicada.

### 2.4. Importante sobre los datos (base de datos)

- En el **plan gratuito**, la base de datos se borra cada vez que Render
  redespliega el servicio.
- Para usarlo con **clientes reales**, activa el **disco persistente** (plan de
  pago). El archivo `render.yaml` ya lo tiene preparado.

### 2.5. Comprobar que funciona

Abre `https://TU-DIRECCION.onrender.com/api/salud`. Debe responder:

```json
{ "ok": true, "servicio": "DELI GELATO", "baseDatos": "ok" }
```

---

## PARTE 3 — Enviarme las imágenes de referencia

Para ajustar el diseño a tu identidad visual real, guarda las imágenes en la
carpeta del proyecto (por ejemplo una subcarpeta `referencias/`) y dime las rutas.
Analizaré:

- Colores principales y secundarios.
- Tonalidades.
- Tipografía.
- Estilo gráfico.
- Elementos decorativos e ilustraciones.

Con eso ajusto el diseño sin inventar una paleta que contradiga tu marca.

---

## Recordatorio de seguridad

- Nunca compartas tu contraseña de aplicación ni tu contraseña del panel.
- El archivo `.env` es privado: no lo subas a GitHub ni lo envíes por mensaje.
- Cuando el panel esté en internet, cambia la contraseña del administrador
  principal si usaste una provisional.
