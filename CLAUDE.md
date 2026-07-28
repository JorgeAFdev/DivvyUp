# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DivvyUp is a group expense-splitting app (Splitwise-like). pnpm-workspaces monorepo driven by Turborepo 2.x:
`backend/` (Express + Mongoose + Socket.IO, CommonJS) and `frontend/` (React 18 + Vite, ESM).

**Package manager is pnpm** — pinned via `packageManager` in the root `package.json`. Never run `npm install`; it would recreate `package-lock.json` and fight the pnpm lockfile. Workspace members are declared in `pnpm-workspace.yaml`, not in a `workspaces` field.

## Commands

Run from the repo root unless noted:

```bash
pnpm install             # installs both workspaces
pnpm dev                 # turbo: frontend (:3000) + backend (:3001)
pnpm start:frontend      # frontend only
pnpm start:backend       # backend only
pnpm audit --prod        # what actually ships; dev-only findings are noise
docker compose up mongo  # local MongoDB on host port 27035
```

Backend (`cd backend`):
```bash
pnpm test                                                       # NODE_ENV=test jest --coverage --runInBand
pnpm exec cross-env NODE_ENV=test pnpm exec jest src/tests/group.test.js   # single file
pnpm exec cross-env NODE_ENV=test pnpm exec jest -t "get groups by group Id"  # single test
```

Frontend (`cd frontend`):
```bash
pnpm build               # vite build -> dist/
pnpm test                # jest (jsdom + babel-jest), *.test.jsx colocated with components
pnpm exec jest src/components/header/header.test.jsx
pnpm cy:open / cy:run    # Cypress e2e against http://localhost:3000 (app must be running)
pnpm storybook           # :6006
```

There is no lint script and no eslint config file, despite eslint deps in the root `package.json` and a `lint` task in `turbo.json`. Don't run `pnpm lint`.

### pnpm settings that will bite you

- `.npmrc` sets `ignore-scripts=true`. A dependency needing a postinstall (native bindings, downloaded binaries) must be listed under `allowBuilds` in `pnpm-workspace.yaml` or it installs silently broken. Currently allowed: `@swc/core`, `esbuild`, `cypress`, `mongodb-memory-server`, `unrs-resolver`.
- `minimumReleaseAge: 4320` (3 days) blocks just-published versions as supply-chain protection, so a brand-new release will not resolve.
- pnpm's `node_modules` is strict: importing a package that is not declared in that workspace's `package.json` fails, even if some other package depends on it. npm's flat hoisting used to hide this.

## Environment

`.env` files are per-workspace (`backend/.env`, `frontend/.env`), not at the root — see README for the full list. Backend needs `MONGO_URL`, `jwt_secret` (lowercase), `CLIENT_URL` (Socket.IO CORS origin), Cloudinary and SendGrid keys. Frontend needs `VITE_API_URL` and `VITE_SOCKET_URL`.

## Architecture

### The balance/debt engine lives in the Mongoose models, not in controllers

`backend/src/schemas/group.schema.js` holds the core domain logic as instance methods:

- `updateBalance()` — replays every `Expense` in the group (credit the payer the full amount, debit each participant their `amountOwed`), then applies `Payment`s with `status: 'paid'`. Result is persisted to `group.balance`.
- `generateDebts()` — deletes all `status: 'pending'` Payments for the group and greedily re-derives them by matching negative balances (debtors) against positive ones (creditors).

**"Debts" are not a separate collection — a debt is a `Payment` with `status: 'pending'`.** Settling one flips it to `'paid'`, which changes the balance on the next recalculation.

`expense.schema.js` registers `post('save' | 'findOneAndUpdate' | 'findOneAndDelete')` hooks that load the group and call both methods. Consequence: any expense mutation must go through document `save()` or those specific query helpers, or balances and debts will silently drift. Bulk operations (`updateMany`, `insertMany`) bypass the hooks.

All money is rounded via `roundToTwoDecimals` at every accumulation step.

### Two Express app factories — pick the right one

- `src/index.js` is the real server: mounts the router at **`/api`**, creates the HTTP server, attaches Socket.IO, connects the DB, listens.
- `src/bootstrap.js` (`bootstrapApp()`) is the test-only app: mounts the same router at **`/`**, no socket, no DB connect.

So request paths in tests have no `/api` prefix, and `req.app.get('socketio')` is `undefined` under `bootstrapApp()` — notification calls in controllers will throw unless the socket is stubbed. Keep the two files in sync when adding global middleware.

### Real-time notifications

