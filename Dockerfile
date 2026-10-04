# syntax=docker/dockerfile:1

# Keep in sync with the `playwright` npm version once the renderer depends on it:
# the browser binaries in the base image must match the library.
ARG PLAYWRIGHT_VERSION=1.63.0

# ---- build ----
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

# ---- runtime ----
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

LABEL org.opencontainers.image.title="Sini" \
      org.opencontainers.image.description="Deterministic, AI-programmable motion video engine" \
      org.opencontainers.image.licenses="Apache-2.0"

# Ubuntu's FFmpeg is built with libx264 (GPL). Sini only runs it as a separate
# program; see docs/VERTICAL_SLICE_PLAN.md §3 before publishing this image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/cli /opt/sini/cli
COPY LICENSE NOTICE /opt/sini/
RUN chmod +x /opt/sini/cli/dist/index.js \
 && ln -s /opt/sini/cli/dist/index.js /usr/local/bin/sini

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Chromium needs a writable home whichever user the entrypoint switches to.
ENV HOME=/tmp
WORKDIR /work
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["--help"]
