FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY start.mjs index.mjs ./
COPY lib ./lib
COPY config ./config

ENV EZVIZ_API_BASE=https://isgpopen.ezvizlife.com/api/lapp
ENV NODE_ENV=production

CMD ["node", "start.mjs"]
