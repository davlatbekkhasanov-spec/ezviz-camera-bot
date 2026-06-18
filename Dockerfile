FROM node:22-slim

WORKDIR /app

COPY package.json ./
COPY start.mjs index.mjs ./
COPY lib ./lib
COPY config ./config
COPY event-api ./event-api

RUN mkdir -p /app/data

ENV EZVIZ_API_BASE=https://isgpopen.ezvizlife.com/api/lapp
ENV DATA_DIR=/app/data
ENV EVENT_API_PORT=8788
ENV EVENT_API_URL=http://127.0.0.1:8788
ENV EVENT_API_AUTO_MIGRATE=1
ENV NODE_ENV=production

CMD ["node", "start.mjs"]
