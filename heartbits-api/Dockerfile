# heartbits-api (also runs the worker — same image, different command in compose).
# Bun runs TypeScript directly, so no build step is needed.
# Pin tighter (or by digest) for fully reproducible builds.
FROM oven/bun:1.3-alpine

WORKDIR /app

# Install only production deps, leveraging layer caching on the lockfile.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY migrations ./migrations

ENV NODE_ENV=production
EXPOSE 3100
CMD ["bun", "run", "src/index.ts"]
