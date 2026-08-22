FROM node:24.19.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY Web/backend/package.json Web/backend/package.json
COPY Web/frontend/package.json Web/frontend/package.json
COPY Mobile/package.json Mobile/package.json

RUN npm ci

COPY Web/backend Web/backend

RUN npm run build --workspace @plateforme-formations/backend

FROM node:24.19.0-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY Web/backend/package.json Web/backend/package.json
COPY Web/frontend/package.json Web/frontend/package.json
COPY Mobile/package.json Mobile/package.json

RUN npm ci --omit=dev --workspace @plateforme-formations/backend \
  && npm cache clean --force

COPY --from=build /app/Web/backend/dist Web/backend/dist

RUN mkdir -p /app/uploads \
  && chown -R node:node /app/uploads

USER node
WORKDIR /app/Web/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
