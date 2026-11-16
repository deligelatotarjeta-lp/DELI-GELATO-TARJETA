# ============================================================
# DELI GELATO — Imagen de producción
# Construir:   docker build -t deli-gelato .
# Ejecutar:    docker run -p 3000:3000 --env-file .env -v deligelato_datos:/app/data deli-gelato
# ============================================================
FROM node:24-alpine

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# Valores por defecto (se pueden sobrescribir con --env-file o variables de entorno)
ENV NODE_ENV=production
ENV PORT=3000

# Instalar SOLO las dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copiar el resto del código
COPY . .

# La base de datos vive en /app/data. Monta un volumen aquí para no perderla.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# Comprobación de salud usando la ruta /api/salud
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