`socket.server.js` puts each client into a room named `user:<userId>` when it emits `register`. The `io` instance is stashed with `app.set('socketio', io)` and controllers retrieve it via `req.app.get('socketio')`, then call `sendNotificationToUser(io, userId, type, message, data)` from `services/notifications.js`, which emits a `notification` event to that room. Frontend side is `components/notifications/notifications.jsx` — a render-null component that opens the socket and pipes events into react-toastify.

Note: `notificationTypes` exports the key `EXPENSE_SETTLED` but `payments.controller.js` reads `notificationTypes.DEBT_SETTLED` (undefined). If you touch notification types, reconcile the two.

### Auth

`user.schema.js` owns password hashing (`pre('save')` bcrypt), `comparePassword()`, and `generateJWT()` (payload `{id, name, email}`, signed with `process.env.jwt_secret`, **no expiry option is passed** despite the unused `expirationDay` calculation).

`security/jwt.js` exports `jwtMiddleware`, which verifies the `Authorization: Bearer` header and sets `req.jwtPayload`. Nearly every route is wrapped in it; `auth.routes.js` (register/login) is not.

Frontend stores `{token, user}` as JSON in `localStorage` under the key `user-session`. `utils/localStorage.js` is the only place that key appears; `context/userContextAuth.jsx` (`useAuth()`) exposes `token`/`login`/`logout`; routes in `App.jsx` gate on `token` with `<Navigate to="/login" />`.

### Frontend data layer

`utils/axios.js` creates a single axios instance from `VITE_API_URL`. There is **no auth interceptor** — every call passes `authHeaders(token)` explicitly. Endpoints are grouped per resource in `utils/{group,expense,payment}Api.js`; components consume them through react-query **v3** (`useQuery`/`useMutation` with the v3 positional API, not v4/v5 object syntax).

Styling is CSS Modules (`foo.module.css` beside `foo.jsx`) plus MUI. `context/darkModeContext.jsx` still exists, but recent commits deliberately removed per-component `useDarkMode` usage in favor of the MUI theme (`useTheme`) — follow that direction in new components.

### Backend request flow

`routers/router.js` mounts `/group` twice (expense routes and group routes both live under it), plus `/user`, `/auth`, `/payment`. Validation helpers (`validateUser`, `validateGroupExists`) live in `middlewares/index.js`, but most validation is still inline in controllers — `notes.txt` tracks moving it out.

Profile images: multer with `memoryStorage()` → `config/cloudinary.config.js` → `uploadToCloudinary(buffer)` returns the secure URL stored on `user.profilePicture`.

## Testing notes

- Backend tests use `mongodb-memory-server`: `connectDB()` in `mongo/connection/index.js` swaps to an in-memory URI whenever `NODE_ENV === 'test'`, so tests must set that env var (the `pnpm test` script does). `--runInBand` is required — the tests share one DB. The `mongodb-memory-server` import is deliberately **lazy**, inside the `NODE_ENV === 'test'` branch: it is a devDependency and is absent from the production image, so a top-level require crashes the container at boot.
- Any backend test hitting a route needs an `Authorization: Bearer` header — almost every route carries `jwtMiddleware`. `group.test.js` sets `process.env.jwt_secret` *before* its requires, because both `security/jwt.js` and `user.schema.js` capture the secret at import time.
- The two frontend `.test.jsx` files are entirely commented out, so `pnpm test` in `frontend/` passes vacuously.
- `vitest.workspace.js` wires the Storybook test addon (Vitest + Playwright/chromium) separately from the jest setup — two independent frontend test runners coexist.

## Deployment

Push to `main` triggers `.github/workflows/prod-deploy.yaml`: builds `backend/Dockerfile`, pushes to `ghcr.io/divvyup-app/splitwise:latest`, redeploys the Koyeb service `wandering-nert/splitwise`. It is path-filtered to `backend/**` plus the root manifests and lockfile, so docs-only merges no longer cycle production.

**The Docker build context is the repo root, not `backend/`** (`docker build . --file backend/Dockerfile`). pnpm needs `pnpm-lock.yaml` and `pnpm-workspace.yaml` to install deterministically, and both live at the root. The image installs with `--prod --filter=@monorepo/backend...`, so anything the backend requires at runtime must be a real `dependency` — a devDependency imported at module top level will crash the container.

Frontend has **no CI** — per `notes.txt` it's `pnpm build` with production env vars, then the `dist/` folder is uploaded to Netlify manually. The Netlify GitHub checks on PRs are a dead integration and always fail; ignore them.
