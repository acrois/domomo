ARG DATABASE_TAG=16.2-alpine3.19
FROM postgres:${DATABASE_TAG} as build
RUN apk add --no-cache --virtual .build-deps \
  git \
  make \
  gcc \
  llvm15-dev \
  clang-dev \
  clang15 \
  file \
  build-base
RUN git clone https://github.com/eulerto/wal2json.git && \
  cd wal2json && \
  make && \
  make install

FROM postgres:${DATABASE_TAG} as run
COPY --from=build /usr/local/lib/postgresql/wal2json.so /usr/local/lib/postgresql/wal2json.so
COPY --from=build /usr/local/lib/postgresql/bitcode/wal2json/wal2json.bc /usr/local/lib/postgresql/bitcode/wal2json/wal2json.bc
COPY --from=build /usr/local/lib/postgresql/bitcode/wal2json.index.bc /usr/local/lib/postgresql/bitcode/wal2json.index.bc
