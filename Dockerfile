# syntax=docker/dockerfile:1

# Must match the `playwright` version in packages/render/package.json: the browser it
# installs below is the exact build the tests and determinism checks run against.
ARG PLAYWRIGHT_VERSION=1.63.0
ARG FFMPEG_VERSION=7.1.1

# ---- build: compile the workspace and deploy the CLI with production dependencies ----
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
# The MCP server bundles the DSL reference and examples.
COPY docs/DSL_REFERENCE.md ./docs/DSL_REFERENCE.md
COPY examples ./examples
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @sini/cli deploy --prod --legacy /out/cli
# Drop files Sini never loads: Lucide's icon font and JS builds (only icons/*.svg is read)
# and the second Tesseract model (Sini uses the 4.0.0 data).
RUN set -e; cd /out/cli/node_modules/.pnpm; \
    for p in dist font sprite.svg icon-nodes.json tags.json; do rm -rf lucide-static@*/node_modules/lucide-static/$p; done; \
    rm -rf @tesseract.js-data+eng@*/node_modules/@tesseract.js-data/eng/4.0.0_best_int

# ---- ffmpeg: a minimal build with only what Sini uses ----
# JPEG/PNG frame sequences in, H.264 (libx264) in MP4 out. libx264 is GPL, so this
# binary is GPL; Sini only runs it as a separate program.
FROM debian:bookworm-slim AS ffmpeg
ARG FFMPEG_VERSION
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential nasm pkg-config libx264-dev zlib1g-dev curl ca-certificates xz-utils \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN curl -fsSL "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" | tar -xJ --strip-components=1
RUN ./configure \
      --prefix=/opt/ffmpeg --disable-debug --disable-doc --disable-ffplay --disable-ffprobe \
      --disable-network --disable-autodetect --disable-everything \
      --enable-gpl --enable-libx264 --enable-zlib \
      --enable-decoder=mjpeg,png --enable-parser=mjpeg,png \
      --enable-demuxer=image2,image2pipe --enable-muxer=mp4,mov \
      --enable-encoder=libx264 --enable-protocol=file,pipe \
      --enable-filter=buffer,buffersink,format,scale,null,copy \
 && make -j"$(nproc)" && make install && strip /opt/ffmpeg/bin/ffmpeg

# ---- runtime: Node, the Chromium headless shell, ffmpeg ----
FROM node:24-bookworm-slim
ARG PLAYWRIGHT_VERSION

LABEL org.opencontainers.image.title="Sini" \
      org.opencontainers.image.description="Deterministic, AI-programmable motion video engine" \
      org.opencontainers.image.licenses="Apache-2.0"

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=build /out/cli /opt/sini/cli
# Only Chromium's headless shell and the libraries it needs (no full Chromium, Firefox or WebKit).
RUN apt-get update \
 && apt-get install -y --no-install-recommends libx264-164 \
 && node /opt/sini/cli/node_modules/.pnpm/playwright@${PLAYWRIGHT_VERSION}/node_modules/playwright/cli.js install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/* /tmp/* /root/.cache /root/.npm
COPY --from=ffmpeg /opt/ffmpeg/bin/ffmpeg /usr/local/bin/ffmpeg
COPY LICENSE NOTICE /opt/sini/
RUN chmod +x /opt/sini/cli/dist/index.js \
 && ln -s /opt/sini/cli/dist/index.js /usr/local/bin/sini
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Chromium needs a writable home whichever user the entrypoint switches to.
ENV HOME=/tmp
WORKDIR /work
# `sini serve` (the MCP server over HTTP) listens here.
EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["--help"]
