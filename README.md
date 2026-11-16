# 🍦 DELI GELATO — Plataforma de fidelización

Plataforma web completa de **tarjetas digitales de sellos** para la heladería
DELI GELATO (Bolivia). Tiene dos experiencias totalmente independientes:

- **Clientes**: se registran solo con su nombre y reciben una tarjeta digital con QR.
- **Administradores y personal**: acceden a un panel privado para gestionar socios,
  sellos, recompensas, canjes y estadísticas.

No depende de servicios externos ni de sesiones de IA. Es una aplicación real con
backend propio, base de datos persistente y validación en el servidor.

---

## ✅ Requisitos

- **Node.js 22.5 o superior** (se ha probado con Node 26).
- No hace falta instalar bases de datos: usa SQLite integrado.

## 🚀 Cómo arrancar

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Arrancar el servidor
npm start
```

Luego abre en el navegador:

- Web pública:  http://localhost:3000
- Panel admin:  http://localhost:3000/admin

> En el primer arranque se crea el **administrador principal**. Si defines
> `ADMIN_PASSWORD` en `.env`, esa contraseña se aplica **en cada arranque** (así
> nunca se pierde, aunque cambie la base de datos). Si la dejas vacía, se genera
> una aleatoria y se muestra **una sola vez** por consola.

## 🔑 Acceso del administrador principal

- **Correo:** `deligelatotarjeta@gmail.com`
- **Contraseña:** la que definas en `ADMIN_PASSWORD` dentro de `.env` (se aplica
  en cada arranque). Si dejas `ADMIN_PASSWORD` vacía, se usa la que aparece por
  consola la primera vez.

## 🗂️ Estructura del proyecto

```
├── server.js                 Servidor Express (punto de entrada)
├── .env                      Configuración y secretos (NO se sube a git)
├── .env.example              Plantilla de configuración
├── src/
│   ├── config.js             Carga de configuración y avisos de seguridad
│   ├── security.js           Hashing, tokens, CSRF, límite de peticiones
│   ├── db.js                 Esquema y conexión a SQLite
│   ├── logica.js             Reglas de negocio (socios, sellos, recompensas)
│   ├── sesiones.js           Autenticación de administradores
│   ├── middleware.js         Seguridad, cookies, permisos, CSP
│   ├── correo.js             Envío de correos (opcional)
│   ├── seed.js               Crea el administrador principal
│   └── rutas/
│       ├── publicas.js       API de clientes (registro, tarjeta, QR)
│       └── admin.js          API del panel administrativo
├── public/                   Frontend (HTML/CSS/JS, sin frameworks)
│   ├── index.html            Página pública
│   ├── registro.html         Registro (solo nombre)
│   ├── tarjeta.html          Tarjeta del cliente (con menú lateral)
│   ├── recuperar.html        Recuperación de acceso
│   ├── privacidad.html · terminos.html · reglamento.html · cookies.html
│   ├── admin/                Login, panel, restablecer, verificar
│   ├── img/                  Logotipo de la marca (SVG)
│   ├── css/estilos.css       Sistema de diseño (paleta de DELI GELATO)
│   └── js/                   Lógica del frontend
├── scripts/
│   ├── limpiar-datos.js      Borra datos de prueba
│   ├── probar-correo.js      Prueba el envío de correo (SMTP)
│   └── copiar-base.js        Copia de seguridad de la base de datos
├── Dockerfile                Imagen de producción
├── render.yaml               Despliegue en Render
├── .env.production.example   Plantilla de producción
└── data/                     Base de datos SQLite (se crea sola)
```

## 🎨 Identidad de marca

El logotipo es una **reconstrucción vectorial del letrero real** de la heladería:
una placa ovalada de fondo crema con borde grueso caramelo, el nombre
**«Deli Gelato»** en letra manuscrita y los dos lemas en arco
(*«LAS COSAS MÁS LINDAS»* arriba y *«· SIEMPRE TOMAN TIEMPO ·»* abajo).

- `public/img/logo-oval.svg` — logotipo completo con los lemas (portada, login, pie).
- `public/img/logo-marca.svg` — versión compacta (cabeceras y menú lateral).

La paleta oficial vive en las variables de `:root` (`public/css/estilos.css`):
verde pastel `#D0FDD7`, blanco `#FFFFFF`, azul cielo `#B9D9EB` y caramelo
tostado `#6D3C1C`. Las tipografías son **locales** (la CSP no permite fuentes
externas): serif con espaciado para etiquetas y lemas, manuscrita para la marca.

## 👤 Experiencia del cliente

1. Entra en la web y pulsa **Registrarme**.
2. Escribe **solo su nombre** y acepta el tratamiento de datos.
3. El sistema genera su **código DG-XXXXXX** y un **enlace personal de acceso**.
4. Se le redirige a su **tarjeta digital** (sellos, QR, recompensas e historial).
5. Vuelve a entrar con su enlace personal. Si lo pierde, el personal le genera uno nuevo.

**No se pide** correo, teléfono, carnet, contraseña ni datos financieros.

## 🧑‍🍳 Experiencia del administrador

1. Entra por `/admin` (página independiente del registro de clientes).
2. Inicia sesión con su correo y contraseña.
3. **Resumen**: métricas y últimos sellos.
4. **Clientes**: buscador por nombre o código.
5. **Registrar sello**: escáner QR con cámara o código manual.
6. **Recompensas**: crear, editar, activar/desactivar y eliminar premios.
7. **Canjes**: confirmar entregas (evita el doble canje).
8. **Empleados**: crear cuentas con permisos limitados (solo el principal).
9. **Estadísticas**, **Configuración** y **Auditoría**.

