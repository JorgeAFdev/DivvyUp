# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DivvyUp is a group expense-splitting app (Splitwise-like). npm-workspaces monorepo driven by Turborepo 1.x:
`backend/` (Express + Mongoose + Socket.IO, CommonJS) and `frontend/` (React 18 + Vite, ESM).

## Commands

Run from the repo root unless noted:

```bash
npm install              # installs both workspaces
npm run dev              # turbo: frontend (:3000) + backend (:3001)
npm run start:frontend   # frontend only
npm run start:backend    # backend only
docker compose up mongo  # local MongoDB on host port 27035
```

Backend (`cd backend`):
```bash
npm test                            # NODE_ENV=test jest --coverage --runInBand
npx cross-env NODE_ENV=test npx jest src/tests/group.test.js   # single file
npx cross-env NODE_ENV=test npx jest -t "get groups by group Id"  # single test
```

Frontend (`cd frontend`):
```bash
npm run build            # vite build -> dist/
npm test                 # jest (jsdom + babel-jest), *.test.jsx colocated with components
npx jest src/components/header/header.test.jsx
npm run cy:open / cy:run # Cypress e2e against http://localhost:3000 (app must be running)
npm run storybook        # :6006
```

There is no lint script and no eslint config file, despite eslint deps in the root `package.json` and a `lint` task in `turbo.json`. Don't run `npm run lint`.

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

Profile images: multer with `memoryStorage()` → `config/cluodinary.config.js` (filename typo is intentional/load-bearing) → `uploadToCloudinary(buffer)` returns the secure URL stored on `user.profilePicture`.

## Testing notes

- Backend tests use `mongodb-memory-server`: `connectDB()` in `mongo/connection/index.js` swaps to an in-memory URI whenever `NODE_ENV === 'test'`, so tests must set that env var (the `npm test` script does). `--runInBand` is required — the tests share one DB.
- Frontend jest maps CSS imports to `identity-obj-proxy`, **which is not installed**, and `jest.setup.js` imports `@testing-library/jest-dom/extend-expect`, a path removed in jest-dom v6 (v6 is installed). Both need fixing before any frontend jest test that imports a CSS module can run; the two existing `.test.jsx` files are entirely commented out.
- `vitest.workspace.js` wires the Storybook test addon (Vitest + Playwright/chromium) separately from the jest setup — two independent frontend test runners coexist.

## Deployment

Push to `main` triggers `.github/workflows/prod-deploy.yaml`: builds `backend/Dockerfile`, pushes to `ghcr.io/divvyup-app/splitwise:latest`, redeploys the Koyeb service `wandering-nert/splitwise`. Frontend has **no CI** — per `notes.txt` it's `npm run build` with production env vars, then the `dist/` folder is uploaded to Netlify manually.
