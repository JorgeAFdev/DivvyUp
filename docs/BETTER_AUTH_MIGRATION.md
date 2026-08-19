# Migración a Better Auth — plan y registro de decisiones

**Estado: PR core ([#126](https://github.com/DivvyUp-app/DivvyUp/pull/126)) mergeada y en prod
(18-08-2026).** En marcha ahora el **child PR 2 — Google OAuth** (rama `feat/better-auth-google`,
decisiones acordadas el 19-08-2026; detalle abajo). Tarea 5 del [TODO](../TODO.md). El core quedó
todo verde y verificado: backend (`pnpm typecheck` exit 0, **135/135** tests), frontend
(`tsc --noEmit` limpio, **36/36** tests) y **Cypress 13/13** (7 specs) contra la app corriendo en
local. Las env `BETTER_AUTH_SECRET` (secreto propio de prod, distinto del local) y `BETTER_AUTH_URL`
ya están puestas en el dashboard de Coolify.

Este es el documento de referencia de la migración del auth artesanal a
[Better Aut­h](https://better-auth.com). Es la fuente de verdad del plan mientras dure; el `TODO.md`
sólo lleva el epic de alto nivel y un enlace aquí. Cuando cada PR entre y esté en producción, lo que
describe _cómo se comporta el código_ se mueve a `CLAUDE.md` y este fichero se archiva en
`docs/archive/`, conservando sólo lo que no se reconstruye leyendo el repo: qué se decidió y por qué.

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

Este documento detalla el **PR core** (abajo) y el **child PR 2 (Google OAuth)** (al final). Los
child PRs 3–4 se detallarán al abordarlos.

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
