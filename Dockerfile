# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
# The project's lockfile is bun.lock (there is no package-lock.json), so install
# with bun for an exact, reproducible install. npm install without a lockfile
# crashes on the "overrides" field ("Cannot read properties of null (reading 'edgesOut')").
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
# VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are baked into the browser bundle
# at build time: from .env in the build context, or passed as build args.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
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
