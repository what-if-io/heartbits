# heartbits-web — SvelteKit (adapter-node). Multistage: build, then a slim runtime
# with only production deps + the compiled output. Paraglide compiles during build.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["bun", "run", "build/index.js"]
