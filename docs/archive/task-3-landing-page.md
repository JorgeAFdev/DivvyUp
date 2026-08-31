# Task 3 — Landing page (implementation handoff)

Self-contained spec to implement TODO task 3 in a fresh session. Every decision
below was settled in a grilling pass; the *facts* were verified against the code
on 2026-08-21. Read `CLAUDE.md` for the project-wide rules this must obey — the
ones that bite here are called out inline.

> **Status: DONE on 2026-08-31.** Shipped in two PRs: #141 (typography and
> text-colour inheritance, the app-wide groundwork) and the landing itself. The
> plan below is kept as the record of *why*; four of its locked decisions did not
> survive contact with the code, so read it with these corrections:
>
> - **Decision 1 and 10 were reversed. There is no redirect.** The landing is
>   public: a visitor with a session reads the same page. `landing.test.tsx` now
>   pins the opposite contract (logged in sees the landing with the app nav).
> - **Decision 6 changed: it renders `Header`, not `GuestHeader`.** `Header`
>   already picks the variant from the session, so a signed-in reader gets the app
>   nav and the header is what tells them they are signed in. This is also why the
>   hero CTAs stay "Get started" / "Log in" for everyone.
> - **Decision 3 held, but for another reason.** The blank render during
>   `isPending` is not about a redirect flash: `Header` renders nothing until the
>   session resolves, so painting first would drop the hero in and shove it down.
> - **Decision 7 held for colours, and turned out to bite harder than expected.**
>   No new colour token was added, but neither brand blue clears AA as landing
>   text (`--primary-color` 2.97:1, `--primary-color-dark` 3.32:1 on the light
>   page), so the hero gradient became a low-opacity wash over `--bg-color` and
>   the blue is reserved for the filled buttons. Two non-colour tokens were added:
>   `--font-display` and `--muted`.
>
> **The structure also went further than section 2 describes.** There is no
> `landing.module.css`: the page file only composes, and the sections live in
> `components/landing/` (shell, section, features/feature, cta, footer,
> vignettes). The typeface work it did not anticipate (Instrument Serif for the
> landing, IBM Plex Sans/Mono app-wide) landed in #141. The current state and its
> gotchas are in `CLAUDE.md`; this file is only the reasoning that got there.

## Goal

Build a real, public marketing landing at `/` and, in doing so, close the routing
hole that task 3 exists for: today `/` mounts `<Layout>` with children but **no
index route**, so `/` renders the header over an empty `<main>` (the `path="*"`
wildcard does not catch it — `/` matches the parent route exactly). The landing
is the front door for logged-out strangers; a logged-in visitor to `/` is
redirected to `/groups`.

Scope decided: a **real landing page (not just an index redirect)**, its **own
full-bleed route outside `<Layout>`**, with a **logged-in → `/groups` redirect**.

## Current state (verified)

- `frontend/src/App.tsx` — routes today (TS + cookie session; the TODO's mention
  of `App.jsx`/"token" is stale wording):

  ```tsx
  <Routes>
    <Route path="/" element={<Layout />}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/profile" element={<RequireAuth><User /></RequireAuth>} />
      <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
      <Route path="/groups/:groupId/expenses" element={<RequireAuth><GroupDetails /></RequireAuth>} />
      <Route path="/my-expenses" element={<RequireAuth><MyExpenses /></RequireAuth>} />
      <Route path="/join/:inviteCode" element={<Join />} />
      <Route path="/email-verified" element={<EmailVerified />} />
      <Route path="/email-change" element={<EmailChange />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<NoMatch />} />
    </Route>
  </Routes>
  ```

- Auth is read via `useAuth()` (`context/userContextAuth.tsx`) → `{ user, isPending, refetch, signOut }`.
  `user` is `null` when logged out; `isPending` is `true` on the first render
  while the session cookie is checked. No token anywhere — the cookie rides on its
  own. `Header` and `RequireAuth` both `return null` while `isPending`.
- `components/layout/layout.tsx` wraps every route in `<main>` styled
  `width: min(90%, 120rem)` centered (`layout.module.css`). **This is why the
  landing must live outside Layout** — a boxed 90% main cannot do edge-to-edge
  hero bands without `100vw` hacks.
