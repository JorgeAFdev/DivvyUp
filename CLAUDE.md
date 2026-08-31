# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DivvyUp is a group expense-splitting app (Splitwise-like). pnpm-workspaces monorepo driven by Turborepo 2.x:
`backend/` (Express + Mongoose + Socket.IO), `frontend/` (React 18 + Vite) and `packages/shared`
(the serialized API contract, see below). All ESM. Both `backend/` and `frontend/src` are **TypeScript**
(`strict`); the TODO #14 migration is complete.

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
not on the document (see [docs/archive/ts-migration.md](docs/archive/ts-migration.md)).

Frontend (`cd frontend`):
```bash
pnpm build               # vite build -> dist/
pnpm test                # vitest run (jsdom unit suites), *.test.tsx colocated with components
pnpm exec vitest run src/components/header/header.test.tsx
pnpm test:storybook      # stories as tests in chromium (Playwright), needs a browser
pnpm cy:open / cy:run    # Cypress e2e against http://localhost:3000 (app must be running)
pnpm storybook           # :6006
```

There is no lint script and no eslint config file, despite eslint deps in the root `package.json` and a `lint` task in `turbo.json`. Don't run `pnpm lint`.

### pnpm settings that will bite you

- `.npmrc` sets `ignore-scripts=true`. A dependency needing a postinstall (native bindings, downloaded binaries) must be listed under `allowBuilds` in `pnpm-workspace.yaml` or it installs silently broken. Currently allowed: `@swc/core`, `esbuild`, `cypress`, `mongodb-memory-server`, `unrs-resolver`.
- `minimumReleaseAge: 4320` (3 days) blocks just-published versions as supply-chain protection, so a brand-new release will not resolve.
- pnpm's `node_modules` is strict: importing a package that is not declared in that workspace's `package.json` fails, even if some other package depends on it. npm's flat hoisting used to hide this.

## Environment

