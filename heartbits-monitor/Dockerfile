# heartbits-monitor — Bun + bun:sqlite (no external deps).
FROM oven/bun:1.3-alpine

WORKDIR /app
COPY package.json monitor.ts ./

ENV NODE_ENV=production
EXPOSE 4000
CMD ["bun", "run", "monitor.ts"]