- `components/header/guestHeader.tsx` already renders the exact logged-out nav we
  want: `HeaderLogo` + `<Link to="/login">Login</Link>` + `<Link to="/register">Register</Link>` + `<ThemeToggle />`.
- `HeaderLogo` links to `/` (now the landing — no conflict).

## Decisions (all locked)

1. **Real landing, not a redirect stub.** Logged-in visitors to `/` redirect to `/groups`.
2. **Own full-bleed route, outside `<Layout>`.** Restructure `App.tsx` (below).
3. **Blank-then-decide redirect gate.** During `isPending`, render nothing
   (matches `Header`/`RequireAuth`). No flash of marketing to a returning user
   who opens the bare domain. No SEO cost — it is a client-rendered Vite SPA on
   Cloudflare Pages with no SSR, so crawlers get an empty shell regardless.
4. **Standard showcase content:** hero → interleaved feature+vignette rows →
   closing CTA band → footer. No fabricated testimonials/logos.
5. **Faux-UI vignettes from the real design system** (NOT screenshots). Rationale:
   the existing README PNGs (`/screenshots/*.png`) are **stale** (old bright-blue
   buttons, pre-Button-redesign), **dark-only** (would clash with the light-mode
   landing, since the nav keeps `ThemeToggle`), and have **glitchy avatars**.
   Vignettes render the actual components, so they theme automatically and never
   go stale. Keep them **small and focused** around the strongest features — do
   not recreate whole app pages.
6. **Reuse `GuestHeader` verbatim** as the landing nav (same audience, same links,
   already themed). The prominent conversion CTA lives in the hero, not the nav.
7. **No new color tokens.** Distinctiveness comes from **layout + type scale** in
   the landing's own CSS module. A hero gradient is allowed **only** if composed
   from the existing `--primary-color` → `--primary-color-dark` (both already
   defined and themed). No new named colors.
8. **Footer** (minimal): wordmark + a **"Source on GitHub"** link
   (`https://github.com/DivvyUp-app/DivvyUp`, external, opens in a new tab) + the
   attribution line, exactly:
   **`Originally created by Jorge Álvarez & Alex Biescas · Further developed by Jorge Álvarez`**
   (the separator is a middot `·`, not an em dash). Context: the project has been
   developed and maintained solely by Jorge since the master's project; Alex
   originally contributed login/register/Cloudinary, since replaced by the Better
   Auth migration and subsequent architecture/UX/design work.
9. **Interleaved feature+vignette rows** (alternating left/right), the **3
   strongest features**, each paired with its own vignette. No separate feature
   grid and no separate screenshot band — the vignette *is* the feature's visual.
10. **One vitest test on the redirect gate** (`landing.test.tsx`). No Cypress
    (the redirect is client-side logic, better unit-tested than seeding the real
    DB). No assertions on marketing markup beyond a landmark.

## What to build

### 1. `App.tsx` restructure

Move the landing to its own route and put the app screens under a **pathless**
layout route so they keep the app chrome:

```tsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route element={<Layout />}>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<RegisterForm />} />
    <Route path="/profile" element={<RequireAuth><User /></RequireAuth>} />
    <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
    <Route path="/groups/:groupId/expenses" element={<RequireAuth><GroupDetails /></RequireAuth>} />
    <Route path="/my-expenses" element={<RequireAuth><MyExpenses /></RequireAuth>} />
    <Route path="/join/:inviteCode" element={<Join />} />
    <Route path="/email-verified" element={<EmailVerified />} />
    <Route path="/email-change" element={<EmailChange />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="*" element={<NoMatch />} />
  </Route>
</Routes>
```

`NoMatch` stays inside Layout (a 404 keeps the app header). The absolute child
paths (`/login`, …) work unchanged under a pathless parent.

### 2. `pages/landing/landing.tsx` + `landing.module.css`

**Redirect gate at the top of the component:**

```tsx
const { user, isPending } = useAuth();
if (isPending) return null;
if (user) return <Navigate to="/groups" replace />;
// ...render the landing
```

**Page structure, top → bottom:**

1. `<GuestHeader />` — verbatim.
2. **Hero.** Big headline + subhead. Primary `ButtonLink to="/register"`
   ("Get started"), secondary `ButtonLink to="/login"` ("Log in"). Background
   gradient from `--primary-color` → `--primary-color-dark` only. Leaning copy:
   headline **"Split expenses, not friendships."** (tweak on sight).
