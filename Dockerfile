FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/audit/package.json packages/audit/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

RUN openssl version
RUN rm -rf /app/node_modules/.prisma /app/node_modules/@prisma/client
RUN npm install --workspace apps/api --ignore-scripts @prisma/client
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN ls -l /app/node_modules/.prisma/client/libquery_engine-*.so.node
RUN test -f /app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
RUN npm run build --workspace @naeos-crm/audit
RUN npm run build --workspace @naeos-crm/auth
RUN npm run build --workspace @naeos-crm/domain
RUN npm run build --workspace @naeos-crm/shared
RUN npm run build --workspace @naeos-crm/api

ENV NODE_ENV=production
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
