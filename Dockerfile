# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

# Default command runs the HTTP API; docker-compose overrides this for the
# worker service to run `node dist/temporal/worker.js` instead.
CMD ["node", "dist/server.js"]
