FROM node:22-alpine@sha256:b6f26b36c8ff49624cfdac716b8ea1138d606df02586a77d364bb5536a634f85 AS dependencies
WORKDIR /processor
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
FROM clamav/clamav:1.4.6_base@sha256:76cff2172141d860ad6485c86dc6d9bdc4a6b6e1128ed9d86aea5434ae55bf5f
ARG SOURCE_REVISION=uncommitted
LABEL org.opencontainers.image.revision=$SOURCE_REVISION
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /processor /processor
WORKDIR /processor
COPY server.mjs decode.mjs ./
ENV HOME=/tmp TMPDIR=/tmp
ENTRYPOINT []
CMD ["node","server.mjs"]
