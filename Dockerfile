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

RUN npx prisma generate
RUN npm run build --workspace @naeos-crm/audit
RUN npm run build --workspace @naeos-crm/auth
RUN npm run build --workspace @naeos-crm/domain
RUN npm run build --workspace @naeos-crm/shared
RUN npm run build --workspace @naeos-crm/api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
