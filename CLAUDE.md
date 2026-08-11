# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DivvyUp is a group expense-splitting app (Splitwise-like). pnpm-workspaces monorepo driven by Turborepo 2.x:
`backend/` (Express + Mongoose + Socket.IO) and `frontend/` (React 18 + Vite). Both ESM. The
backend is **TypeScript** (`strict`); the frontend is still JS/JSX (its migration is TODO #14, backend-first).

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
pnpm dev                                                        # tsx watch src/index.ts (no build step in dev)
pnpm typecheck                                                  # tsc --noEmit (the PR gate; vitest/tsx strip types, they don't check)
pnpm build                                                      # tsc -p tsconfig.build.json -> dist/ (excludes tests)
pnpm test                                                       # vitest run --coverage (compiles TS via esbuild)
pnpm exec vitest run src/tests/group.test.ts                    # single file
pnpm exec vitest run -t "get groups by group Id"                # single test
```

TypeScript layout: root `tsconfig.base.json` holds the shared options (`strict`, target); `backend/tsconfig.json`
extends it (NodeNext, `noEmit`, used by `typecheck` and the editor, includes tests); `backend/tsconfig.build.json`
emits `dist/` and excludes `src/tests`. Relative imports keep the `.js` extension (NodeNext resolves it to the `.ts`
source). Mongoose types come from `InferSchemaType<typeof Schema>`; the balance/debt engine lives in `services/ledger.ts`,
not on the document (see [docs/ts-migration.md](docs/ts-migration.md)).

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

`.env` files are per-workspace (`backend/.env`, `frontend/.env`), not at the root — see README for the full list. Backend needs `MONGO_URL`, `jwt_secret` (lowercase), `CLIENT_URL` (Socket.IO CORS origin), Cloudinary and Resend keys. Frontend needs `VITE_API_URL` and `VITE_SOCKET_URL`.

**Local and Koyeb share the Atlas cluster but not the database.** The database is the path segment of `MONGO_URL`, before the `?`: local uses `/test`, Koyeb uses `/prod`. Leaving the path empty is what MongoDB reads as `test`, which is how running Cypress locally used to write straight into production — 15 of the 19 groups there were spec leftovers. If you add the name after the query string it silently keeps using `test`.

Both databases carry the same two throwaway accounts, `javi@divvyup.test` and `ana@divvyup.test` (password in `notes.txt`), so the invite flow can be exercised end to end without registering anything. Backend tests never touch either: `connectDB()` swaps to `mongodb-memory-server` under `NODE_ENV=test`.

## Architecture

### A group member is a name, not an account

`members: [{ name, user: ObjectId|null }]`, and **`members[]._id` is the identity** that `Expense.paidBy`, `Expense.participants[].member` and `Payment.from`/`to` point at. `user` is optional: a member who will never register still owns expenses, holds a balance and can be a creditor.

Joining a group is one field — `members[i].user = userId` — so nothing is ever merged or rewritten, and a member keeps their whole history. Only members with `user == null` can be claimed, or the first stranger with the link would take over the creator's member.

Consequences worth knowing before touching anything here:

- **`populate` cannot resolve a ref that points inside another document's subdocument array.** `balance[].member`, `debt.from` and `participants[].member` therefore have no `ref` at all; the join is done by hand with `hydrateMembers(group, target, paths)` in `utils/members.js`, and `MEMBER_PATHS` is where an expense keeps its member ids. The only surviving `populate` is `members.user`, always with the `MEMBER_FIELDS` projection (`'name profilePicture'`, email deliberately left out) — widening it is how the password hash used to reach every group member.
- **Permission checks use `memberOf(group, userId)`**, which returns the member (not a boolean) because callers need its `_id`. It never matches a member without an account.
- `Group.inviteCode` is 16 random bytes, unique-indexed, generated in `pre('validate')`. It is the whole authentication of the join flow, so it is regenerable and never guessable. `GET /group/invite/:code` is public and answers only `{ name }`; the list of unclaimed members stays behind the token in `GET /group/join/:code`.
- The invite URL is built in the **frontend** from `window.location.origin`, not from `CLIENT_URL`.

Contract rules that came out of building this and that new code has to keep:

- **The name shown is always `member.name`, never `member.user.name`.** The name belongs to the group and any member can edit it; the linked account only supplies the avatar. Rendering the account's name would mean that editing your profile renames you for everyone, in every group you are in.
- **Removing a member who appears in an expense or in a settled payment is a 409** (`updateGroup`), account or no account. `updateBalance()` rebuilds from the *expenses*, not from the member list, so without that check you can drop someone and their debts stay alive. Member names are unique within a group, compared lowercased and trimmed.
- **`pay` has exactly one exception to "you must be the `from` or the `to`":** when neither side has a linked account, any member of the group can settle that debt. `generateDebts()` produces one as soon as two account-less members are involved and nobody would ever be able to clear it. It grants an attacker nothing new — `updateExpense` and `deleteExpense` already only check membership, the ledger is collective. Settling a payment that is not `pending` is a 409, because a double click sent two PATCHes and two notifications to the creditor.
- **`getUserGroups` filters by `members.user`, so someone who already has an account does not see the group until they open the invite link.** That is accepted friction, not a bug: it buys a single resolution path and removes the entire "that email does not exist" class of error.

Why the model looks like this, what was discarded (shadow users, a `GuestMember` collection, per-member email tokens) and why is in [docs/archive/miembros-invitados.md](docs/archive/miembros-invitados.md).

### The balance/debt engine lives in the Mongoose models, not in controllers

`backend/src/schemas/group.schema.js` holds the core domain logic as instance methods:

- `updateBalance()` — seeds every member at 0, replays every `Expense` in the group (credit the payer the full amount, debit each participant their `amountOwed`), then applies `Payment`s with `status: 'paid'`. Indexed by member `_id`, and it carries no `populate`: names take no part in the arithmetic. Result is persisted to `group.balance`.
- `generateDebts()` — deletes all `status: 'pending'` Payments for the group and greedily re-derives them by matching negative balances (debtors) against positive ones (creditors).

**"Debts" are not a separate collection — a debt is a `Payment` with `status: 'pending'`.** Settling one flips it to `'paid'`, which changes the balance on the next recalculation.

`expense.schema.js` registers `post('save' | 'findOneAndUpdate' | 'findOneAndDelete')` hooks that load the group and call both methods. Consequence: any expense mutation must go through document `save()` or those specific query helpers, or balances and debts will silently drift. Bulk operations (`updateMany`, `insertMany`) bypass the hooks.

### Money is `decimal.js`, never native floats

**Every monetary calculation goes through `decimal.js`** (a real `dependency` of the backend). No `+`/`-`/`/` on amounts, no `Math.round(x * 100) / 100`, no `toFixed(2)` to "round" — those are what let a group's balance stop netting to zero.

- Accumulate as `Decimal`, convert once at the boundary: MongoDB stores `Number`, so the last step is `.toDecimalPlaces(2).toNumber()`. `updateBalance()` and `generateDebts()` do exactly that.
- Splitting an expense floors each share (`ROUND_DOWN`) and hands the leftover cents out one each from the top of the participant list (`splitEvenly` in `expense.controller.js`). Dividing evenly and rounding each share independently loses or invents cents: 10 € between 3 gave three shares of 3.33 against a 10 € credit, leaving the group permanently 1 cent out.
- Watch the predicates: `isPositive()` is **true for zero** and `isNegative()` is true for `-0`, so comparisons that must exclude zero use `.greaterThan(0)` / `.lessThan(0)`.

### Two Express app factories — pick the right one

- `src/index.js` is the real server: mounts the router at **`/api`**, creates the HTTP server, attaches Socket.IO, connects the DB, listens.
- `src/bootstrap.js` (`bootstrapApp()`) is the test-only app: mounts the same router at **`/`**, no socket, no DB connect.

So request paths in tests have no `/api` prefix, and `req.app.get('socketio')` is `undefined` under `bootstrapApp()` — notification calls in controllers will throw unless the socket is stubbed. Keep the two files in sync when adding global middleware.

### Real-time notifications

`socket.server.js` puts each client into a room named `user:<userId>` when it emits `register`. The `io` instance is stashed with `app.set('socketio', io)` and controllers retrieve it via `req.app.get('socketio')`, then call `sendNotificationToUser(io, userId, type, message, data)` from `services/notifications.js`, which emits a `notification` event to that room. Frontend side is `components/notifications/notifications.jsx` — a render-null component that opens the socket and pipes events into react-toastify.

Notifications only go to members with a linked `user` — `linkedUserIds()` in `utils/members.js` filters them — since emitting to a member without an account means emitting into an empty room.

### Auth

`user.schema.js` owns password hashing (`pre('save')` bcrypt), `comparePassword()`, and `generateJWT()` (payload `{id, name, email}`, signed with `process.env.jwt_secret`, **no expiry option is passed** despite the unused `expirationDay` calculation).

**`password` is declared `select: false`**, and login is the only place that asks for the hash, with `.select('+password')`. That is the field being protected rather than each call being protected: `updateUser` returns the whole document from `findByIdAndUpdate` and used to hand the caller's own bcrypt hash to the browser and to the logs, and the projection alone closed it without touching that controller.

Registration validates in `registrationErrors()` before touching the DB, so a 400 leaves from where the request is read and `catch` still means a real failure. **Do not move the strength rule onto Mongoose `minlength`:** its default message quotes the value it rejected, which puts the plaintext password in the response body and the logs. Tests pin that no error response ever contains it. The regex is currently spelled in both `auth.routes.js` and `registerForm.jsx` — point 11 of the TODO is what removes the duplication.

`security/jwt.js` exports `jwtMiddleware`, which verifies the `Authorization: Bearer` header and sets `req.jwtPayload`. Nearly every route is wrapped in it; `auth.routes.js` (register/login) is not.

Frontend stores `{token, user}` as JSON in `localStorage` under the key `user-session`. `utils/localStorage.js` is the only place that key appears; `context/userContextAuth.jsx` (`useAuth()`) exposes `token`/`login`/`logout`; routes in `App.jsx` gate on `token` with `<Navigate to="/login" />`.

### Frontend data layer

`utils/axios.js` creates a single axios instance from `VITE_API_URL`. There is **no auth interceptor** — every call passes `authHeaders(token)` explicitly. Endpoints are grouped per resource in `utils/{group,expense,payment,auth,user}Api.js`, and those modules are the only ones that import the axios instance.

**Every request in the app goes through `@tanstack/react-query` v5, and always through a hook in `src/hooks/`.** No component imports `utils/*Api.js` or axios directly, and no `useQuery`/`useMutation` is written inline in a component. Object syntax only (`useQuery({ queryKey, queryFn })`, `useMutation({ mutationFn })`, `invalidateQueries({ queryKey })`); the old `react-query` package and its positional API are gone. The `QueryClientProvider` is in `App.jsx`.

The layout, one file per resource: `useGroups`, `useGroupDetails`, `useExpenses`, `usePayments`, `useInvite`, `useSession` (login/register) and `useProfile`. Rules that came out of building it:

- **The hook takes the token from `useAuth()` itself.** Components never pass it. Queries that need it are `enabled: Boolean(token)` so they do not fire a 401 before the session is read.
- **Every cache key lives in `hooks/queryKeys.js`.** A query and the mutations that invalidate it have to spell the same array, and that only holds if there is one place to read it from.
- **The mutation hook owns the invalidation, the component owns the UI.** Toasts, `navigate` and closing modals go in the per-call `mutate(vars, { onSuccess, onError })`, which runs after the hook's own `onSuccess`. Do not pass UI into the hook.
- Cache invalidation *is* the refresh mechanism: an expense mutation drops `groupDetails(groupId)` and `myExpenses`, joining a group drops `groups`. That is why no component takes a `refreshGroupDetails` or `setGroups` prop any more — the server state has one owner.
- `useSettleDebt` invalidates on `onSettled`, not `onSuccess`: settling a debt somebody else already settled is a 409, and that is exactly the case where the screen is stale and has to refetch.
- Login and register `queryClient.clear()` before storing the session, so the next screen never mounts against the previous user's cache.

Every avatar in the app goes through `components/avatar/memberAvatar.jsx`: outlined, monochrome, initials from `initialsOf()` when there is no picture. It is one component on purpose. The four copies it replaced had drifted into two different colour schemes, and one of them rendered white on a white header.

All four dropdowns go through `components/menu/appMenu.jsx` — the header's, `UserMenu`'s, `groupActions`' and `expenseActions`'. It carries no `sx`: with `background.paper` and `action.hover` correct in the palette, MUI's `Paper` and `MenuItem` defaults already paint the surface. It stays a component so that reaching for the bare `Menu` is a visible choice, and so menu styling has one place to land.

Menu entries are `MenuItem` with the content directly inside. Do not wrap it in a `Button`: a `<button>` inside `role="menuitem"` is invalid ARIA, and MUI's `Button` defaults to `color="primary"`, whose hover tints the row blue on top of the item's own hover.

The header is **one file per variant** — `guestHeader`, `desktopHeader`, `mobileHeader`, with `header.jsx` doing nothing but picking one and exporting `MOBILE_QUERY` (768px, read with `useMediaQuery`; the CSS module deliberately has no media query, so the breakpoint is written once). The split is what keeps the collapsed menu's `anchorEl` inside `mobileHeader`: crossing the breakpoint unmounts the component, so no effect has to reset that state. Every clickable icon in the header is an `IconButton` with an `aria-label` — `Icon` on its own renders an `<svg>` with an `onClick`, which is neither focusable nor named.

Two rules about the collapsed menu, both of them decisions rather than details, and `header.test.jsx` asserts the whole list in order rather than that the items exist:

- **The order is `Groups`, `Expenses` | `Profile`, `Dark mode` | `Logout`, and `Logout` goes last behind its own divider.** It is the only destructive action in the menu and it reloads the page, so on a 390px touch target the one thing next to it is a divider.
- **The theme toggle is the only entry that does not close the menu.** The other four navigate or end the session; this one is a switch, and its label flipping between `Dark mode` and `Light mode` is the confirmation that it worked. Closing threw that away and made undoing it cost two taps. It is also text-only in the menu — an icon there pushed its label out of line with the other five.

Styling is CSS Modules (`foo.module.css` beside `foo.jsx`) plus MUI. `context/darkModeContext.jsx` still exists, but recent commits deliberately removed per-component `useDarkMode` usage in favor of the MUI theme (`useTheme`) — follow that direction in new components. The exception is `header/themeToggle.jsx`, which needs `toggleDarkMode` itself: it is the switch.

**Every colour is declared in `App.css`, and nowhere else.** `theme/appTheme.js` holds no colour value: `createAppTheme(darkMode)` reads them out of the stylesheet and hands them to `createTheme`. MUI consumes the palette, it does not own it.

`:root` carries the light values and `body.dark` restates only the five that differ; the two primaries are shared. The names are the ones the CSS Modules already consume: `--color`, `--bg-color`, `--secondary-bg-color`, `--border-color`, `--placeholder-color`, `--primary-color`, `--primary-color-dark`. A new colour goes in `:root`, plus `body.dark` if dark needs a different one.

Four rules hold that together:

- **The `palette` takes resolved colours, never a `var()` string.** MUI derives `light`/`dark`/`contrastText` from `main` and decomposes colours into the `R G B` channels its hover styles compose into `rgba(R G B / opacity)`, so it needs values it can parse. It also emits `--mui-palette-*` on `:root`, where `body.dark` does not apply, so a `var()` there resolves to the light value in dark mode.
- **`components.*.styleOverrides` is CSS**, copied out verbatim for the browser to resolve, so a `var()` belongs there — that is why `THEME_TRANSITION` is the literal `'var(--theme-transition)'`. The split is who reads the value: the browser resolves a `var()`, JavaScript arithmetic cannot.
- **Read the rules, not `getComputedStyle`.** The theme is built during render and the `dark` class lands in an effect, so the computed value of a colour is still the light one while the dark theme is being built. `declarationsFor()` walks `document.styleSheets` for the `:root` and `body.dark` rules and resolves them the way the cascade does.
- **A missing declaration throws**, naming the variable. A fallback would put a colour back into JS.

Two of the values are load-bearing and not free to change:

- **The light surface is `#f0f0f0`, darker than the `#f8f7f7` page.** A lighter surface leaves forms and modals with no relief against the background at all.
- **`action.hover` carries no override.** MUI's default is alpha, so it composes over whatever surface is beneath it and by construction cannot equal it. A solid value can: the previous one was `#f0f0f0`, the same value the form surface uses, which would have made the menu hover invisible.

Transitions come off one knob, `--transition-base`. Set it only on the element that declares the colour: a child that re-transitions an inherited value chases its parent's animation and looks slower. `MuiMenuItem` therefore transitions `background-color` alone — it is transparent at rest and inherits its colour from the paper.

`jest.config.cjs` maps stylesheets to `identity-obj-proxy`, so `jest.setup.js` injects the real `App.css` into jsdom; without it there is no palette to read and no theme can be built.
- **`getComputedStyle` is the wrong way to read them.** The theme is built during render and the `dark` class is added in an effect, so in dark mode the computed value of `--color` is still the light one at the moment MUI needs the dark one. `declarationsFor()` walks `document.styleSheets` for the `:root` and `body.dark` rules instead, and resolves a colour the way the cascade does — `body.dark` first, `:root` behind it. The rules are there regardless of which class is applied, so the ordering problem disappears rather than being worked around. Verified against the minified build: esbuild keeps both selectors intact.
- **A missing declaration must be loud.** `createAppTheme` throws naming the variable rather than falling back to a default, because a default would quietly put a colour back into JS. `darkModeContext.test.jsx` pins that, and asserts each MUI variable against the CSS one it came from without restating a single hex.

`jest.config.cjs` maps stylesheets to `identity-obj-proxy`, so `App.css` is absent from jsdom and the theme could not be built at all. `jest.setup.js` injects the real file into `document.head` — the real one, not a copy of its values, or the tests would become the third place the palette lives.

### Backend request flow

`routers/router.js` mounts `/group` twice (expense routes and group routes both live under it), plus `/user`, `/auth`, `/payment`. All validation is inline in the controllers — there is no `middlewares/` directory any more (its three helpers were only ever wired to routes that got deleted); `notes.txt` still tracks moving validation out.

Profile images: multer with `memoryStorage()` → `config/cloudinary.config.js` → `uploadToCloudinary(buffer)` returns the secure URL stored on `user.profilePicture`. It is optional everywhere — registration works without one and `updateUser` only touches the field when a file arrives. With no picture the UI falls back to the name's initials (`initialsOf()`), which is also what a member without an account gets.

An empty result is a `200 []`, not a 404: that goes for `getUserGroups`, `getExpensesByUserId` and `getExpensesByGroupId`.

### Comments explain why, not what

A comment earns its place only when the code cannot say the thing itself: the *why* behind a non-obvious choice, a past bug the shape is guarding against, a contract that is not visible locally. A comment that restates what the next line already says (`// Update a user` over `updateUser`, `// authenticated user id` over `req.jwtPayload`) is noise — delete it, don't write it. The rationale that does matter lives better in the commit message than in the code. The `why` comments already in the controllers (the picture-wipe bug, the single login error message, the public invite handler) are the model: none of them describe *what* the line does.

## Testing notes

- Backend tests run on **vitest** (`vitest run --coverage`), configured in `backend/vitest.config.js`. vitest defaults `NODE_ENV` to `test`, which is what `connectDB()` in `mongo/connection/index.js` checks to swap to an in-memory `mongodb-memory-server` URI — so no `cross-env` is needed. `fileParallelism: false` is set because the files share one DB per run: each test file spins its own memory server and connects the module-global mongoose, so running them serially keeps two files from racing on that connection (this is the vitest analog of jest's old `--runInBand`). `globals: true` is set so the tests' bare `describe`/`it`/`expect` need no imports. The `mongodb-memory-server` import is deliberately **lazy** — `await import(...)` inside the `NODE_ENV === 'test'` branch: it is a devDependency and absent from the production image, so a top-level import crashes the container at boot.
- **`.github/workflows/typecheck.yaml` runs `tsc --noEmit` on every PR** that touches `backend/**` or the root/base manifests — the repo's first PR gate (before this, nothing ran in PR CI; the deploy workflow only fires on push to `main`). It exists because vitest and `tsx` strip types without checking them, so green tests are not a type check.
- Any backend test hitting a route needs an `Authorization: Bearer` header — almost every route carries `jwtMiddleware`. The signing secret is set once in `backend/vitest.setup.js` (`setupFiles`), not per test file: `jwt.js` and `user.schema.js` read `process.env.jwt_secret` at **call time**, not at import, so the value only has to exist before the first request — no import-order dance. (Under ESM the old before-the-requires trick would not have worked anyway: `import`s are hoisted above any top-level statement.)
- `pnpm test` in `frontend/` is **green**: 3 suites, 36 tests — `components/icon`, `components/header` and `context/darkModeContext`. It used to exit 1 on two commented-out templates that contained no tests at all, which is why `--passWithNoTests` is deliberately absent: with it, a suite that stops running by accident looks the same as a suite that passes. Nothing runs jest in CI either — the deploy workflow is path-filtered to `backend/**` and Cloudflare Pages only runs `vite build` — so a frontend test guards intent, not the pipeline.
- `icon.test.jsx` asserts that each variant renders an SVG **different from `add`'s**, not that it renders something. `Icon` resolves `iconsByVariant[variant] || MdAddCircleOutline`, so a variant that does not exist — or whose import broke — silently becomes the add icon everywhere it is used, with no error. Checking for "an SVG" would not catch that.
- jsdom needs two shims for the frontend suites. `jest.setup.js` defines `TextEncoder`/`TextDecoder` from `node:util`: `react-router` 7 reads them at import time, so **any** test that renders a router fails to even load the suite without them. And a test that renders `Header` has to stub `window.matchMedia` itself — MUI's `useMediaQuery` is what decides whether the header is collapsed, and jsdom ships no `matchMedia` at all.
- `vitest.workspace.js` wires the Storybook test addon (Vitest + Playwright/chromium) separately from the jest setup — two independent frontend test runners coexist.
- **Cypress is the only real net the frontend has** — 7 specs, 13 tests, all green, and nothing else runs against the built app. Between them they cover login and a failed login, the profile form, creating/editing/deleting a group, the 409 when dropping a member who is in an expense, resetting and sharing the invite link, the whole life of an expense with its balance and debts, `/my-expenses`, and both halves of the join flow. Run it against a running app; it writes to whatever `MONGO_URL` points at, so check that it says `/test`.
- Specs seed through the API and drop the session into `localStorage`, never through the UI: helpers are in `cypress/support/api.js` (the three oldest specs still carry their own copy). **Anything derived from a seeded value has to hang off a `cy.then()`** — interpolating an id straight into `cy.visit()` reads it at queue time, before the request that fills it has answered, and you get `/groups/undefined/expenses`.
- **Cypress writes to the real database, not to `mongodb-memory-server`.** The in-memory swap only happens under `NODE_ENV === 'test'`, which only the backend's own `pnpm test` sets; the dev server runs plain `tsx watch src/index.ts`, so a spec run registers ~10 real accounts in `/test` and nothing cleans them up. `pnpm --filter @monorepo/backend clean:e2e` counts them (dry run; `--yes` deletes) and cascades to their groups, expenses and payments. It matches only `<letters><timestamp>@test.com`, which is the shape the specs build with `Date.now()`, and it refuses to run against any database that is not `test`.

## Deployment

Push to `main` triggers `.github/workflows/prod-deploy.yaml`: builds `backend/Dockerfile`, pushes `ghcr.io/divvyup-app/splitwise:latest`, then triggers a redeploy on **Coolify** and **polls** `GET /api/v1/deployments/{uuid}` until `finished`/`failed`, so a broken image fails the job instead of going green on acceptance. Path-filtered to `backend/**` plus the root manifests and lockfile, so docs-only merges no longer cycle production.

**The Docker build context is the repo root, not `backend/`** (`docker build . --file backend/Dockerfile`). pnpm needs `pnpm-lock.yaml` and `pnpm-workspace.yaml` to install deterministically, and both live at the root. **The Dockerfile is multi-stage**: a `build` stage installs *with* devDependencies (it needs `typescript`), copies `tsconfig.base.json` + the two backend tsconfigs + `src`, and runs `pnpm build` (`tsc` → `dist/`); the `runtime` stage installs `--prod --filter=@monorepo/backend...` and copies only `dist/` from the build stage, then runs `node dist/index.js`. So the final image carries no TypeScript toolchain, and anything the backend requires **at runtime** must be a real `dependency` — a devDependency imported at module top level will crash the container. The build stage compiles `src` minus `src/tests`, so a type error in shipped code fails the image build; a type error in a test is caught only by the `Typecheck` PR gate (`tsconfig.json` includes tests, the build config does not).

The backend runs at `https://divvyup-api.jorgeaf.dev` on a self-hosted **Coolify** (OVH VPS-1 2027), which handles TLS (Traefik + Let's Encrypt) and the reverse proxy — a custom domain is free and automatic there, which is what took DivvyUp off Koyeb (custom domain was paid). Migrated off Koyeb on 2026-08-11; Koyeb is decommissioned. Coolify only pulls and runs the GHCR image, so no build happens on the VPS. **Two tokens, don't confuse them:** `coolify-ghcr-pull` is a GitHub PAT (`read:packages`) living on the VPS via `docker login` (`/root/.docker/config.json`) that lets Coolify pull the private image; `COOLIFY_TOKEN` is a Coolify API token, a repo secret, used by the workflow to trigger the deploy. The panel is at `coolify.jorgeaf.dev` (2FA); direct `IP:8000` access is blocked by hand because **Docker bypasses `ufw`** — iptables raw `PREROUTING` on 8000/8080/6001/6002 plus a `block-coolify-ports` systemd oneshot to survive reboot. Backend env vars replicate what Koyeb had: `MONGO_URL` (with `/prod` in the path, **not** empty or MongoDB reads `test`), `jwt_secret`, `CLIENT_URL`, the three Cloudinary keys, `RESEND_API_KEY`, `RESEND_FROM`.

Frontend deploys on **Cloudflare Pages** (project `divvyup`, live at `https://divvyup.jorgeaf.dev`), connected to the GitHub repo — no workflow file, the config lives in the Pages dashboard:

- Root directory is the **repo root**, not `frontend/`: Pages picks the package manager from the lockfile it finds there, and `pnpm-lock.yaml` + `pnpm-workspace.yaml` are at the root (same reason as the Docker build context).
- Build command `pnpm install --frozen-lockfile --filter @monorepo/frontend && pnpm --filter @monorepo/frontend build`, output `frontend/dist`.
- Build env vars: `VITE_API_URL`, `VITE_SOCKET_URL` (Vite inlines them at build time, so they must be build vars), `NODE_VERSION` (mandatory — `packageManager: pnpm@11.0.0` needs Node >= 22.13, newer than the default image), `SKIP_DEPENDENCY_INSTALL=1` (the filtered install is done by the build command; without this Pages also runs an unfiltered `pnpm install` that pulls the backend's 122 MB `mongodb-memory-server` binary) and `CYPRESS_INSTALL_BINARY=0`.
- Pages serves `index.html` for unmatched routes on its own, so the SPA needs no `_redirects` file.
- The custom domain is `divvyup.jorgeaf.dev`. Pages can't disable the generated `divvyup-8wi.pages.dev`, so it is 301'd to the custom domain by an **account-level Bulk Redirect** (not a zone Redirect Rule — the `pages.dev` source isn't in the `jorgeaf.dev` zone), with preserve-query/subpath/path-suffix/include-subdomains on. `include subdomains` also catches preview deployments (`<hash>.divvyup-8wi.pages.dev`).
- **Build watch paths**, in the dashboard: include `frontend/*`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; exclude empty. A docs-only push is skipped here too, exactly like the workflow's `backend/**` path filter — neither deploy cycles on documentation. The three root files are watched because each one changes what gets built: the build installs from the lockfile, `pnpm-workspace.yaml` carries `allowBuilds` and `minimumReleaseAge`, and the root `package.json` pins the pnpm that Pages runs. Excludes are a skip list evaluated *before* the includes, so a path listed in both never builds. The paths live in the Pages settings, not in the repo, so a new build input has to be added there by hand.

Netlify is gone: its GitHub access was revoked in July 2026, so the three always-failing PR checks no longer appear — a red check on a PR now means something real.

**`CLIENT_URL` is the front origin the backend allows in CORS**, and **both** CORS layers use it: the Socket.IO CORS (`socket/socket.server.js`) and the REST CORS (`index.js`, `cors({ origin: process.env.CLIENT_URL })`). Compared exactly, no trailing slash; it is `https://divvyup.jorgeaf.dev`. Preview deployments get their own subdomain and will not pass that check. `credentials: true` is deliberately out until the Better Auth cookie work (auth is header-based `Bearer` today, so an open-vs-locked CORS leaks nothing, but `*` is incompatible with credentials so it was locked ahead of that). `bootstrap.js` (test app) keeps an open `cors()` on purpose — CORS is browser-enforced and supertest sends no `Origin`.
