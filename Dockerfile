FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY start.mjs index.mjs ./
COPY lib ./lib
COPY config ./config

RUN mkdir -p /app/data

ENV EZVIZ_API_BASE=https://isgpopen.ezvizlife.com/api/lapp
ENV DATA_DIR=/app/data
ENV NODE_ENV=production

CMD ["node", "start.mjs"]
