FROM oven/bun:alpine

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY bunfig.toml .

RUN bun install

COPY .env .
COPY src src
COPY tsconfig.json .

RUN bun run build

ENV PORT 3000
ENV NODE_ENV production

EXPOSE 3000

CMD ["bun", "start"]
