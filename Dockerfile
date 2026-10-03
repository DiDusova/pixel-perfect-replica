# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
# VITE_* values are baked into the browser bundle at build time (from .env or build args)
RUN npm run build

# --- runtime stage ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["npm", "run", "start"]
