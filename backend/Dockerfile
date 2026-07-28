# Build context is the REPO ROOT, not backend/ — pnpm needs the workspace
# lockfile to install deterministically. See .github/workflows/prod-deploy.yaml.
FROM node:22-slim

# corepack picks the pnpm version from the root package.json "packageManager" field.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

# Manifests first so this layer caches until a dependency actually changes.
# frontend/package.json is required even though it is never installed: pnpm
# validates every workspace project against the lockfile before installing.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod --filter=@monorepo/backend...

COPY backend/src ./backend/src

ENV NODE_ENV=production
WORKDIR /app/backend

EXPOSE 8080
CMD ["node", "src/index.js"]
