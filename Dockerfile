FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN alias npm="bun" && bun install --production

COPY src src
COPY static static
COPY tsconfig.json .
# COPY public public

CMD ["bun", "start"]

EXPOSE 3000
