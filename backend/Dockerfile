# Build context is the REPO ROOT, not backend/ — pnpm needs the workspace
# lockfile to install deterministically. See .github/workflows/prod-deploy.yaml.

# --- build stage: install dev deps (typescript) and compile src -> dist ---
FROM node:22-slim AS build

# corepack picks the pnpm version from the root package.json "packageManager" field.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

# Manifests first so this layer caches until a dependency actually changes.
# frontend/package.json is required even though it is never installed: pnpm
# validates every workspace project against the lockfile before installing.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# No --prod here: the build needs typescript, which is a devDependency. But the
# devDeps include mongodb-memory-server, whose postinstall would download a
# ~120 MB mongod binary into this throwaway layer just to let tsc run.
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN pnpm install --frozen-lockfile --filter=@monorepo/backend...

COPY backend/tsconfig.json backend/tsconfig.build.json ./backend/
COPY backend/src ./backend/src

RUN pnpm --filter=@monorepo/backend build

# --- runtime stage: prod deps + compiled dist only, no TypeScript toolchain ---
FROM node:22-slim AS runtime

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod --filter=@monorepo/backend...

COPY --from=build /app/backend/dist ./backend/dist

ENV NODE_ENV=production
WORKDIR /app/backend

EXPOSE 8080
CMD ["node", "dist/index.js"]