3. **Interleaved feature+vignette rows** (alternating L/R), 3 features:
   - **Auto-netted balances & debts** — vignette: a couple of balance chips
     (e.g. `javier +645€`, `alex −370€`) + a debt row "alex owes 370€ to javier"
     with a real `Button variant="primary" size="sm"` labelled "Mark as paid".
   - **Invite by a link; members are names** — vignette: a small member list
     mixing `MemberAvatar` with a `src` (picture) and without (initials) + an
     invite-link chip. Reinforces the "a member is a name, not an account" model.
   - **Real-time notifications** — vignette: a faux toast card.
4. **Closing CTA band** — headline + primary `ButtonLink to="/register"`.
5. **Footer** — see decision 8.

All vignettes use **static fake data** (literal props, no data hooks).

**Full-bleed technique:** sections are edge-to-edge (`width: 100%`); an inner
container caps content (`width: min(90%, 120rem); margin-inline: auto`) to match
the app's rhythm. Distinctiveness from type scale + spacing in the CSS module.

### 3. `pages/landing/landing.test.tsx` (vitest / jsdom)

Mock `authClient.useSession()` (the source `useAuth()` reads) and assert the three
states. Render inside `MemoryRouter` (with a `/groups` route present to observe
the redirect):

- `isPending: true` → component renders nothing.
- session with a `user` → redirects to `/groups`.
- no session (`data: null`, `isPending: false`) → landing content renders (assert
  a landmark / the hero CTA, not the marketing prose).

Note (from `CLAUDE.md` testing notes): any test rendering a router needs the
`TextEncoder`/`TextDecoder` shim already in `frontend/vitest.setup.js`; that setup
is loaded globally, so nothing extra is needed here. Frontend tests do not run in
CI — this guards intent, not the pipeline. Run: `pnpm exec vitest run src/pages/landing/landing.test.tsx`.

## Verified component APIs (use these, do not hand-roll)

Design-system rules from `CLAUDE.md`: every button-styled **link** goes through
`ButtonLink`, every **button** through `Button`, every avatar through
`MemberAvatar`. Colors only from CSS vars in `App.css`. No em dashes in UI copy.

```tsx
// components/button/buttonLink.tsx — a router <Link> wearing the button look
<ButtonLink to="/register" variant="primary" size="lg">Get started</ButtonLink>
//   variant?: "primary" | "secondary" | "ghost"  (default "primary")
//   size?:    "sm" | "md" | "lg"                  (default "md")
//   + all react-router LinkProps

// components/button/button.tsx — real <button>
<Button variant="primary" size="sm">Mark as paid</Button>
//   variant / size as above; type defaults to "button"; loading?: boolean;
//   + ButtonHTMLAttributes

// components/avatar/memberAvatar.tsx — outlined, monochrome, initials fallback
<MemberAvatar name="Javier" src={pictureUrl} size={40} />
//   name: string (required); src?: string (initials when absent); size?: number
```

`--primary-color-strong` (`#0b6ecf`) is the AA filled-button blue — it is applied
*inside* `Button`/`ButtonLink`, so you get it for free by using those components;
do not reference it directly. `--primary-color` (`#1e90ff`) is the header/title
blue used elsewhere.

Color tokens available (from `App.css`; `:root` light, `body.dark` overrides):
`--color`, `--bg-color`, `--secondary-bg-color`, `--border-color`,
`--placeholder-color`, `--primary-color`, `--primary-color-dark`,
`--primary-color-strong` / `--primary-color-strong-hover`. Only these — a genuinely
new color would have to be added to `:root` **and** `body.dark`, which this task
decided against.

## Housekeeping

- **Branch + PR.** This is code, so work on a new branch and open a PR (docs go
  straight to `main`; code does not). Do not commit unprompted — the author runs
  `/commit-all` and approves the messages.
- **Drop task 3 from `TODO.md`** once it lands (finished tasks are removed;
  see the recent `docs(todo): drop finished and dropped tasks` commit).
- PR body / commit convention: write "TODO 3" (no `#`), state the end state and
  its gotchas rather than a before/after narrative.
- Dev servers are already running (`:3000` / `:3001`); probe, don't start them.
```
