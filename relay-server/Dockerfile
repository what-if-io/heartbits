# heartbits-relay — Node.js WebSocket relay.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js test.html ./

ENV NODE_ENV=production
EXPOSE 8765
CMD ["node", "server.js"]