`.env` files are per-workspace (`backend/.env`, `frontend/.env`), not at the root — see README for the full list. Backend needs `MONGO_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the backend's own origin, no `/api/auth` suffix), `CLIENT_URL` (the front origin, used by both CORS layers and Better Auth's `trustedOrigins`), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (the Google OAuth client), Cloudinary and Resend keys. Frontend needs `VITE_API_URL` and `VITE_SOCKET_URL`.

**Local and Koyeb share the Atlas cluster but not the database.** The database is the path segment of `MONGO_URL`, before the `?`: local uses `/test`, Koyeb uses `/prod`. Leaving the path empty is what MongoDB reads as `test`, which is how running Cypress locally used to write straight into production — 15 of the 19 groups there were spec leftovers. If you add the name after the query string it silently keeps using `test`.

Both databases carry the same two throwaway accounts, `javi@divvyup.test` and `ana@divvyup.test` (password in `notes.txt`), so the invite flow can be exercised end to end without registering anything. Backend tests never touch either: `connectDB()` swaps to `mongodb-memory-server` under `NODE_ENV=test`.

## Architecture

### `packages/shared` is the serialized API contract

A compiled TS package (`@monorepo/shared`) holding the **JSON shapes the endpoints send** —
`Group`, `Member`, `Expense`/`HydratedExpense`, `Payment`/`HydratedPayment`, `GroupDetails`,
`SessionUser`, etc. in `src/domain.ts`. These are the *serialized* types: every id and date is a
`string` (an `ObjectId` serializes to hex and a `Date` to ISO through `res.json`), amounts are
`number`. They are **not** the backend's Mongoose types, which keep `ObjectId`/`Date`/`Decimal` —
the contract deliberately describes what ships, so it is the one definition both the frontend
(consumer) and the backend (which types its responses against it) read.

- **It is additive.** The backend keeps `InferSchemaType` as the source of its own document
  structure; the contract sits at the response boundary. Every controller now serializes its
  response against it: `serializers/contract.ts` maps each Mongoose document to the contract
  shape field by field — ids to hex strings, dates to ISO, `__v` dropped — and the handlers
  return `res.json(serializeX(...))`, so a raw document (not assignable to a string-id contract
  type) never reaches the wire and schema drift fails to compile. The two trivial responses
  still inline it (`{ name } satisfies InviteName`, `{ inviteCode } satisfies InviteCode`). The
  serializers read the timestamps `InferSchemaType` drops, which is why the hydrated doc types
  (`GroupHydrated`, `ExpenseHydrated`, `PaymentHydrated`) restate `createdAt`/`updatedAt`.
- **Consumed via `dist/`, not source.** Compiled with `tsc` (`build` → `dist/` with `.d.ts`),
  imported as `@monorepo/shared`. Turborepo's `build`/`typecheck`/`dev` carry `dependsOn: ["^build"]`
  so a consumer never typechecks or runs against a stale contract, and the Dockerfile builds
  `shared` before the backend and copies its `dist/` into both stages.
- **Type-only for the backend, for now.** The backend imports it with `import type`, so the
  imports erase and nothing from `shared` is required at runtime; it is a runtime `dependency`
  (and in the image) regardless, so the shared Zod validators of TODO #11 can add runtime code
  later without re-plumbing Docker or the manifests.
- The typecheck gate (`typecheck.yaml`) runs `shared` and `backend` as a matrix; `shared` builds
  first in each job because the backend resolves it from `dist/`.

### `packages/validation` is the shared input contract

A second compiled TS package (`@monorepo/validation`) holding the **Zod schemas for request
bodies** — `registerSchema`, `loginSchema` in `src/auth.ts` — imported by **both** the backend
(the `validate` middleware, and the Better Auth `before` hook for the auth pair) and the frontend (the forms). It is the mirror of `shared` for the
*input* boundary: `shared` types what the endpoints send, `validation` validates what they receive.
It covers every input boundary (TODO 11 is complete): `/auth` (`src/auth.ts`), group (`src/group.ts`
— `groupSchema` for the create/update body, `groupParamsSchema` for the `:groupId` param), expense
(`src/expense.ts` — `expenseSchema` for the body, plus `expenseGroupParamsSchema` and
`expenseParamsSchema` for the id params), payment (`src/payment.ts` — `paymentParamsSchema`, the
`:paymentId`, its only input since `pay` has no body), invite (`src/invite.ts` — `joinSchema` for
the join body, an either/or of `memberId` or a trimmed `name`; regenerate reuses `groupParamsSchema`)
and profile update (`src/user.ts` — `userUpdateSchema`, which is `registerSchema.omit({ password:
true })`: `updateUser` changes name and picture, and routes a differing email to Better Auth's
`changeEmail` confirmation flow, so it is register's rules minus the password, zero duplication). The 24-hex id validator (`objectId`) is shared from `src/common.ts`.
The `:inviteCode` routes carry no schema on purpose: an unknown code is a friendly 404 from the DB
lookup, not a 400, and it is not an ObjectId.

- **Rules *and* their copy live in the schema.** A field carries its own message
  (`.min(3, 'Name must be at least 3 characters long')`), because the point of the package is that
  backend and frontend stop duplicating the rule *and its text* — the password regex used to be
  copied in the auth controller and `registerForm.tsx`. The API error contract is unchanged: the
  `validate` middleware flattens Zod's issues to `{ error: "reason. reason" }` (join with `. `, in
  schema field order), which is what `frontend/src/utils/apiError.ts` and every consumer already
  read. No error message is a stable code — that was TODO 15, deferred until there is i18n.
- **Consumed at runtime, not type-only.** Unlike `shared` (erased `import type`), Zod executes, so
  the backend imports it with a normal `import`, `zod` is a real `dependency` in all three
  package.jsons (the package, backend, frontend), and the runtime Docker stage copies its `dist/`.
  Zod is **v4**. `decimal.js` is a `dependency` of the package too: `expenseSchema` validates the
  amount's ≤2-decimal shape through it (the app's money engine), so that rule and its text are
  shared instead of duplicated as a string regex in the form and a `Decimal` check in the
  controller. The frontend bundles it transitively (no manifest entry of its own); nothing in Docker
  or the Pages command changed, since both already install the package's deps.
- **The backend gate is `middlewares/validate.ts`.** `validate(schema)` runs in front of the route
  (after `multer` on register, so the multipart body is populated), 400s with the flattened message
  on failure, and on success **replaces `req.body` with the parsed value** — so the controller sees
  the trimmed/stripped shape. `validate(schema, 'params')` validates `req.params` instead (the
  `:groupId` ObjectId shape); params are only checked, not reassigned, since a valid id needs no
  transform and `req.params` also carries the route segments the schema does not describe. A route
  needing both chains the two (`validate(groupParamsSchema, 'params'), validate(groupSchema)`), the
  param one first so a bad id 400s before the body is read. The DB-existence checks stay in the
  controller below it. The member-id **regex** lives in the schema, not `mongoose.Types.ObjectId`:
  the package is bundled by the frontend, so a regex keeps the shape shared without pulling mongoose
  into the browser bundle.
- **The frontend consumes the same schema through `@hookform/resolvers`** (`zodResolver`). A form
  with a field the shared body does not describe extends the schema locally so the resolver keeps it
  (`registerForm` and the reset-password form add `confirmPassword` — extended then `.refine`d against
  the password field; `groupForm` adds `hasAccount` on each member) — without that the resolver strips
  the extra value. `confirmPassword` is client-only (Better Auth never receives it, so it is not in the
  shared contract) and the submit handler destructures it out before the mutation. `expenseForm` needs
  no extension (its fields are the schema), but its amount input is `type="text"` while `expenseSchema`
  wants a `number`, so it registers `totalAmount` with `valueAsNumber: true` and the form value is the
  number the API takes. `PASSWORD_HINT` (the helper text under the field) and `CONFIRM_PASSWORD_MISMATCH`
  (the refine's message) stay in `frontend/utils/validation.ts`: presentational copy, not rules.
- **Login validates the same shape as register** (email format + password strength), so a malformed
  login body 400s before the credential check; a *well-formed unknown* email still returns "Invalid
  credentials", so account enumeration stays shut.
- **Plumbing that has to move with a new workspace package**, and more than `shared` needed because
  this one is imported at *runtime*: two `COPY`s in each Dockerfile stage plus
  `--filter=@monorepo/validation` and an explicit `pnpm --filter=@monorepo/validation build` before
  the backend build; the Cloudflare Pages build command (in the dashboard, not the repo) has to
  **build `validation` before `vite build`** — the frontend resolves it at bundle time, and running
  Vite directly skips Turborepo's `^build`, so its `dist/` won't exist otherwise (see the exact
  command under *Deployment*); and the `typecheck.yaml` / `prod-deploy.yaml` path filters.
  `pnpm-workspace.yaml` needs nothing (it globs `packages/*`). `shared` never hit this because the
  frontend imports it type-only, so Vite never resolves its `dist/`.

### A group member is a name, not an account

`members: [{ name, user: ObjectId|null }]`, and **`members[]._id` is the identity** that `Expense.paidBy`, `Expense.participants[].member` and `Payment.from`/`to` point at. `user` is optional: a member who will never register still owns expenses, holds a balance and can be a creditor.

Joining a group is one field — `members[i].user = userId` — so nothing is ever merged or rewritten, and a member keeps their whole history. Only members with `user == null` can be claimed, or the first stranger with the link would take over the creator's member.

Consequences worth knowing before touching anything here:

- **`populate` cannot resolve a ref that points inside another document's subdocument array.** `balance[].member`, `debt.from` and `participants[].member` therefore have no `ref` at all; the join is done by hand with `hydrateMembers(group, target, paths)` in `utils/members.ts`, and `MEMBER_PATHS` is where an expense keeps its member ids. The only surviving `populate` is `members.user` (now to the read-only `UserView` model over Better Auth's `user` collection), always with the `MEMBER_FIELDS` projection (`'name image'`, email deliberately left out); the credential hash lives in Better Auth's separate `account` collection, not in `user`, and the serializer maps `image` to the contract's `profilePicture`.
- **Permission checks use `memberOf(group, userId)`**, which returns the member (not a boolean) because callers need its `_id`. It never matches a member without an account.
- `Group.inviteCode` is 16 random bytes, unique-indexed, generated in `pre('validate')`. It is the whole authentication of the join flow, so it is regenerable and never guessable. `GET /group/invite/:code` is public and answers only `{ name }`; the list of unclaimed members stays behind the token in `GET /group/join/:code`.
- The invite URL is built in the **frontend** from `window.location.origin`, not from `CLIENT_URL`.

Contract rules that came out of building this and that new code has to keep:

- **The name shown is always `member.name`, never `member.user.name`.** The name belongs to the group and any member can edit it; the linked account only supplies the avatar. Rendering the account's name would mean that editing your profile renames you for everyone, in every group you are in.
- **Removing a member who appears in an expense or in a settled payment is a 409** (`updateGroup`), account or no account. `updateBalance()` rebuilds from the *expenses*, not from the member list, so without that check you can drop someone and their debts stay alive. Member names are unique within a group, compared lowercased and trimmed.
- **`pay` has exactly one exception to "you must be the `from` or the `to`":** when neither side has a linked account, any member of the group can settle that debt. `generateDebts()` produces one as soon as two account-less members are involved and nobody would ever be able to clear it. It grants an attacker nothing new — `updateExpense` and `deleteExpense` already only check membership, the ledger is collective. Settling a payment that is not `pending` is a 409, because a double click sent two PATCHes and two notifications to the creditor.
- **`getUserGroups` filters by `members.user`, so someone who already has an account does not see the group until they open the invite link.** That is accepted friction, not a bug: it buys a single resolution path and removes the entire "that email does not exist" class of error.

Why the model looks like this, what was discarded (shadow users, a `GuestMember` collection, per-member email tokens) and why is in [docs/archive/miembros-invitados.md](docs/archive/miembros-invitados.md).

### The balance/debt engine lives in `services/ledger.ts`, off the document

`backend/src/services/ledger.ts` holds the core domain logic as two plain functions that take a hydrated group and were moved off the Mongoose document so the schema is only its persisted structure (which is what lets `InferSchemaType` describe it):

- `updateBalance(group)` — seeds every member at 0, replays every `Expense` in the group (credit the payer the full amount, debit each participant their `amountOwed`), then applies `Payment`s with `status: 'paid'`. Indexed by member `_id`, and it carries no `populate`: names take no part in the arithmetic. Result is persisted to `group.balance`.
- `generateDebts(group)` — deletes all `status: 'pending'` Payments for the group and greedily re-derives them by matching negative balances (debtors) against positive ones (creditors).

`ledger.ts` reaches `Expense` by name (`mongoose.model('Expense')`) to stay off the `expense.schema → ledger` import edge; `Payment` has no such edge and is imported directly.

**"Debts" are not a separate collection — a debt is a `Payment` with `status: 'pending'`.** Settling one flips it to `'paid'`, which changes the balance on the next recalculation.

`expense.schema.ts` registers `post('save' | 'findOneAndUpdate' | 'findOneAndDelete')` hooks that load the group and call both functions (throwing if the group no longer resolves, so the drift below fails loudly). Consequence: any expense mutation must go through document `save()` or those specific query helpers, or balances and debts will silently drift. Bulk operations (`updateMany`, `insertMany`) bypass the hooks.

### Money is `decimal.js`, never native floats

**Every monetary calculation goes through `decimal.js`** (a real `dependency` of the backend). No `+`/`-`/`/` on amounts, no `Math.round(x * 100) / 100`, no `toFixed(2)` to "round" — those are what let a group's balance stop netting to zero.

- Accumulate as `Decimal`, convert once at the boundary: MongoDB stores `Number`, so the last step is `.toDecimalPlaces(2).toNumber()`. `updateBalance()` and `generateDebts()` do exactly that.
- Splitting an expense floors each share (`ROUND_DOWN`) and hands the leftover cents out one each from the top of the participant list (`splitEvenly` in `services/split.ts`). Dividing evenly and rounding each share independently loses or invents cents: 10 € between 3 gave three shares of 3.33 against a 10 € credit, leaving the group permanently 1 cent out.
- Watch the predicates: `isPositive()` is **true for zero** and `isNegative()` is true for `-0`, so comparisons that must exclude zero use `.greaterThan(0)` / `.lessThan(0)`.

### Two Express app factories — pick the right one

- `src/index.ts` is the real server: mounts the router at **`/api`**, creates the HTTP server, attaches Socket.IO, connects the DB, listens.
- `src/bootstrap.ts` (`bootstrapApp()`) is the test-only app: mounts the same router at **`/`**, no socket, no DB connect.

So request paths in tests have no `/api` prefix, and `req.app.get('socketio')` is `undefined` under `bootstrapApp()` — notification calls in controllers will throw unless the socket is stubbed. Keep the two files in sync when adding global middleware.

### Real-time notifications

`socket.server.ts` puts each client into a room named `user:<userId>` when it emits `register`. The `io` instance is stashed with `app.set('socketio', io)` and controllers retrieve it via `req.app.get('socketio')`, then call `sendNotificationToUser(io, userId, type, message, data)` from `services/notifications.ts`, which emits a `notification` event to that room. Frontend side is `components/notifications/notifications.tsx` — a render-null component that opens the socket and pipes events into react-toastify.

Notifications only go to members with a linked `user` — `linkedUserIds()` in `utils/members.ts` filters them — since emitting to a member without an account means emitting into an empty room.

### Auth

Auth is **Better Auth** (`better-auth@1.6.29`): it owns registration, password hashing, the credential check, the `account`/`session` collections and **sessions**. The custom mechanism is gone — no `user.schema.ts`, no `security/jwt.ts`, no `/auth` controller/routes, no `generateJWT`/`comparePassword`, no `bcryptjs`/`jsonwebtoken`. `security/auth.ts` builds the instance with `mongodbAdapter` over `mongoose.connection.db`, so it is constructed **after** `connectDB()` resolves — the reason `index.ts`/`bootstrap.ts` are an async bootstrap. Its handler mounts at `/api/auth/*` with `toNodeHandler(auth)`, **before `express.json()`** (Better Auth reads the raw body), and the instance is stashed with `app.set('auth', auth)`. `mongodb` is pinned to `6.20.0` (`pnpm-workspace.yaml` overrides) so the adapter's bson matches mongoose's; see the full rationale in the `security/auth.ts` header.

**Sessions are an httpOnly cookie, not a Bearer token.** The cookie is `divvyup_session` (renamed off the generic `better-auth.session_token`), `Secure` + `SameSite=Lax`, and **host-only** (no `Domain`): the API both sets and reads it so it never needs sharing, and front (`divvyup.jorgeaf.dev`) and back (`divvyup-api.jorgeaf.dev`) are same-site under `jorgeaf.dev`, so Lax still sends it. `crossSubDomainCookies` is deliberately off — it would widen the cookie to the root `jorgeaf.dev`. This is the point of the migration: the token no longer sits in `localStorage` where any page JS could read it.

`jwtMiddleware` is now **`security/requireSession.ts`**: it calls `auth.api.getSession({ headers })` and, on a valid session, sets **`req.user = { id, name, email }`** (the shape controllers read; the old `req.jwtPayload` is gone), else 401. It has a try/catch so a throw reaches the shared `errorHandler` (`middlewares/errorHandler.ts`, mounted in both app factories) instead of escaping as an unhandled rejection that would exit the process. Nearly every route carries it; `/api/auth/*` does not.

Register and login still validate their body with the **same** Zod schemas from `@monorepo/validation` (`registerSchema`, `loginSchema`), reused in a Better Auth **`before` hook** (`hooks.before` in `security/auth.ts`) rather than the `validate` middleware, so the strength rule and its copy stay in one place and Better Auth stays the server authority. The hook throws an `APIError` with the same flattened message, so the auth endpoints answer `{ message }` (Better Auth's shape; the frontend reads it off the client's thrown error). **Login reuses register's rules**; a well-formed unknown email returns the same `Invalid email or password` as a wrong password, so account enumeration stays shut (`auth.test.ts` pins that parity, and that no response ever echoes the password).

**Google is the second login method** (`socialProviders.google` in `security/auth.ts`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). Better Auth mounts the OAuth dance itself — `/api/auth/callback/google` needs no route of ours, only that redirect URI registered on the Google client (local `:3001` + prod). The frontend button is `components/auth/googleButton.tsx`, rendered through `components/auth/socialAuth.tsx` (the providers + an "or" divider) at the **top** of both the login and register forms, above the email/password fields — the social path is the fast one, so it leads, and `socialAuth` is the one place a second provider (GitHub is planned) drops in. The button calls `authClient.signIn.social({ provider: 'google', callbackURL, errorCallbackURL })`, a **full-page redirect**, so unlike the email flow there is no `waitForSession`/`navigate` — the app remounts on the callback with the session already set, and only a failure to even start the redirect is handled locally. **Account linking is on for Google only** (`account.accountLinking.trustedProviders: ['google']`): a Google sign-in whose email matches an existing password account links onto that user instead of colliding on the unique email, because Google verifies the email so it is the same person — never linked on an unverified provider. Google's avatar lands in `user.image` (the same field a Cloudinary upload writes, mapped to the contract's `profilePicture`); `updateUserInfoOnLink` stays at its default `false`, so linking Google never overwrites a picture or name the user already set.

Identity: `Group.members[].user` is still an `ObjectId` `ref`, now to a read-only **`UserView` model** (`schemas/userView.ts`, `{ collection: 'user' }`) over Better Auth's `user` collection, so `.populate('members.user', 'name image')` keeps working untouched. `generateId: false` in the config keeps `_id` an `ObjectId`, which is why the ref resolves; the hash lives in Better Auth's separate `account` collection, never in `user`. `PATCH /user/update` writes name and picture through `auth.api.updateUser({ body: { name, image }, headers })` (multer → Cloudinary → the `image` field); a **differing email** is routed to `auth.api.changeEmail` instead. For a verified account that is Better Auth's **two-step** flow: a confirmation goes to the **current** address (proving a hijacked session cannot move the account), clicking it emails the **new** address the link that actually applies the change, and only that second click switches it — so the response still carries the old email, and the profile form shows a "check your inbox" toast (the controller branches on `req.body.email !== req.user.email`). The change flow's `callbackURL` is `/email-change` (a "check your new inbox" landing), distinct from sign-up verification's `/email-verified`, since Better Auth reuses the same `callbackURL` for both steps. Both steps therefore land on `/email-change`; to still show success only at the end, the requesting tab stashes the target email (`utils/pendingEmailChange.ts`, localStorage — non-sensitive, and the link opens in a separate tab) and `/email-change` redirects to `/email-verified` once the session email matches it (which only happens after the second click applies the change). A **Google-only account** (no `credential` provider in `auth.api.listUserAccounts`) **cannot** change its email — it is the provider identity and they sign in through Google regardless — so the controller 400s; the profile form reads the same signal through `useHasPassword` (`authClient.listAccounts`) and renders the field read-only with a "Managed by your Google login" note.

**Email verification is on but soft** (`emailVerification` in `security/auth.ts`): `sendOnSignUp: true` mails a link through `services/email` (Resend) — its first caller — and `autoSignInAfterVerification` signs the user in after they click. It does **not** gate login: `requireEmailVerification` stays off, deferred to a later child PR. The verification link redirects to the frontend `/email-verified` landing (a public route; the register `signUp.email` call passes it as an absolute `callbackURL`); the email-change flow uses `/email-change` instead. The mail copy lives in `services/authEmails.ts` (`sendVerificationEmail`, `sendChangeEmailConfirmation`, `sendResetPasswordEmail`, `sendPasswordlessAccountEmail`), which `auth.ts` wires in by reference as shorthand — the config file stays composition, the templates get one home; all compose plain-text + an HTML layout through `services/email`. The first two are named to match their callback keys; `sendResetPasswordEmail` goes to `emailAndPassword.sendResetPassword` and takes only `{ user, url }` (Better Auth also passes `token`, but the reset `url` already carries it, so it is ignored). `sendPasswordlessAccountEmail` is the reset callback's other branch (see *Password reset*): the note sent to a password-less account instead of a reset link, taking `{ user, provider }` and mapping the provider id to a display name (`google` → `Google`). `sendVerificationEmail` serves both sign-up **and** the email-change second step (Better Auth reuses it and gives no way to tell them apart), so its copy is address-neutral, not a sign-up welcome. Prod needs `RESEND_FROM` on a **verified** Resend domain — `onboarding@resend.dev` (sandbox) only delivers to the account owner, so real users would silently get nothing.

**Password reset** (`emailAndPassword.sendResetPassword` + `resetPasswordSchema` from `@monorepo/validation`): the request step (`authClient.requestPasswordReset` — Better Auth renamed the client's `forgetPassword`; the frontend form validates `forgetPasswordSchema`) mails a link through `sendResetPasswordEmail`, redirecting to the frontend **`/reset-password`** landing with the token in the query. The request is answered the **same whether or not the email has an account** (the UI shows a neutral "if that address has an account…" on `/forgot-password`), so account enumeration stays shut. **A social-only (e.g. Google) account gets a guidance mail, not a reset link**: Better Auth would otherwise send the link and let `resetPassword` **create** a `credential` from it (a silent add-a-password), so `sendResetPassword` is wrapped to branch on the account's providers (`accountProvidersOf`, a direct read of the `account` collection since no mongoose model owns it) — a `credential` provider gets the reset link (`sendResetPasswordEmail`), a social-only one gets `sendPasswordlessAccountEmail` ("you sign in with Google, use that button"), and a user with no accounts at all gets neither. The **HTTP response stays the neutral one either way**, so the branch leaks nothing on the wire; the provider name the neutral response hides is delivered only to the **real inbox owner**, which an attacker probing the form never holds — that private channel is the whole point, and why the branch lives in the send callback rather than as a differentiated endpoint response. The set-new-password step (`authClient.resetPassword({ newPassword, token })`) runs the **same strength rule server-side**: the Better Auth `before` hook enforces `resetPasswordSchema` on the `/reset-password` path (its body key is `newPassword`, not `password`), mirroring sign-up/sign-in; `/forget-password` carries no hook (its neutral response leaks nothing). `revokeSessionsOnPasswordReset: true` kills every other live session on reset (a reset usually follows a compromise). `resetPassword` does **not** sign the user in, so success toasts and navigates to `/login`. Both `/forgot-password` and `/reset-password` are **public routes** (like `/email-verified` / `/email-change`); a missing/expired token on `/reset-password` renders an error state linking back to `/forgot-password`.

Frontend reads the session from `authClient.useSession()` (`utils/authClient.ts`, `better-auth/react`, baseURL `${VITE_API_URL}/auth`) behind a thin `useAuth()` (`context/userContextAuth.tsx`) exposing `{ user, isPending, signOut }` — no token, no `localStorage`, the cookie travels on its own. Login/register/logout are react-query mutations over the client in `hooks/useSession.ts`, which waits for the session store to actually hold a user before resolving so a post-login `navigate()` does not race the store and bounce to `/login`. The password-reset mutations (`useForgetPassword`, `useResetPassword`) live there too but are **plain** mutations — neither changes the session on this client, so they skip that wait and the cache clear. `App.tsx` gates routes through `RequireAuth`, which waits on `isPending` before deciding.

### Frontend data layer

`utils/axios.ts` creates a single axios instance from `VITE_API_URL` with `withCredentials: true`, so the session cookie rides on every call — there is no auth header and no `authHeaders(token)` any more. Endpoints are grouped per resource in `utils/{group,expense,payment,user}Api.ts`, and those modules are the only ones that import the axios instance; auth itself does not go through axios but through `authClient` (`utils/authApi.ts` is gone).

**Every request in the app goes through `@tanstack/react-query` v5, and always through a hook in `src/hooks/`.** No component imports `utils/*Api.ts` or axios directly, and no `useQuery`/`useMutation` is written inline in a component. Object syntax only (`useQuery({ queryKey, queryFn })`, `useMutation({ mutationFn })`, `invalidateQueries({ queryKey })`); the old `react-query` package and its positional API are gone. The `QueryClientProvider` is in `App.tsx`.

The layout, one file per resource: `useGroups`, `useGroupDetails`, `useExpenses`, `usePayments`, `useInvite`, `useSession` (login/register) and `useProfile`. Rules that came out of building it:

- **Queries gate on the session, not a token.** The cookie is sent automatically, so hooks no longer thread a token; queries that must wait for auth are `enabled: Boolean(user)` (from `useAuth()`) so they do not fire before the session resolves.
- **Every cache key lives in `hooks/queryKeys.ts`.** A query and the mutations that invalidate it have to spell the same array, and that only holds if there is one place to read it from.
- **The mutation hook owns the invalidation, the component owns the UI.** Toasts, `navigate` and closing modals go in the per-call `mutate(vars, { onSuccess, onError })`, which runs after the hook's own `onSuccess`. Do not pass UI into the hook.
- Cache invalidation *is* the refresh mechanism: an expense mutation drops `groupDetails(groupId)` and `myExpenses`, joining a group drops `groups`. That is why no component takes a `refreshGroupDetails` or `setGroups` prop any more — the server state has one owner.
- `useSettleDebt` invalidates on `onSettled`, not `onSuccess`: settling a debt somebody else already settled is a 409, and that is exactly the case where the screen is stale and has to refetch.
- Login and register `queryClient.clear()` on success, so the next screen never mounts against the previous user's cache; Better Auth owns the session store itself, so there is nothing else to persist.

Every avatar in the app goes through `components/avatar/memberAvatar.tsx`: outlined, monochrome, initials from `initialsOf()` when there is no picture. It is one component on purpose. The four copies it replaced had drifted into two different colour schemes, and one of them rendered white on a white header.

All four dropdowns go through `components/menu/appMenu.tsx` — the header's, `UserMenu`'s, `groupActions`' and `expenseActions`'. It carries no `sx`: with `background.paper` and `action.hover` correct in the palette, MUI's `Paper` and `MenuItem` defaults already paint the surface. It stays a component so that reaching for the bare `Menu` is a visible choice, and so menu styling has one place to land.

Menu entries are `MenuItem` with the content directly inside. Do not wrap it in a `Button`: a `<button>` inside `role="menuitem"` is invalid ARIA, and MUI's `Button` defaults to `color="primary"`, whose hover tints the row blue on top of the item's own hover. A menu action that lives in its own component renders the `MenuItem` itself rather than nesting a control inside one — `logout.tsx` returns a `MenuItem` (the callers drop the wrapping `MenuItem`), and `themeToggle.tsx`'s `ThemeMenuItem` is the same shape.

**Every button in the app goes through `components/button/button.tsx`**, and every button-styled link through `components/button/buttonLink.tsx` — the native `<button>`-plus-CSS-Module forms and the `@mui/material/Button`-with-copied-`sx` actions are both gone, along with the three unrelated blues, none of which passed AA. `Button` is an own `<button>` (not a MUI wrapper) with `variant` (`primary` filled, `secondary` outlined-neutral, `ghost` text-link), `size` (`sm`/`md`/`lg`, padding-driven — no fixed height), a `loading` spinner (the label stays in the a11y tree, so the accessible name survives), a `:focus-visible` ring, and it forwards `id`/`type`/`disabled`/`onClick` so Cypress selectors and `type="submit"` keep working. It is presentational: a form's mutation `isPending` is threaded down as `loading` from wherever the hook lives (the Button never reads react-query). `ButtonLink` renders a router `Link` with the same classes, for navigation CTAs that must stay `<a>` (right-click, open-in-new-tab, keyboard) — a `<button>` that navigates is the wrong element. **`--primary-color-strong` (`#0b6ecf`, 5.07:1) is the filled-button blue**: it clears WCAG AA with white text, which none of the brand blues do, and it is a *separate* token so adding it never repainted the header/titles/icons that read `--primary-color`. `secondary`/`ghost` use the neutral `--color` rather than a blue, because no single blue passes AA as *text* on both the light and dark surfaces. Icon-only triggers stay `IconButton` with an `aria-label` (the `dots` menus, the header icons, the two create `+` FABs — see the `Icon`/`Fab` note next), not `Button`.

**`Icon` (`components/icon/`) is a presentational wrapper over react-icons**: it takes the glyph as a prop (`icon: IconType`) plus an optional `size` (default 18) and applies the shared base class (cursor + hover transition only — no hardcoded `width`/`height`, so `size` sets the box). It holds **no registry** of icons; each call site imports its own glyph, so a dropped import is a compile error rather than a silent fallback to the add icon. It carries no `onClick`: an icon-only trigger wraps it in an `IconButton` with an `aria-label` (the `dots` menus, the mobile hamburger, the theme toggle), or, for the two create `+` actions, in **`Fab` (`components/fab/`)** — a fixed-position `IconButton`. The `data-type`/`id` it forwards are the Cypress hooks (`[data-type="add"]` on the FAB button, `[data-type="dots"]`, `#deleteGroup`, `#create-group-btn`).

**`CloseButton` (`components/closeButton/`) is the dialog dismiss X**, shared by the three forms (`groupForm`, `expenseForm`, `userEditForm`): a zero-config `IconButton` (`aria-label="Close"`, `type="button"`, an `IoCloseOutline` at `size={25}`). Those X's were bare `<svg onClick>` — not focusable, not keyboard-operable, unnamed — copied three times. Two things it fixes are easy to get wrong: `type="button"` is required (an untyped `<button>` inside a `<form>` submits it), and the color rides on `sx`, not a CSS-module class, because `IconButton`'s own default color would win by style-injection order. The **remove-member X** in `groupForm` stays an inline `IconButton`, not `CloseButton`: it is a destructive per-row action (red, dynamic `aria-label`) and carries the `#remove-member-N` id Cypress selects.

The header is **one file per variant** — `guestHeader`, `desktopHeader`, `mobileHeader`, with `header.tsx` doing nothing but picking one and exporting `MOBILE_QUERY` (768px, read with `useMediaQuery`; the CSS module deliberately has no media query, so the breakpoint is written once). The split is what keeps the collapsed menu's `anchorEl` inside `mobileHeader`: crossing the breakpoint unmounts the component, so no effect has to reset that state. Every clickable icon in the header is an `IconButton` with an `aria-label`: `Icon` renders an `<svg>` and takes no `onClick`, so a bare icon is neither focusable nor named and cannot be a trigger on its own.

Two rules about the collapsed menu, both of them decisions rather than details, and `header.test.tsx` asserts the whole list in order rather than that the items exist:

- **The order is `Groups`, `Expenses` | `Profile`, `Dark mode` | `Logout`, and `Logout` goes last behind its own divider.** It is the only destructive action in the menu and it reloads the page, so on a 390px touch target the one thing next to it is a divider.
- **The theme toggle is the only entry that does not close the menu.** The other four navigate or end the session; this one is a switch, and its label flipping between `Dark mode` and `Light mode` is the confirmation that it worked. Closing threw that away and made undoing it cost two taps. It is also text-only in the menu — an icon there pushed its label out of line with the other five.

### The landing is its own route, outside `Layout`

`/` renders `pages/landing/landing.tsx`; every app screen sits under a **pathless**
`<Route element={<Layout />}>`, so the absolute child paths and the `*` -> `NoMatch`
fallback are unchanged. The landing is out of `Layout` because `layout.module.css`
caps `main` at `width: min(90%, 120rem)`, and a boxed main cannot do edge-to-edge
hero bands without `100vw` hacks.

**It is public.** A visitor with a session reads the same page; there is no redirect
to `/groups`. It renders `Header`, not `GuestHeader`, so a signed-in reader gets the
app nav and the header is what tells them they are signed in — which is why the hero
CTAs stay "Get started" / "Log in" for everyone. The page returns `null` while
`isPending`, because `Header` renders nothing until the session resolves and painting
first would drop the hero in and shove it down a moment later.

The page file composes and holds no stylesheet of its own. `components/landing/`
carries the parts:

- **`LandingShell`** imports the two Instrument Serif faces and paints the wash
  behind header and hero. The wash is a `::before` at `z-index: -1`, which needs the
  shell to be a stacking context; it is not `position: relative`, so the wash
  resolves against the initial containing block and only lands correctly because the
  shell is first in the document.
- **`LandingSection`** is the full-bleed band every section composes: the `<section>`
  spans the viewport, an inner container caps content at the app's measure. Sections
  never take a `variant` prop.
- **`LandingFeatures` / `LandingFeature`.** The row never knows which side it falls
  on: the left/right alternation is an `nth-child` rule in the band's stylesheet, and
  the `01/02/03` numerals are a CSS `counter`, so adding a row cannot leave the
  sequence lying.
- **`vignettes/`** are faux app UI built from the real `Button`, `MemberAvatar` and
  `Icon` with static data, not screenshots, so they theme with the app and cannot go
  stale. Each is `aria-hidden` (the row's heading and copy already say it) and any
  focusable child inside carries `tabIndex={-1}`.

`--font-display` and `--muted` in `App.css` are used only here. The brand blues are
**not** used as landing text: `--primary-color` is 2.97:1 and `--primary-color-dark`
3.32:1 against the light page, so emphasis is carried by weight and the blue is
reserved for the filled buttons, where `--primary-color-strong` does clear AA.

What the page was scoped to do, which of those decisions were reversed while
building it and why is in
[docs/archive/task-3-landing-page.md](docs/archive/task-3-landing-page.md).

Styling is CSS Modules (`foo.module.css` beside `foo.tsx`) plus MUI. `context/darkModeContext.tsx` still exists, but recent commits deliberately removed per-component `useDarkMode` usage in favor of the MUI theme (`useTheme`) — follow that direction in new components. The exception is `header/themeToggle.tsx`, which needs `toggleDarkMode` itself: it is the switch.

**Every colour is declared in `App.css`, and nowhere else.** `theme/appTheme.ts` holds no colour value: `createAppTheme(darkMode)` reads them out of the stylesheet and hands them to `createTheme`. MUI consumes the palette, it does not own it.

**Text colour is inherited from `body`, not restated per component.** `index.css` sets `body { color: var(--color) }` and everything takes it from there, so a component only declares `color` when it wants a *different* one. The exception is the elements that do not inherit it: `<input>`, `<select>`, `<button>` and `<a>` get their colour from the UA, so `formField`, `groupForm`, `expenseForm`, `join`, `userEditForm`'s file input, `googleButton`, the header's `navItem` and `Button`'s `secondary`/`ghost` still set it by hand. Dropping one of those repaints the control black in dark mode; dropping it anywhere else changes nothing.

`:root` carries the light values and `body.dark` restates only the five that differ; the primaries are shared. The names are the ones the CSS Modules already consume: `--color`, `--bg-color`, `--secondary-bg-color`, `--border-color`, `--placeholder-color`, `--primary-color`, `--primary-color-dark`, and `--primary-color-strong` / `--primary-color-strong-hover` (the AA filled-button blue, `:root`-only because a fill is its own background and reads the same in both themes — see the Button section). A new colour goes in `:root`, plus `body.dark` if dark needs a different one.

`:root` also carries the non-colour design tokens: `--transition-base` / `--theme-transition`, and the font stacks below.

**The typefaces are self-hosted through Fontsource, not a `<link>` in `index.html`.** `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` are imported in `App.tsx` beside `App.css` (latin subsets, weights 400 and 700 only), so the faces ship with the bundle and there is no third-party request. The stacks are `--font-body` (IBM Plex Sans, on `body`) and `--font-mono` (IBM Plex Mono). The mono is **for money**: `balance`, `debt` and `expense` render amounts with it plus `font-variant-numeric: tabular-nums`, so a figure holds its width when the value changes. Fallbacks are the metric neighbours, so a face that has not loaded does not reflow the page.

**`appTheme.ts` sets `typography.fontFamily` to `var(--font-body)`.** Without it MUI's own default (Roboto, Helvetica, Arial) wins on every `Avatar`, `MenuItem` and `Tooltip`, which is the one place the CSS cascade cannot reach. A `var()` is correct there and wrong in the `palette`, for the reason in the next list: typography is copied into CSS, palette values are parsed in JS.

Four rules hold that together:

- **The `palette` takes resolved colours, never a `var()` string.** MUI derives `light`/`dark`/`contrastText` from `main` and decomposes colours into the `R G B` channels its hover styles compose into `rgba(R G B / opacity)`, so it needs values it can parse. It also emits `--mui-palette-*` on `:root`, where `body.dark` does not apply, so a `var()` there resolves to the light value in dark mode.
- **`components.*.styleOverrides` is CSS**, copied out verbatim for the browser to resolve, so a `var()` belongs there — that is why `THEME_TRANSITION` is the literal `'var(--theme-transition)'`. The split is who reads the value: the browser resolves a `var()`, JavaScript arithmetic cannot.
- **Read the rules, not `getComputedStyle`.** The theme is built during render and the `dark` class lands in an effect, so the computed value of a colour is still the light one while the dark theme is being built. `declarationsFor()` walks `document.styleSheets` for the `:root` and `body.dark` rules and resolves them the way the cascade does.
- **A missing declaration throws**, naming the variable. A fallback would put a colour back into JS.

Two of the values are load-bearing and not free to change:

- **The light surface is `#f0f0f0`, darker than the `#f8f7f7` page.** A lighter surface leaves forms and modals with no relief against the background at all.
- **`action.hover` carries no override.** MUI's default is alpha, so it composes over whatever surface is beneath it and by construction cannot equal it. A solid value can: the previous one was `#f0f0f0`, the same value the form surface uses, which would have made the menu hover invisible.

Transitions come off one knob, `--transition-base`. Set it only on the element that declares the colour: a child that re-transitions an inherited value chases its parent's animation and looks slower. `MuiMenuItem` therefore transitions `background-color` alone — it is transparent at rest and inherits its colour from the paper.

`vitest.config.js` aliases stylesheet imports to `identity-obj-proxy`, so `vitest.setup.js` injects the real `App.css` into jsdom; without it there is no palette to read and no theme can be built.
- **`getComputedStyle` is the wrong way to read them.** The theme is built during render and the `dark` class is added in an effect, so in dark mode the computed value of `--color` is still the light one at the moment MUI needs the dark one. `declarationsFor()` walks `document.styleSheets` for the `:root` and `body.dark` rules instead, and resolves a colour the way the cascade does — `body.dark` first, `:root` behind it. The rules are there regardless of which class is applied, so the ordering problem disappears rather than being worked around. Verified against the minified build: esbuild keeps both selectors intact.
- **A missing declaration must be loud.** `createAppTheme` throws naming the variable rather than falling back to a default, because a default would quietly put a colour back into JS. `darkModeContext.test.tsx` pins that, and asserts each MUI variable against the CSS one it came from without restating a single hex.

`vitest.config.js` aliases stylesheet imports to `identity-obj-proxy`, so `App.css` is absent from jsdom and the theme could not be built at all. `vitest.setup.js` injects the real file into `document.head` — the real one, not a copy of its values, or the tests would become the third place the palette lives.

### Backend request flow

`routers/router.ts` mounts `/group` three times (expense, invite and group routes all live under it), plus `/user`, `/payment`. Auth has no router here: the Better Auth handler is mounted at `/api/auth/*` in `index.ts`/`bootstrap.ts`, before `express.json()`. The invite/join flow is its own `invite.controller.ts` / `invite.routes.ts` (`getInviteName`, `getGroupByInviteCode`, `joinGroup`, `regenerateInviteCode`), split out from group management; `invite.routes` is mounted **before** `group.routes` so `/invite/:code` and `/join/:code` resolve as literals rather than as a `/:groupId` match. Input-shape validation lives in Zod schemas in `@monorepo/validation` applied by `middlewares/validate.ts`, across **`/group`, `/expense`, `/payment`, the invite/join body + params and `/user/update`** — every endpoint that takes a body goes through Zod (TODO 11 complete). The auth endpoints (`/api/auth/sign-up|sign-in`, and `/reset-password` for the new-password strength rule) validate their schemas through Better Auth's `before` hook instead of this middleware. `/user/update` runs `validate(userUpdateSchema)` after `multer`, like register, so the multipart body is populated first. The DB-existence and business checks stay in the controller by design: group exists, member belongs, duplicate names, the 409 on removing a member who is in an expense, that `paidBy` and every participant name a member of the group (`checkMembership`), and payment's own rules (the payment exists, is still `pending`, and the caller may settle it). The name helpers in `utils/validation.ts` survive the Zod move because they are DB/business, not shape: `hasDuplicateNames` (group and invite controllers) compares against the stored members, and `cleanName` normalizes the creator's DB name in `createGroup` — the join body's name is now trimmed by `joinSchema`, so the invite controller no longer calls `cleanName`.

Profile images: multer with `memoryStorage()` → `config/cloudinary.config.ts` → `uploadToCloudinary(buffer)` returns the secure URL stored on `user.profilePicture`. It is optional everywhere — registration works without one and `updateUser` only touches the field when a file arrives. With no picture the UI falls back to the name's initials (`initialsOf()`), which is also what a member without an account gets.

An empty result is a `200 []`, not a 404: that goes for `getUserGroups`, `getExpensesByUserId` and `getExpensesByGroupId`.

### Comments explain why, not what

A comment earns its place only when the code cannot say the thing itself: the *why* behind a non-obvious choice, a past bug the shape is guarding against, a contract that is not visible locally. A comment that restates what the next line already says (`// Update a user` over `updateUser`, `// authenticated user id` over `req.user`) is noise — delete it, don't write it. The rationale that does matter lives better in the commit message than in the code. The `why` comments already in the controllers (the picture-wipe bug, the single login error message, the public invite handler) are the model: none of them describe *what* the line does.

## Testing notes

- Backend tests run on **vitest** (`vitest run --coverage`), configured in `backend/vitest.config.js`. vitest defaults `NODE_ENV` to `test`, which is what `connectDB()` in `mongo/connection/index.ts` checks to swap to an in-memory `mongodb-memory-server` URI — so no `cross-env` is needed. `fileParallelism: false` is set because the files share one DB per run: each test file spins its own memory server and connects the module-global mongoose, so running them serially keeps two files from racing on that connection (this is the vitest analog of jest's old `--runInBand`). `globals: true` is set so the tests' bare `describe`/`it`/`expect` need no imports. The `mongodb-memory-server` import is deliberately **lazy** — `await import(...)` inside the `NODE_ENV === 'test'` branch: it is a devDependency and absent from the production image, so a top-level import crashes the container at boot.
- **`.github/workflows/typecheck.yaml` runs `tsc --noEmit` on every PR** that touches `backend/**` or the root/base manifests — the repo's first PR gate (before this, nothing ran in PR CI; the deploy workflow only fires on push to `main`). It exists because vitest and `tsx` strip types without checking them, so green tests are not a type check.
- Any backend test hitting a route needs a **session cookie**, not a Bearer header — almost every route carries `requireSession`. `tests/helpers/session.ts` does `POST /api/auth/sign-up/email` (or sign-in) through supertest and returns `{ id, cookie }`; the `post`/`put`/`get` helpers set `Cookie`, so tests exercise the real session path. `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`CLIENT_URL` are set once in `backend/vitest.setup.js` (`setupFiles`); Better Auth reads them at call time, so they only have to exist before the first request — no import-order dance.
- `pnpm test` in `frontend/` is **green**: 5 suites, 45 tests — `components/icon`, `components/button` (`button` and `buttonLink`), `components/header` and `context/darkModeContext`, run by **vitest** (`vitest run`) in jsdom, configured in `frontend/vitest.config.js`. `--passWithNoTests` is deliberately absent: with it, a suite that stops being discovered by accident looks the same as a suite that passes (vitest, like jest before it, otherwise fails on no tests). Nothing runs these in CI — the deploy workflow is path-filtered to `backend/**` and Cloudflare Pages only runs `vite build` — so a frontend test guards intent, not the pipeline.
- `icon.test.tsx` pins the wrapper contract: `Icon` renders the glyph it is handed, merges an extra `className` over the base class, honors `size` (default 18), and forwards `id`/`data-type`. It no longer guards a silent fallback — `Icon` takes the glyph as a prop, so a dropped or broken import is a compile error, not the old registry's silent degrade-to-`add`.
- jsdom needs two shims for the frontend suites. `vitest.setup.js` defines `TextEncoder`/`TextDecoder` from `node:util`: `react-router` 7 reads them at import time, so **any** test that renders a router fails to even load the suite without them. And a test that renders `Header` has to stub `window.matchMedia` itself — MUI's `useMediaQuery` is what decides whether the header is collapsed, and jsdom ships no `matchMedia` at all.
- The Storybook stories run as tests in chromium (Playwright) via `vitest.storybook.config.js` (`pnpm test:storybook`), separate from the jsdom unit config (`vitest.config.js`). Two independent frontend test configs coexist, and `pnpm test` loads only the unit one, so it needs no browser and never pulls in the Storybook addon.
- **Cypress is the only real net the frontend has** — 7 specs, 13 tests, all green, and nothing else runs against the built app. Between them they cover login and a failed login, the profile form, creating/editing/deleting a group, the 409 when dropping a member who is in an expense, resetting and sharing the invite link, the whole life of an expense with its balance and debts, `/my-expenses`, and both halves of the join flow. Run it against a running app; it writes to whatever `MONGO_URL` points at, so check that it says `/test`.
- Specs seed through the API and let the session cookie land in Cypress's cookie jar (shared with the app under test), never through the UI or `localStorage`: helpers are in `cypress/support/api.js` (`registerUser`/`loginAs`/`createGroup`), which set the `Origin` header Better Auth's CSRF check needs when a cookie is present. **Anything derived from a seeded value has to hang off a `cy.then()`** — interpolating an id straight into `cy.visit()` reads it at queue time, before the request that fills it has answered, and you get `/groups/undefined/expenses`.
- **Cypress writes to the real database, not to `mongodb-memory-server`.** The in-memory swap only happens under `NODE_ENV === 'test'`, which only the backend's own `pnpm test` sets; the dev server runs plain `tsx watch src/index.ts`, so a spec run registers ~10 real accounts in `/test` and nothing cleans them up. `pnpm --filter @monorepo/backend clean:e2e` counts them (dry run; `--yes` deletes) and cascades to their groups, expenses and payments. It matches only `<letters><timestamp>@test.com`, which is the shape the specs build with `Date.now()`, and it refuses to run against any database that is not `test`.

## Deployment

Push to `main` triggers `.github/workflows/prod-deploy.yaml`: builds `backend/Dockerfile`, pushes `ghcr.io/divvyup-app/splitwise:latest`, then triggers a redeploy on **Coolify** with `POST /api/v1/deploy` (`{ uuid, force }` as a JSON body — Coolify v4.2.0 made state-changing endpoints reject GET with a 405, so the old `GET /api/v1/deploy?uuid=...` broke when the VPS auto-updated and the job started failing on the trigger step alone, image already built) and **polls** `GET /api/v1/deployments/{uuid}` until `finished`/`failed`, so a broken image fails the job instead of going green on acceptance. The poll is read-only and stays GET. Path-filtered to `backend/**` plus the root manifests and lockfile, so docs-only merges no longer cycle production.

**The Docker build context is the repo root, not `backend/`** (`docker build . --file backend/Dockerfile`). pnpm needs `pnpm-lock.yaml` and `pnpm-workspace.yaml` to install deterministically, and both live at the root. **The Dockerfile is multi-stage**: a `build` stage installs *with* devDependencies (it needs `typescript`), copies `tsconfig.base.json` + the two backend tsconfigs + `src`, and runs `pnpm build` (`tsc` → `dist/`); the `runtime` stage installs `--prod --filter=@monorepo/backend...` and copies only `dist/` from the build stage, then runs `node dist/index.js`. So the final image carries no TypeScript toolchain, and anything the backend requires **at runtime** must be a real `dependency` — a devDependency imported at module top level will crash the container. The build stage compiles `src` minus `src/tests`, so a type error in shipped code fails the image build; a type error in a test is caught only by the `Typecheck` PR gate (`tsconfig.json` includes tests, the build config does not).

The backend runs at `https://divvyup-api.jorgeaf.dev` on a self-hosted **Coolify** (OVH VPS-1 2027), which handles TLS (Traefik + Let's Encrypt) and the reverse proxy — a custom domain is free and automatic there, which is what took DivvyUp off Koyeb (custom domain was paid). Migrated off Koyeb on 2026-08-11; Koyeb is decommissioned. Coolify only pulls and runs the GHCR image, so no build happens on the VPS. **Two tokens, don't confuse them:** `coolify-ghcr-pull` is a GitHub PAT (`read:packages`) living on the VPS via `docker login` (`/root/.docker/config.json`) that lets Coolify pull the private image; `COOLIFY_TOKEN` is a Coolify API token, a repo secret, used by the workflow to trigger the deploy. The panel is at `coolify.jorgeaf.dev` (2FA); direct `IP:8000` access is blocked by hand because **Docker bypasses `ufw`** — iptables raw `PREROUTING` on 8000/8080/6001/6002 plus a `block-coolify-ports` systemd oneshot to survive reboot. Backend env vars: `MONGO_URL` (with `/prod` in the path, **not** empty or MongoDB reads `test`), `BETTER_AUTH_SECRET` (a fresh secret, not the local one), `BETTER_AUTH_URL` (`https://divvyup-api.jorgeaf.dev`), `CLIENT_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (the same Google client also lists `https://divvyup-api.jorgeaf.dev/api/auth/callback/google` as an authorized redirect URI), the three Cloudinary keys, `RESEND_API_KEY`, `RESEND_FROM`.

Frontend deploys on **Cloudflare Pages** (project `divvyup`, live at `https://divvyup.jorgeaf.dev`), connected to the GitHub repo — no workflow file, the config lives in the Pages dashboard:

- Root directory is the **repo root**, not `frontend/`: Pages picks the package manager from the lockfile it finds there, and `pnpm-lock.yaml` + `pnpm-workspace.yaml` are at the root (same reason as the Docker build context).
- Build command `pnpm install --frozen-lockfile --filter @monorepo/frontend... && pnpm --filter @monorepo/validation build && pnpm --filter @monorepo/frontend build`, output `frontend/dist`. Each part is load-bearing: `--filter @monorepo/frontend...` (the `...`) installs the frontend plus its workspace deps, so `@monorepo/validation` and its `zod` are linked and the frontend's own `typescript` devDep is present (that is the `tsc` the next step runs with). Then `pnpm --filter @monorepo/validation build` compiles `validation` to `dist/` **before** `vite build`, because the frontend imports it at runtime (`import { registerSchema }`) and Vite resolves `@monorepo/validation/dist` at bundle time; running `pnpm --filter frontend build` invokes Vite directly, so Turborepo's `^build` never fires to build it first — the frontend build fails with *Failed to resolve entry for package "@monorepo/validation"* if this step is missing. `@monorepo/shared` needs no build here: the frontend imports it type-only, so it erases and Vite never resolves it.
- Build env vars: `VITE_API_URL`, `VITE_SOCKET_URL` (Vite inlines them at build time, so they must be build vars), `NODE_VERSION` (mandatory — `packageManager: pnpm@11.0.0` needs Node >= 22.13, newer than the default image), `SKIP_DEPENDENCY_INSTALL=1` (the filtered install is done by the build command; without this Pages also runs an unfiltered `pnpm install` that pulls the backend's 122 MB `mongodb-memory-server` binary) and `CYPRESS_INSTALL_BINARY=0`.
- Pages serves `index.html` for unmatched routes on its own, so the SPA needs no `_redirects` file.
- The custom domain is `divvyup.jorgeaf.dev`. Pages can't disable the generated `divvyup-8wi.pages.dev`, so it is 301'd to the custom domain by an **account-level Bulk Redirect** (not a zone Redirect Rule — the `pages.dev` source isn't in the `jorgeaf.dev` zone), with preserve-query/subpath/path-suffix/include-subdomains on. `include subdomains` also catches preview deployments (`<hash>.divvyup-8wi.pages.dev`).
- **Build watch paths**, in the dashboard: include `frontend/*`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; exclude empty. A docs-only push is skipped here too, exactly like the workflow's `backend/**` path filter — neither deploy cycles on documentation. The three root files are watched because each one changes what gets built: the build installs from the lockfile, `pnpm-workspace.yaml` carries `allowBuilds` and `minimumReleaseAge`, and the root `package.json` pins the pnpm that Pages runs. Excludes are a skip list evaluated *before* the includes, so a path listed in both never builds. The paths live in the Pages settings, not in the repo, so a new build input has to be added there by hand.

Netlify is gone: its GitHub access was revoked in July 2026, so the three always-failing PR checks no longer appear — a red check on a PR now means something real.

**`CLIENT_URL` is the front origin the backend allows in CORS**, and **both** CORS layers use it: the Socket.IO CORS (`socket/socket.server.ts`) and the REST CORS (`index.ts`, `cors({ origin: process.env.CLIENT_URL })`). Compared exactly, no trailing slash; it is `https://divvyup.jorgeaf.dev`. Preview deployments get their own subdomain and will not pass that check. `credentials: true` is **on** in both CORS layers now that the session is a cookie: the browser only sends it cross-origin (front to API) when credentials are allowed, which is also why `origin` must be the exact `CLIENT_URL`, never `*` (incompatible with credentials). `bootstrap.ts` (test app) keeps an open `cors()` on purpose — CORS is browser-enforced and supertest sends no `Origin`.
