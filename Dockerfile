# Ко Манда — production Dockerfile (Next.js standalone)

FROM node:20 AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Cache-bust: change this on every deploy
RUN echo "Deploy: $(date +%s)" > /app/.build_id
RUN mkdir -p /app/data
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app

RUN mkdir -p /app/data
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
