# Instrucciones del proyecto — DELI GELATO

## Qué es este proyecto

Plataforma de fidelización con **tarjetas digitales de sellos** para la heladería
DELI GELATO (Bolivia). Dos experiencias separadas: **clientes** (registro solo con
nombre + tarjeta digital) y **administradores/personal** (panel privado).

## Tecnología

- **Backend:** Node.js + Express. Base de datos **SQLite** nativa (`node:sqlite`).
- **Frontend:** HTML, CSS y JavaScript puro, sin frameworks ni build.
- **Sin dependencias externas obligatorias.** `nodemailer` es opcional (correo).

## Cómo se ejecuta

```bash
npm install
npm start        # http://localhost:3000  ·  panel en /admin
npm run dev      # con recarga automática
npm run seed     # crea el administrador principal
node scripts/limpiar-datos.js   # borra datos de prueba
```

## Estructura

- `server.js` — servidor Express (punto de entrada).
- `src/` — backend: `config`, `security`, `db`, `logica`, `sesiones`, `middleware`, `correo`, `rutas/`.
- `public/` — frontend: páginas HTML, `css/estilos.css`, `js/`.
- `public/admin/` — acceso y panel administrativo.
- `data/deligelato.sqlite` — base de datos (no versionar).

## Convenciones

- Todo en **español**: textos de interfaz, comentarios y nombres de dominio.
- Nombres de variables/funciones en español (`crearCliente`, `agregarSellos`).
- CSS: usar las variables de `:root` (paleta oficial abajo), nunca colores sueltos.
- JavaScript: sin librerías en el frontend. **No usar scripts en línea ni `onclick`**
  (la CSP `script-src 'self'` los bloquea); siempre archivos externos + `addEventListener`.
- El frontend NUNCA decide reglas de negocio: todo se valida en el backend.

## Paleta oficial

| Color | Hex |
|---|---|
| Verde pastel | `#D0FDD7` |
| Blanco | `#FFFFFF` |
| Azul cielo | `#B9D9EB` |
| Caramelo tostado | `#6D3C1C` |

## Reglas importantes (no romper)

- **Clientes:** el registro pide SOLO el nombre. Nunca pedir correo, teléfono, carnet ni contraseña.
- **La página de registro NO muestra recompensas** ni tarjetas ajenas.
- **Separación total** entre acceso de clientes y de administradores.
- El **QR contiene únicamente** el código de socio.
- Las **recompensas son configurables** desde el panel; no fijar nombres/cantidades en el código.
- Los **sellos y canjes se validan en el servidor**; el cliente solo puede visualizarlos.
- Toda operación sensible debe quedar en la **auditoría**.
- **No exponer secretos** en el código: usar `.env`.
- Los documentos legales deben mantener el aviso de que requieren revisión profesional.

## Antes de dar algo por terminado

- `node --check` sobre los archivos modificados.
- Probar el flujo completo: registro → sellos → recompensa → canje.
- Comprobar que un cliente no puede ver la tarjeta de otro.
- Actualizar el `README.md` si cambia algo que el usuario deba saber.
