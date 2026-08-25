# Ко Манда — production Dockerfile (Next.js standalone)

ARG CACHE_BUST=20260805-2
FROM node:20 AS build
WORKDIR /app

RUN echo "Cache bust: ${CACHE_BUST}"

COPY package*.json ./
RUN npm ci

COPY . .
# Cache-bust: change this on every deploy
RUN echo "Deploy: $(date +%s)" > /app/.build_id
# Force Docker to not cache from this point
ARG CACHEBUST=1
RUN echo "Cache bust: ${CACHEBUST}"
RUN mkdir -p /app/data
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app

RUN mkdir -p /app/data
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

CMD ["node", "server.js"]
