# Migración a Better Auth — plan y registro de decisiones

> **Estado: migración COMPLETA — documento archivado (20-08-2026).** Los cuatro child PRs entraron y
> están en prod: core ([#126](https://github.com/DivvyUp-app/DivvyUp/pull/126)), Google OAuth
> ([#128](https://github.com/DivvyUp-app/DivvyUp/pull/128)), verificación + Resend + cambio de email
> ([#129](https://github.com/DivvyUp-app/DivvyUp/pull/129)) y **reset de contraseña** (el PR que archiva
> este doc). El auth artesanal (JWT en `localStorage`, `bcryptjs`, `security/jwt.ts`, controlador
> `/auth` propio) queda retirado: Better Auth es la única autoridad de registro, hashing, credenciales,
> sesiones (cookie `divvyup_session` httpOnly) y OAuth. **Absorbe también el punto 1 del TODO** (revisar
> la autenticación): no se montó el esquema access+refresh porque BA ya trae sesión por cookie con
> rotación. Lo único que queda es **opcional** — el punto 5 de la lista de abajo (GitHub/Apple, y
> endurecer `requireEmailVerification`).

Este documento fue la fuente de verdad del plan durante la migración del auth artesanal a
[Better Aut­h](https://better-auth.com). Ya ejecutada, lo que describe _cómo se comporta el código_ vive
en `CLAUDE.md` (sección *Auth*); aquí se conserva sólo el registro de decisiones — qué se decidió y por
qué, lo que no se reconstruye leyendo el repo. El plan de abajo describe lo ejecutado.

## Por qué Better Auth y no el esquema access+refresh del punto 1

La tarea 5 se solapa con la 1 (revisar la autenticación). Se descartó montar antes el esquema
access token (en memoria) + refresh token (cookie): Better Auth ya trae sesiones con cookie
`httpOnly` y rotación de fábrica, así que hacer el esquema a mano primero sería trabajo tirado. Se
toma el camino Better Auth directamente.

## Forma del trabajo: un epic, varios child PRs

La migración entra por partes, cada child PR **deja la app funcionando y es revisable por separado**:

1. **Core (el primer PR)** — email/contraseña a través de Better Auth + sesión por cookie,
   retirando el mecanismo custom. Sin proveedores sociales, sin verificación de email, sin reset.
2. **Google OAuth** — segundo método de login. Arrastra el OAuth client en Google Cloud, las
   redirect URIs (prod + `localhost:3001`), variables nuevas y la decisión de **vinculación de
   cuentas** (mismo email por contraseña y por Google).
3. **Verificación de email + Resend** — activa el envío de verificación (le da por fin un llamante
   al servicio de email del punto 6) y trae el **cambio de email del perfil**, que el core deja
   aplazado. Cierra de paso la enumeración de `/register` que el punto 1 dejó pendiente.
4. **Reset de contraseña.**
5. Más adelante, si interesa: GitHub/Apple (cada uno es sólo otro OAuth client), y endurecer el gate
   de `emailVerified` en el login (`requireEmailVerification`).

Este documento detalla el **PR core** (abajo), el **child PR 2 (Google OAuth)**, el **child PR 3
(verificación de email)** y el **child PR 4 (reset de contraseña)** (al final).

---

## PR core: email/contraseña por Better Auth + cookie

Objetivo acotado: **sustituir el mecanismo**, no añadir funcionalidad. La app queda funcionalmente
igual que hoy (email/contraseña) pero con Better Auth por debajo y la sesión en cookie en vez de un
JWT en `localStorage`. Better Auth pasa a ser dueño de registro, hashing, verificación de
contraseña, login, accounts y sesiones. La red de Cypress sigue verde.

### Identidad

- **No hay usuarios reales que migrar**: la colección `users` sólo tiene datos de prueba, así que se
  **resiembra desde cero** en vez de preservar `_id`. Eso elimina la parte cara (la migración que
  conserva ids).
- **Gate de identidad verificado (18-08-2026): `ObjectId` como id de BA es viable.** El susto inicial
  (un resumen de answeroverflow decía que el adapter guarda el `id` como string plano) **se descartó
  leyendo el fuente de `@better-auth/mongo-adapter`**: el `customTransformInput` sólo pasa el id como
  string cuando defines un `generateId` custom que devuelve string; en el caso por defecto o con
  `generateId: false` castea el `_id` **y toda clave foránea que referencia a `id`** (`session.userId`,
  `account.userId`) a `ObjectId` real, y el `customTransformOutput` los expone como hex. Además
  `mapKeysTransformOutput: { _id: "id" }`: el `id` de BA **es** el `_id`, no hay campo `id` string
  aparte. Se descartaron el adapter de terceros `better-auth-mongoose` (8 días de vida, 1 estrella) y
  el patrón perfil-con-`betterAuthUserId` (lookup por request) por innecesarios.
- **Estrategia adoptada (decisión C): `members[].user` sigue `ObjectId` con `ref` a un read-model
  sobre la colección `user` de BA.** El grafo no cambia de tipos en ningún sitio:
  - **`members[]._id`** (subdoc `ObjectId`) es lo que referencian `Expense`/`Payment`; intacto.
  - **`members[].user`** sigue `ObjectId`, guardando el `_id` (ObjectId) del usuario de BA — se
    construye con `new ObjectId(session.user.id)`. `memberOf`/`linkedUserIds` (`idOf(...).toString()`)
    **no cambian**.
  - Condición única en la config de BA: **no** definir un `generateId` custom-string (se usa
    `generateId: false`), para que BA guarde `_id`/refs como `ObjectId`.
- **Se retira el modelo Mongoose `User` de escritura.** La colección `user` de Better Auth pasa a
  ser el único almacén de usuarios: `password` se va a la colección `account` de BA, y
  `profilePicture` se mapea al campo **`image`** de BA.
- Para **leer** esa colección (pintar avatares) se registra un modelo Mongoose de sólo lectura
  `UserView` con `{ collection: 'user' }` y campos `name`/`image`, y `members.user` apunta a él con
  `ref: 'UserView'` (nombrado por la colección que lee, no `Account`: la colección `account` de BA es
  el almacén de credenciales, otra cosa). Así **los 13 `.populate('members.user', ...)` siguen funcionando sin tocarse**;
  sólo cambia la proyección (`name image`, antes `name profilePicture`) y el serializer mapea el
  `image` de BA al `profilePicture` del contrato. BA sigue siendo el único que _escribe_ los campos
  auth-sensibles (`email`, `emailVerified`, `account`).
- `member.name` **no cambia**: sigue siendo el nombre que vive en el grupo, no el de la cuenta. El
  contrato "el nombre es del miembro, la cuenta sólo aporta el avatar" se mantiene intacto.

### Sesión: cookie, no token en `localStorage`

- La sesión de Better Auth viaja en cookie `httpOnly` + `Secure` + `SameSite=Lax`. `Lax` es viable
  porque, hecho el punto 20, front (`divvyup.jorgeaf.dev`) y back (`divvyup-api.jorgeaf.dev`)
  comparten el dominio registrable `jorgeaf.dev` — subdominios distintos, pero **same-site** (el
  "site" es el dominio registrable, no el host), así que un `fetch` del front al back no es cross-site
  y `Lax` la deja pasar.
- **Nombre: `divvyup_session`, no el `better-auth.session_token` por defecto** (config
  `advanced.cookies.session_token.name`). El default delata el framework; renombrarla es la pauta
  anti-fingerprint de OWASP. Se prefirió un nombre namespaced a la app (patrón `laravel_session`)
  antes que uno opaco tipo `sid`: la ganancia de opacidad es marginal (es `httpOnly` y host-only, no
  la ve JS de terceros) y el namespace evita colisiones y es legible en DevTools/logs.
- **Host-only a propósito: la cookie no lleva `Domain`.** El API es el único que la escribe y el
  único que la lee (es `httpOnly`; el front sólo hace `fetch` con `credentials`, el navegador la
  adjunta al destino, que siempre es el API), así que **nunca necesita compartirse entre hosts** y
  host-only basta. Se deja `crossSubDomainCookies` **desactivado** a conciencia: como `divvyup` y
  `divvyup-api` son subdominios **hermanos**, el único `Domain` que cubriría a ambos sería la **raíz
  `jorgeaf.dev`** — no hay un `divvyup*.jorgeaf.dev` intermedio, eso no existe en cookies — y no se
  quiere scopear la sesión al dominio raíz. Como no hay que compartirla, tampoco hace falta. (Contraste
  con otro proyecto donde el API cuelga *bajo* el host del front, `api.app.dominio`: allí un `Domain`
  no-raíz sí cubre a ambos; aquí, hermanos, sólo lo haría el raíz.)
- **CSRF.** `SameSite=Lax` corta el vector: una petición cross-site desde otro origen (`fetch`/XHR/form
  POST) **no** lleva la cookie, así que llega sin sesión. La excepción de `Lax` (navegación top-level
  GET sí la lleva) no expone nada mientras las mutaciones sean POST/PATCH/DELETE, que lo son. Encima
  Better Auth valida el header `Origin` contra `trustedOrigins` en las peticiones que cambian estado
  (el `Missing or null Origin` que saltó en la siembra de Cypress) — segunda capa. `credentials: true`
  en CORS sólo habilita *leer* la respuesta cross-origin; no es protección CSRF por sí mismo.
- **Verificado en prod (18-08-2026).** El Cypress local corre `localhost:3000 → :3001`, que es el
  **mismo host, distinto puerto** (las cookies ignoran el puerto), así que no ejercitaba el camino
  cross-subdominio real; se comprobó en el primer deploy. Un register real dejó la cookie
  `__Secure-divvyup_session` **host-only** bajo `divvyup-api.jorgeaf.dev` (Domain sin punto delante =
  no compartida, no raíz), y la sesión quedó activa desde el front, luego viaja cross-subdominio con
  `SameSite=Lax`. El prefijo `__Secure-` lo añade Better Auth solo en prod (cookie `Secure` sobre
  https) y lo gestiona en ambos lados; en local (http) es `divvyup_session` a secas.
- Es el motivo de fondo de toda la migración: el token deja de estar en `localStorage`, donde
  cualquier JS de la página lo lee (exposición a XSS de hoy). Hacer esta migración manteniendo el
  token en `localStorage` (plugin `bearer`/`jwt` de BA) sería pagar el coste de BA sin cobrarse su
  beneficio principal, así que se descartó.
- Peaje: `credentials: true` en el `cors` del back (el `origin` ya está atado a `CLIENT_URL`),
  `trustedOrigins` en la config de BA, `withCredentials: true` en la instancia de axios.
- **Desaparece `authHeaders(token)`** de todos los `utils/*Api.ts` (la cookie viaja sola) y la clave
  `user-session` de `localStorage` (`utils/localStorage.ts`).

### Backend

- **Se borran `auth.routes.ts` y `auth.controller.ts`.** Se monta `toNodeHandler(auth)` de
  `better-auth/node` en `/api/auth/*`, y tiene que ir **antes de `express.json()`** porque lee el
  body crudo. El front deja de llamar a endpoints propios: login/registro llaman a los métodos del
  cliente de BA. Se descartó darle a BA otro `basePath` para conservar las rutas propias: mantendría
  dos sistemas de auth vivos, justo lo que se quiere evitar.
- `jwtMiddleware` se convierte en **`requireSession`**: en vez de `jwt.verify`, llama a
  `auth.api.getSession({ headers })` y, si hay sesión, puebla **`req.user`** con `{ id, name, email }`.
  Se renombra `req.jwtPayload → req.user` (deja de haber JWT; el nombre viejo sería mentira): ~16
  sitios de lectura y el tipo en `types/express.d.ts`. La lógica de los controladores no cambia,
  siguen leyendo `.id`/`.name`/`.email`; sólo cambia el nombre del sobre.
- **Arranque async.** El `mongodbAdapter` de BA necesita un `Db` nativo (`mongoose.connection.db`)
  que sólo existe **después** de que `connectDB()` resuelva. `index.ts` se reescribe como bootstrap
  async: `await connectDB()` → construir `auth` con `mongoose.connection.db` → montar
  `toNodeHandler(auth)` → `express.json()` → router → `server.listen`. Esto arregla de paso el
  fire-and-forget de hoy (`connectDB().then(...)` con el server escuchando antes de que la BD esté
  lista). `bootstrapApp()` pasa a ser async con la misma forma.
- **Handshake del socket endurecido en este PR.** Hoy `socket.server.ts` mete al cliente en la sala
  `user:<userId>` fiándose del `userId` que manda el propio cliente en el evento `register`
  (suplantable). Pasa a validar la cookie de sesión en el handshake (`auth.api.getSession` sobre
  `socket.handshake.headers.cookie`) y a derivar la sala de la sesión verificada. Se endurece ahora,
  no en un child PR, por coherencia: dejar el socket creyéndose el `userId` al lado de una capa HTTP
  ya endurecida sería una puerta trasera junto a la puerta que se acaba de cerrar (cualquiera se mete
  en `user:<otro>` y recibe sus notificaciones).
- **`PATCH /user/update`**: multer + `uploadToCloudinary` **igual que hoy**, pero la escritura va por
  `auth.api.updateUser({ body: { name, image }, headers })` en vez de Mongoose. En core se editan
  **nombre y foto**; el **email queda de sólo lectura** (campo visible pero deshabilitado en el
  form). El cambio de email se aplaza al child PR de verificación, porque hacerlo bien necesita el
  flujo `changeEmail` de BA con verificación, y hacerlo a mano escribiría un email sin verificar
  directo en la colección — justo lo que ese PR viene a arreglar. El endpoint **rechaza con 400** un
  email distinto al de la sesión en vez de ignorarlo y responder 200: el schema sigue exigiendo el
  campo, así que el cliente reenvía el actual y un intento de cambio falla en claro.

### Validación (`@monorepo/validation`)

- El paquete **sobrevive intacto**. Al retirar `auth.routes.ts` desaparece el middleware
  `validate(registerSchema)`, y el `signUp` va del cliente directo al endpoint de BA (que por
  defecto sólo tiene `minPasswordLength`, no el regex de fuerza).
- La regla de fuerza (8+, mayús/minús/dígito) y su copy siguen viviendo **en un solo sitio**: el
  front sigue validando con `zodResolver`, y en el back `registerSchema`/`loginSchema` se
  reenganchan en un **hook `before`** de sign-up/sign-in de Better Auth, que ejecuta el mismo esquema
  antes de crear el usuario / comprobar credenciales. Así BA sigue siendo la autoridad de servidor y
  no se debilita la regla ni se duplica su texto. Se descartó depender sólo de `minPasswordLength`:
  dejaría la fuerza de contraseña a merced de que nadie llame al endpoint de BA sin pasar por el
  form. Se conserva también el shape de login validado antes de la comprobación de credenciales (un
  login malformado da 400; un email desconocido bien formado sigue dando "Invalid credentials", así
  que la enumeración sigue cerrada).

### Frontend

- **Split lectura/mutación.** La _lectura_ de sesión va por el store reactivo de BA
  (`authClient.useSession()`), bajo un `useAuth()` fino que expone `{ user, isPending, signOut }` —
  es el equivalente a leer la sesión viva (antes `localStorage`), que tampoco pasaba por react-query.
  Las _mutaciones_ (`signIn`/`signUp`/`signOut`) se envuelven en hooks de react-query en
  `hooks/useSession.ts` (el `mutationFn` llama a `authClient`), conservando el patrón del `CLAUDE.md`:
  el hook posee la llamada, el `queryClient.clear()` antes de guardar sesión y las invalidaciones; el
  componente posee la UI (toast/`navigate`/cerrar modal en el `mutate` onSuccess). Se descartó llamar
  a `authClient` crudo desde los componentes: reproduce el "cada componente hace su llamada" que la
  capa de hooks vino a matar.
- `App.tsx` filtra las rutas por `user`/sesión en vez de por `token`. El "¿quién soy en el primer
  render?" lo resuelve `authClient.useSession()` con su estado `isPending` (BA pide la sesión al
  montar), en vez de leer `localStorage`. Las queries que hoy hacen `enabled: Boolean(token)` pasan a
  `enabled: Boolean(user)`.
- Los `utils/*Api.ts` dejan de recibir/pasar token; los hooks tampoco. Menos código, no más.
- **Gotcha del `baseURL` del cliente:** `createAuthClient` debe recibir `${VITE_API_URL}/auth` (la base
  **completa**, `.../api/auth`), no `VITE_API_URL` + `basePath: '/auth'`. El `withPath` de BA ignora el
  `basePath` cuando el `baseURL` ya trae un path (`VITE_API_URL` ya tiene `/api`): devuelve la URL tal
  cual, dejando las llamadas en `/api/*` en vez de `/api/auth/*`. El servidor sí monta en `/api/auth`
  (su `baseURL` es el origin sin path, así que le añade el `/api/auth` por defecto).
- **Recorte de scope: el registro ya no sube foto.** `authClient.signUp.email` sólo acepta `image` como
  URL string, no un `File`, y no hay un endpoint aparte que suba a Cloudinary antes del alta. Así que
  `registerForm` pierde el campo de foto; la foto se pone después desde el perfil (`updateUser`, que sí
  hace multer→Cloudinary→`auth.api.updateUser({ image })`). Coherente con "el registro funciona sin
  foto" del `CLAUDE.md`.

### Tests

- **Backend: sesiones reales de BA.** El patrón de hoy (`User.create(...)` + `generateJWT()` en
  `beforeAll`, `Bearer` en cada request) se sustituye por un helper `signUp(app, { name, email })`
  (`tests/helpers/session.ts`) que hace `POST /api/auth/sign-up/email` por supertest y devuelve
  `{ id, cookie }`; los helpers `post`/`put`/`get` pasan `Cookie` en vez de `Authorization`. Los tests
  ejercitan así el camino real de cookie/sesión, que es lo nuevo y arriesgado. `bootstrapApp()` se
  construye en `beforeAll` (tras `connectDB`, que `createAuth` necesita). Cada fichero levanta su
  `mongodb-memory-server`; `fileParallelism: false` ya está. `vitest.setup.js` pasa de `jwt_secret` a
  `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`CLIENT_URL`. **`auth.test.ts` se adelgazó**: register/login son
  de BA y son suyos de testear; lo que queda pinado es el hook Zod (rechazos con la copy exacta,
  flatten) y que ninguna respuesta filtra la contraseña. **Resultado: 135/135 backend verdes.**
- **Cypress (13/13, 7 specs).** `cypress/support/api.js` deja de plantar la sesión en `localStorage`:
  `registerUser` hace `POST /api/auth/sign-up/email` y la cookie httpOnly cae en el jar de Cypress, que
  la comparte con la app — no hay token ni `useSession(localStorage)`. El patrón **multi-usuario**
  (join/smoke registran dos cuentas) usa un `loginAs(email)` (`sign-in/email`) que reescribe la cookie
  activa, en vez de elegir un `localStorage`. Dos gotchas que costaron:
  - **`getSession()` de priming en `useSession.ts`**: tras `signIn/signUp` la acción resuelve antes de
    que el átomo de `useSession` tenga el `user`, así que un `navigate()` a una ruta guardada rebotaba a
    `/login`. Se prima la sesión (`await authClient.getSession()`) en el `mutationFn` antes del navigate.
  - **Header `Origin` en la siembra**: los endpoints de BA hacen check CSRF de origen cuando hay cookie
    de sesión y responden 403 *Missing or null Origin* si falta. El navegador manda `Origin` siempre;
    `cy.request` no, así que sembrar una segunda cuenta (que lleva la cookie de la primera) necesita
    `headers: { origin: CLIENT_URL }`. Nuestro `/group` no se ve afectado (sólo lee la sesión).
  Se ejercita contra la app corriendo; escribe en `/test` (nunca `/prod`). El registro por UI ya no
  sube foto y el email del perfil está deshabilitado — los specs se ajustaron a ambos.

### Plumbing / despliegue

- **Versión fijada: `better-auth@1.6.29`** (la última estable que `minimumReleaseAge: 4320` (3 días)
  dejaba resolver el 18-08-2026; BA publica a menudo). Va en **`dependencies`** del backend y del
  frontend (un solo paquete: servidor en `better-auth`, cliente en `better-auth/react`).
- **Override de `mongodb` a `6.20.0` en `pnpm-workspace.yaml`** (`overrides:`), la versión que trae
  mongoose. Sin esto el adapter de BA tira `mongodb@7.x` (bson 7) y mongoose usa bson 6 → dos majors de
  bson en un proceso lanzan `Unsupported BSON version` al insertar. Con el override, adapter y mongoose
  comparten un único mongodb/bson.
- **El Dockerfile NO necesita cambios.** `better-auth` es una dependencia normal, así que el
  `pnpm install --prod --filter=@monorepo/backend...` del runtime stage ya la instala (a diferencia de
  los `dist/` de los workspaces, que sí se copian). El adapter usa el `mongodb` que trae mongoose (peer
  opcional, fijado por el override), así que también entra con `--prod`.
- **El build de Cloudflare Pages NO cambia**: `better-auth` es dep del frontend, se instala con
  `--filter @monorepo/frontend...` y Vite lo bundea; no es un `dist/` de workspace que haya que
  construir aparte (a diferencia de `@monorepo/validation`).
- Env nuevas en Coolify (prod): `BETTER_AUTH_SECRET` (secreto) y `BETTER_AUTH_URL`
  (`https://divvyup-api.jorgeaf.dev`). `jwt_secret` deja de usarse (se puede quitar). Se retiraron
  `bcryptjs` y `jsonwebtoken` (+ sus `@types`) de las deps del backend: sólo los usaba el `user.schema`
  retirado.
- El paquete es TypeScript/ESM-first y el backend ya es ESM (punto 13), así que se importa nativo sin
  transpilar.

### Definición de "hecho" para el core

- Registro y login funcionan por Better Auth con sesión en cookie; no queda rastro del JWT en
  `localStorage` ni de `authHeaders`.
- El grafo (grupos/gastos/pagos) sigue referenciando ids válidos de la colección `user` de BA.
- `pnpm typecheck` (el gate de PR) y los tests de backend en verde con sesiones reales. **✅ 135/135.**
- Cypress en verde contra la app corriendo (comprobando que apunta a `/test`, no a `/prod`). **✅ 13/13.**
- El socket sólo emite a salas de identidades verificadas por sesión.

---

## Child PR 2: Google OAuth

Objetivo acotado: **segundo método de login**, nada más. La app sigue igual; se añade "Continue with
Google" junto al email/contraseña. Better Auth ya trae el flujo OAuth entero, así que el peso está en
la config y una decisión: **la vinculación de cuentas**.

### Backend (`security/auth.ts`)

- `socialProviders.google` con `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Better Auth **auto-monta**
  `/api/auth/callback/google`: no hay ruta ni controlador nuestro que tocar, sólo registrar esa
  redirect URI en el cliente de Google Cloud (local `:3001` y prod).
- **Vinculación de cuentas: activada sólo para Google** (`account.accountLinking.enabled: true`,
  `trustedProviders: ['google']`). El caso es "el mismo email ya tiene cuenta por contraseña y ahora
  entra por Google": Better Auth exige `email` único en `user`, así que no caben dos usuarios — o se
  vinculan o se rechaza. **Se vinculan**: Google verifica el email que devuelve, así que quien entra es
  el dueño real de ese email, la misma persona; se añade el `account` de Google al user existente en
  vez de colisionar. Se restringe a `google` a conciencia (`trustedProviders`): **nunca** vincular por
  la palabra de un proveedor que no verifique el email, o sería un vector de apropiación de cuenta. Se
  descartó el rechazo + vinculación manual desde el perfil: más UI y fricción para blindar un caso que
  la verificación de Google ya cierra.
- **Avatar y datos al vincular.** El avatar de Google entra en `user.image` (el mismo campo que escribe
  una subida a Cloudinary; el serializer lo mapea a `profilePicture` del contrato), como URL externa
  tal cual — no se recircula por Cloudinary. `updateUserInfoOnLink` se deja en su default `false`: si ya
  tenías avatar/nombre, vincular Google **no** los pisa. `member.name` sigue siendo del grupo, intacto.
- Sin cambios en Docker ni Cloudflare Pages: `better-auth` ya es dep de ambos; no hay dependencia nueva.

### Frontend

- `components/auth/googleButton.tsx`, montado vía `components/auth/socialAuth.tsx` (los proveedores +
  un divider "or") **arriba** de ambos forms, sobre email/contraseña: el social es el camino rápido, así
  que va primero, y `socialAuth` es el único sitio donde entra un segundo proveedor (GitHub, planeado).
  Con Google el registro y el login son el mismo acto. Llama `authClient.signIn.social({ provider:
  'google', callbackURL, errorCallbackURL })`.
- **No pasa por `useSession`/react-query como el email.** `signIn.social` es un **redirect full-page** a
  Google: el éxito no vuelve a este handler (la app remonta en el callback con la sesión ya puesta), así
  que no hay `waitForSession` ni `navigate` — sólo se maneja localmente el fallo al ni siquiera arrancar
  el redirect. `callbackURL` respeta el `?next=` vía `nextDestination(search)`; `errorCallbackURL` es
  `/login`.

### Env / setup

- Nuevas env de backend (local + Coolify prod): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Cliente de Google Cloud (**Web application**) con redirect URIs
  `http://localhost:3001/api/auth/callback/google` y
  `https://divvyup-api.jorgeaf.dev/api/auth/callback/google`.

### Tests

- El flujo OAuth es externo (redirect a Google), así que **no se e2e-tea**: ni Cypress ni un test de
  backend pueden completar el consentimiento. La verificación es **manual en local** contra el cliente
  de Google. El resto de la red (email/contraseña, grupos, ledger) sigue verde e independiente de este
  cambio.

### Definición de "hecho" para el child PR 2

- Login y registro con Google funcionan; un email nuevo crea el user, un email ya existente por
  contraseña **vincula** el account de Google en vez de fallar.
- `pnpm typecheck` (back y front) en verde; la red existente sin regresiones.
- Verificado a mano el round-trip completo en local (redirect a Google, callback, sesión activa).

---

## Child PR 3: verificación de email + Resend + cambio de email

Le da por fin **un llamante a `services/email`** (el Resend del punto 6, que hasta ahora nadie
usaba) y desbloquea el **cambio de email del perfil**, que el core dejó de sólo lectura.

### Verificación de email — soft, no bloquea login

- `emailVerification.sendOnSignUp: true` manda un link de verificación en el alta, vía
  `sendVerificationEmail`. `autoSignInAfterVerification: true` deja al user logueado tras pulsar el
  link.
- **La copy de los correos vive en `services/authEmails.ts`**, no inline en `auth.ts`: ese fichero es
  composición (declara *qué* usa BA), no el sitio de la redacción de un email. `auth.ts` referencia
  las funciones; las plantillas (y el correo de reset del child PR 4, o una versión HTML) caen todas
  en un solo módulo. Ambas componen texto plano a través de `sendEmail` (Resend).
- **`requireEmailVerification` se queda OFF a conciencia.** La verificación no cierra la puerta al
  login todavía; endurecer ese gate es el punto 5 del plan, con su banner/reenvío. Aquí es soft: el
  valor de este PR es dar llamante a Resend, marcar `emailVerified` y habilitar el cambio de email,
  no meter fricción. Se descartó el gate duro para no arrastrar el punto 5 a este PR.
- El link redirige al front **`/email-verified`** (ruta pública, el link puede abrirse sin sesión).
  El `signUp.email` del front pasa ese `callbackURL` **absoluto** (mismo motivo que Google: relativo
  resolvería contra el origin de la API).
- **`sendVerificationEmail` sirve a dos casos**: el alta **y** el segundo paso de un cambio de email
  (BA lo reusa para el email nuevo y no da forma de distinguirlos), así que su copy es **neutral** de
  dirección, no un "welcome" de alta.

### Cambio de email — por el backend, flujo nativo de BA

- **Decisión: lo maneja el backend, no `authClient.changeEmail` desde el front.** Matiz que la movió:
  `authClient.changeEmail` **no es** validación de front — es una llamada al endpoint de BA en el
  server, que valida igual. Pero enrutarlo por el controlador (`updateUser`) hace correr **nuestra
  Zod** (`userUpdateSchema`) sobre el nuevo email y deja el perfil **unificado** (name/foto/email en
  un solo path). El perfil ya tenía controlador backend, así que encaja ahí.
- `updateUser`: si `req.body.email !== req.user.email`, llama `auth.api.changeEmail({ body: { newEmail,
  callbackURL }, headers })` en vez del antiguo 400.
- **Es un flujo de DOS pasos** (para una cuenta con email verificado, que es lo normal; leído en
  `update-user.mjs` + `email-verification.mjs`):
  1. `sendChangeEmailConfirmation` manda un link al email **actual**. Pulsarlo **no cambia nada**:
     BA genera un segundo token y **manda un segundo correo al email nuevo** (vía `sendVerificationEmail`).
  2. El cambio se aplica **solo al pulsar el link del segundo correo, en la bandeja del email nuevo**
     (`updateUserByEmail`). Confirma que controlas la bandeja **vieja** (anti-hijack: una sesión robada
     no mueve la cuenta) **y** la **nueva**.
  Hasta el paso 2 la respuesta sigue llevando el email viejo; el front muestra un toast "revisa tu
  bandeja" al detectar el cambio.
- **Landing propia `/email-change`** para el flujo de cambio (copy "revisa tu nuevo email para
  finalizar"), distinta de `/email-verified` del alta. Motivo: BA usa **el mismo `callbackURL`** para
  los dos pasos del cambio (el paso 2 hereda el del paso 1), así que ambos caen en `/email-change`. Se
  descartó reusar `/email-verified` a secas (decía "Email verified" tras el paso 1, falso "ya está").
- **Feedback de éxito solo al final, detectado en el front.** La pestaña que pide el cambio guarda el
  email nuevo pendiente (`utils/pendingEmailChange.ts`, `localStorage` — no es un token, y el link se
  abre en otra pestaña); `/email-change` compara la sesión (que trae el email nuevo **solo** tras el
  paso 2, cuando `updateUserByEmail` corre y BA reescribe la cookie) contra ese pendiente y, si
  coinciden, redirige a `/email-verified`. Así paso 1 = "revisa tu bandeja", paso 2 = éxito. Si el link
  se abre en otro navegador (sin el `localStorage`), degrada a la copy pendiente — sigue siendo cierto.
- **Restringido a cuentas con contraseña (solo-Google es read-only).** Un user que entró solo con
  Google no tiene account `credential`: su email **es** su identidad de proveedor, y sigue entrando por
  Google gane o pierda ese email, así que cambiarlo local solo desincroniza sin darle nada. El backend
  lo comprueba con `auth.api.listUserAccounts` (`some(providerId === 'credential')`) y 400ea si no lo
  hay; el front lee la misma señal con `useHasPassword` (`authClient.listAccounts`) y deja el campo
  `disabled` con la nota "Managed by your Google login". El caso mixto (contraseña + Google vinculado)
  **sí** puede cambiarlo: tiene credencial, y el link Google matchea por `sub`, no por email. Se
  descartó dejarlo abierto: técnicamente BA lo permite, pero el resultado (login por gmail, email de
  cuenta distinto) confunde sin aportar.

### Enumeración de `/register` — deferida a conciencia (NO cerrada)

- El plan decía "cierra de paso la enumeración". **Se decide dejarla con el comportamiento por
  defecto de BA** (un alta con email existente devuelve `USER_ALREADY_EXISTS`, que delata). Razón:
  GitHub/GitLab y la mayoría revelan en el registro por UX ("ya tienes cuenta, entra o resetea"), y
  para una app de gastos entre amigos el riesgo (fuga de "este email usa DivvyUp") no compensa el
  trabajo de respuesta idéntica + email al owner. El **login sí sigue cerrado** (email desconocido bien
  formado da el mismo `Invalid email or password`). Si algún día se quiere cerrar register, es
  interceptar el `USER_ALREADY_EXISTS` y desviarlo a un 200 genérico + `sendEmail` al owner.

### Tests

- El `sendOnSignUp` dispara `sendEmail` en **cada** alta, así que `vitest.setup.js` mockea `resend`
  global (no-op); `email.test.ts` re-mockea `resend` en local para seguir aseverando el payload.
- `user.test.ts`: el test del 400 al cambiar email pasa a aseverar que un email válido responde
  **200** y mantiene el email viejo (cambio diferido a la confirmación). **137/137 backend verdes**,
  **36/36 front**.
- El round-trip real (recibir el correo, pulsar el link) es **manual**, como Google.

### Setup / prod

- `RESEND_FROM` en Coolify debe ser un **dominio verificado** en Resend (`send.jorgeaf.dev`);
  `onboarding@resend.dev` (sandbox) sólo entrega al dueño de la cuenta, así que un user real no
  recibiría nada. El dominio está listo en prod.

### Definición de "hecho" para el child PR 3

- Alta manda verificación; el link marca `emailVerified` y loguea. Login **no** exige verificación.
- Cambiar el email del perfil manda confirmación al email actual; pulsarla manda un 2º link al email
  nuevo, y sólo ese segundo click aplica el cambio.
- `pnpm typecheck` (back y front) en verde, tests sin regresiones (137/137, 36/36).
- Verificado a mano en local el round-trip de verificación y el de cambio de email.

---

## Child PR 4: reset de contraseña

Cierra el epic. Better Auth ya trae el flujo entero (`forget-password` → correo con token →
`reset-password`), así que el peso está en la config, la copy del correo y dos pantallas nuevas en el
front. Reusa el `services/email` (Resend) y el `layout` de correo que trajo el child PR 3, y el mismo
patrón de landing pública que `/email-verified` y `/email-change`.

### Backend (`security/auth.ts` + `services/authEmails.ts`)

- `emailAndPassword.sendResetPassword({ user, url })` → nuevo `sendResetPasswordEmail` en
  `authEmails.ts`, componiendo texto plano + HTML por el `layout` compartido, como los otros dos
  correos. El `url` redirige al front **`/reset-password`** (ruta pública, el link se abre sin
  sesión) con el token en query.
- **Better Auth auto-monta las rutas de reset**: no hay ruta ni controlador nuestro que tocar, igual
  que el callback de Google. El front llama a los métodos del cliente
  (`authClient.requestPasswordReset` / `authClient.resetPassword`).
- **Gotcha del nombre del método**: el cliente expone **`requestPasswordReset`**, no `forgetPassword`
  (BA lo renombró; `forgetPassword` sigue como alias del endpoint en el server, pero el tipo del
  cliente ya no lo ofrece y el typecheck lo rechaza). El path del segundo paso, `/reset-password`, no
  cambia — es el que enforca el hook.
- **`revokeSessionsOnPasswordReset: true`.** Un reset suele venir de una cuenta comprometida, así que
  al aplicarlo se **invalidan todas las demás sesiones**: cualquier dispositivo que siguiera logueado
  con la contraseña vieja queda fuera, y quien resetea vuelve a entrar limpio. Se descartó el default
  (`false`, deja las sesiones vivas): más cómodo, pero deja al atacante dentro justo cuando el dueño
  acaba de recuperar la cuenta.
- **Hook `before` para la fuerza de contraseña en `/reset-password`**, igual que sign-up/sign-in. El
  body de BA en ese paso es `{ newPassword, token }`, así que el schema valida **`newPassword`** (no
  `password`). Así la regla de fuerza (8+, mayús/minús/dígito) y su copy siguen viviendo en un solo
  sitio (`@monorepo/validation`) y BA sigue siendo la autoridad de servidor: sin el hook, el reset
  quedaría a merced del `minPasswordLength` por defecto y se podría poner una contraseña débil por el
  endpoint saltándose el form.
- **`/forget-password` NO lleva hook.** La respuesta es neutral pase lo que pase (ver enumeración), y
  un email malformado no matchea a nadie; la validación de shape del email se queda en el front, solo
  por UX.
- **No hay auto-login tras el reset.** `resetPassword` de BA no crea sesión; se manda a `/login` a
  reautenticarse con la contraseña nueva (que acaba de demostrar que conoce). Se descartó encadenar un
  `signIn` automático: haría que un link de reset otorgara sesión activa directa.

### Enumeración: cerrada por diseño, cubre también solo-Google

- `forgetPassword` responde **OK exista o no** el email (BA no delata), y la UI muestra un mensaje
  **neutral** ("si esa dirección tiene cuenta, te enviamos un enlace"), idéntico en ambos casos. Es
  coherente con la postura del login (child PR 3): la enumeración de `/register` se dejó abierta a
  conciencia, pero recuperación y login **siguen cerrados**.
- **Cubre de paso las cuentas solo-Google** sin ramificar: un user sin account `credential` no tiene
  contraseña que resetear, así que BA no manda correo — y no se le puede decir "usas Google" sin
  filtrar que ese email existe. El mensaje neutral es, por tanto, la única copy correcta; no hay un
  branch tipo `useHasPassword` como en el cambio de email, porque aquí es pre-sesión y no sabemos quién
  es.

### Validación (`@monorepo/validation/auth.ts`)

- `resetPasswordSchema = z.object({ newPassword: passwordField })` — reusa el `passwordField`
  existente y sirve **a la vez** al hook `before` del backend y al form de reset del front (el cliente
  llama con `newPassword`, misma clave que el body de BA).
- `forgetPasswordSchema = z.object({ email: emailField })` — solo para el form de solicitud del front.
- **`confirmPassword` NO entra aquí.** Es un campo solo-cliente: BA nunca lo recibe, y este paquete es
  el contrato del wire que el backend enforca. Vive como extensión local del schema en cada form (ver
  abajo).

### Frontend

- **Link "Forgot password?" en `loginForm`** → navega a `/forgot-password`. Login **no** cambia por lo
  demás.
- **Ruta pública `/forgot-password`**: form con email (`zodResolver(forgetPasswordSchema)`) →
  `authClient.requestPasswordReset({ email, redirectTo: `${origin}/reset-password` })`. Al enviar, el
  form se sustituye **inline** por el mensaje neutral (estado de confirmación fijo en pantalla, no un
  toast que desaparece), igual de verdadero exista la cuenta o no.
- **Ruta pública `/reset-password`** (page bajo `src/pages/`, patrón de `/email-verified`): lee el
  `token` de la query, form de nueva contraseña → `authClient.resetPassword({ newPassword, token })`.
  Éxito: toast "Password updated, please log in" + `navigate('/login')`. Token ausente o inválido →
  estado de error con enlace a `/forgot-password`.
- Ambas rutas en `App.tsx` **sin `RequireAuth`** (el link se abre sin sesión), junto a
  `/email-verified` y `/email-change`.

### Confirmar contraseña (reset + register)

- Se añade un campo **confirmar contraseña** al form de reset **y** al de register (login no: no
  aporta). Reduce el lockout por typo en una contraseña que no se ve.
- **Es solo-cliente**: BA no recibe `confirmPassword`. Se modela como **extensión local** del schema
  en cada form (el idioma que ya marca el `CLAUDE.md`: "un form con un campo que el body compartido no
  describe extiende el schema localmente"), nunca en `@monorepo/validation` — meterlo ahí lo mandaría
  al wire y el hook del backend lo exigiría:

  ```ts
  const registerFormSchema = registerSchema
    .extend({ confirmPassword: z.string() })
    .refine((d) => d.password === d.confirmPassword,
      { message: CONFIRM_PASSWORD_MISMATCH, path: ['confirmPassword'] });
  ```

  El reset hace lo mismo sobre `resetPasswordSchema` (clave `newPassword`). En `onSubmit` se
  desestructura `confirmPassword` **fuera** antes de `mutate`, porque `useRegister` hace
  `{ ...credentials }` directo a `signUp.email` y no debe viajar.
- **`CONFIRM_PASSWORD_MISMATCH = 'Passwords do not match'`** va en `frontend/src/utils/validation.ts`,
  junto a `PASSWORD_HINT`: copy presentacional de cliente, no una regla del contrato. Como los dos
  forms que lo consumen son del front, no cruza el límite del paquete `@monorepo/validation`.

### Tests

- **Backend**: `auth.test.ts` pina el rechazo de fuerza en `/reset-password` (copy exacta, flatten,
  y que no eco de la contraseña rechazada), como ya hace con sign-up/sign-in — **+8 tests**, backend
  queda **145/145**. El hook corre `before`, así que 400ea antes de comprobar el token, que es lo que
  deja testearlo sin uno válido. El round-trip real (recibir el correo, pulsar el link con token) es
  **manual** en local, como la verificación y Google — **verificado el 20-08-2026** (correo recibido,
  reset aplicado y login con la contraseña nueva OK).
- **Frontend**: el mismatch de confirmar contraseña se valida en cliente (`zodResolver`); no añade red
  de CI nueva (los tests de front guardan intención, no el pipeline). Sigue **36/36**.

### Setup / prod

- **Sin env ni plumbing nuevos.** Reusa `RESEND_API_KEY`/`RESEND_FROM` (ya en Coolify desde el child
  PR 3) y `CLIENT_URL`. No hay dependencia nueva, así que Docker y Cloudflare Pages no cambian.

### Definición de "hecho" para el child PR 4

- "Forgot password?" en login lleva a solicitar el reset; el correo trae un link con token que abre
  `/reset-password`, y poner una contraseña nueva válida la aplica e invalida las demás sesiones.
- La solicitud responde igual exista o no el email (enumeración cerrada), y una cuenta solo-Google no
  recibe correo sin que la UI lo delate.
- Reset y register piden confirmar contraseña; login no.
- `pnpm typecheck` (back y front) en verde, tests sin regresiones. **✅ 145/145 back, 36/36 front.**
- Verificado a mano en local el round-trip completo de reset. **✅ 20-08-2026.**
