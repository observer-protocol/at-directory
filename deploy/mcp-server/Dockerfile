# Hosted AT Directory MCP server (HTTP/SSE transport).
# Multi-stage: bundle with the workspace toolchain, run a lean image with
# only the bundled dist (core inlined) + real npm deps.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY data ./data
COPY packages/core ./packages/core
COPY packages/mcp-server ./packages/mcp-server
RUN pnpm install --frozen-lockfile --filter @agenticterminal/mcp-server... \
  && pnpm -F @agenticterminal/mcp-server build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/packages/mcp-server/dist ./
RUN corepack enable && npm install --omit=dev --no-package-lock \
  && rm -rf /root/.npm
ENV PORT=8099
EXPOSE 8099
# Healthcheck hits the HTTP transport's /healthz.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8099)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "http.js"]