## 🔐 Seguridad implementada

- Contraseñas de administrador con hash **scrypt** (nunca en texto plano).
- Sesiones con token aleatorio; en la BD solo se guarda su hash.
- **Token CSRF** en todas las operaciones que modifican datos.
- **Validación en el servidor** de sellos, canjes y permisos (el navegador no decide).
- Permisos por rol: **principal** (todo) y **empleado** (limitado).
- **Registro de auditoría** de cada operación sensible.
- El acceso de cada cliente usa un **token secreto**, nunca su nombre.
- El **QR solo contiene el identificador** del socio (sin datos personales).
- Cabeceras de seguridad y **CSP** estricta; cookies `HttpOnly` y `SameSite=Strict`.
- **Límite de peticiones** en login y registro.

## ⚙️ Configuración (`.env`)

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto del servidor (por defecto 3000) |
| `BASE_URL` | URL pública. **En producción debe ser https://**. En Render, si está vacía se usa `RENDER_EXTERNAL_URL` |
| `SESSION_SECRET` | Clave para firmar cookies. Larga y aleatoria |
| `ADMIN_EMAIL` | Correo del administrador principal |
| `ADMIN_PASSWORD` | Contraseña del administrador principal. Si se define, se aplica en cada arranque; si se deja vacío, se genera una aleatoria |
| `SMTP_*` | Servidor de correo para verificación y recuperación |

### Correo (opcional)

Sin SMTP configurado, el sistema **no simula** el envío: los enlaces de
verificación/recuperación se muestran por consola (modo desarrollo). Para enviar
correos de verdad, rellena `SMTP_*` en `.env` y pruébalo con:

```bash
npm run correo                       # envía una prueba a ADMIN_EMAIL
npm run correo -- otro@correo.com    # envía una prueba a otra dirección
```

**Ejemplo con Gmail:** activa la verificación en dos pasos en tu cuenta de Google,
crea una «contraseña de aplicación» en https://myaccount.google.com/apppasswords
y pega los 16 caracteres en `SMTP_PASS` (no uses tu contraseña normal).

## 📦 Comandos útiles

```bash
npm start                  # Arranca la plataforma
npm run dev                # Arranca con recarga automática
npm run seed               # Crea el administrador principal si no existe
npm run correo             # Prueba el envío de correo (SMTP)
npm run copiar-base        # Copia de seguridad de la base de datos
npm run limpiar            # Borra datos de prueba (deja config y admin)
```

## 🌍 Poner en producción

La plataforma ya incluye lo necesario para desplegarse. Elige la opción que prefieras:

### Opción A — Render (la más sencilla, sin servidor propio)

1. Sube el proyecto a un repositorio de **GitHub** (necesitas una cuenta).
2. En [render.com](https://render.com): **New > Blueprint** y conecta el repositorio.
3. Render detecta el archivo `render.yaml` y crea el servicio.
4. Rellena en el panel de Render las variables `BASE_URL`, `ADMIN_PASSWORD` y `SMTP_*`.
5. Render te da una URL `https://…onrender.com` (o conecta tu dominio propio).

> ⚠️ El **disco persistente** (para no perder la base de datos) requiere un plan de
> pago. En el plan gratuito la base de datos se reinicia en cada redespliegue.

### Opción B — Docker (funciona en cualquier servidor)

```bash
docker build -t deli-gelato .
docker run -d --name deli-gelato -p 3000:3000 \
  --env-file .env -v deligelato_datos:/app/data deli-gelato
```

La imagen ya incluye una comprobación de salud en `/api/salud`.

### Opción C — VPS propio (DigitalOcean, Hetzner, etc.)

1. Instala **Node.js 22.5+** en el servidor.
2. Copia el proyecto y ejecuta `npm install --omit=dev`.
3. Crea el `.env` a partir de `.env.production.example` (mira la guía de abajo).
4. Pon **HTTPS** delante con Nginx + Certbot (Let's Encrypt) y arranca con `npm start`
   (o con un gestor de procesos como `pm2`).
5. Programa copias de seguridad con `npm run copiar-base`.

### Variables imprescindibles en producción

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://tu-dominio` (con https obligatorio) |
| `SESSION_SECRET` | Clave larga y aleatoria |
| `ADMIN_EMAIL` | `deligelatotarjeta@gmail.com` |
| `ADMIN_PASSWORD` | Contraseña del administrador principal (se aplica en cada arranque) |

Puedes comprobar que todo está bien con la ruta **`/api/salud`**: debe responder
`{ "ok": true }`.

## ⚠️ Pendiente de configurar por el negocio

- **SMTP** real para correos administrativos (`npm run correo` lo verifica).
- **HTTPS y dominio propio**.
- **Revisión legal profesional** de los documentos (ver abajo).

## ⚖️ Privacidad y legal

La plataforma incluye política de privacidad, términos y condiciones, reglamento
del programa y política de cookies. Se inspiran en la normativa boliviana
(Constitución, DS 1793, Ley 164, Ley 453). Las normas internacionales (RGPD, CCPA,
COPPA) **no se aplican automáticamente** en Bolivia: su aplicabilidad depende de
las jurisdicciones a las que se dirija el servicio.

> Los documentos son una base de buena fe y **no constituyen asesoramiento
> jurídico**. Se recomienda su revisión por un profesional del derecho en Bolivia.

## 📄 Licencia

Uso privado de DELI GELATO.
