# TODO

## 1. Revisar la autenticación completa

**Estado actual (verificado):**

- `generateJWT()` en `backend/src/schemas/user.schema.js:46-59` calcula `expirationDay` (hoy + 60 días) y **nunca lo usa**: la llamada acaba en `jwt.sign(payload, secret, {})` con el objeto de opciones vacío. Los tokens emitidos **no caducan nunca**.
- El token se guarda en `localStorage`, clave `user-session`, junto con los datos de usuario (`frontend/src/utils/localStorage.js:10`). Accesible desde cualquier JS de la página.
- No hay logout de servidor ni forma de revocar un token ya emitido: `logout()` solo borra el `localStorage` (`frontend/src/context/userContextAuth.jsx`).
- No hay refresh token. `jwtMiddleware` (`backend/src/security/jwt.js`) solo verifica firma.

**A decidir:**

- ¿Añadir `expiresIn` al `jwt.sign()`? Es una línea, pero **invalida todas las sesiones activas** en el momento del deploy: los tokens actuales no tienen `exp` y los nuevos sí. Hay que asumir que todo el mundo tiene que volver a loguearse.
- ¿Merece la pena el esquema accessToken (en memoria) + refreshToken (cookie `httpOnly` + `Secure` + `SameSite`)? Es la respuesta correcta al XSS, pero implica: endpoint `/auth/refresh`, almacenar/rotar refresh tokens en BD para poder revocarlos, manejar el arranque de la app (access token en memoria se pierde al refrescar la página, hay que pedir uno nuevo antes del primer render), CORS con `credentials: true` y CSRF al pasar a cookies.
- Coste añadido en este proyecto: front y back están en dominios distintos (Cloudflare Pages / Koyeb), así que la cookie sería cross-site y necesita `SameSite=None; Secure`.
- Alternativa intermedia si el esquema completo es demasiado: `expiresIn` corto + re-login, sin refresh token.

**Suelto, del mismo repaso:**

- `secret` se lee a nivel de módulo (`user.schema.js:6`), igual que en `security/jwt.js`. Si el módulo se carga antes de `dotenv.config()`, el secreto es `undefined` y `jwt.sign` peta. Ya obliga a un workaround en `backend/src/tests/group.test.js`.
- **El login ya no distingue email desconocido de contraseña incorrecta**: ambas ramas responden `Invalid credentials` (arreglado el 04-08-2026, PR #82). `POST /auth/register` sí sigue enumerando, con su `Email already registered`, y ahí la fuga es inherente: no puedes permitir dos cuentas con el mismo correo sin decirlo. Taparla de verdad pide verificación por email, que es del punto 5.
- **`password` con `select: false` y validación de registro en `registrationErrors()` — HECHO** (PR
  #82/#83). Las reglas que dejaron vivas están en `CLAUDE.md`, sección *Auth*. Lo que queda abierto
  de ahí: el regex de fuerza está escrito en `auth.routes.js` y en `registerForm.jsx` a la vez, que
  es lo que viene a arreglar el punto 11.
- **No existe endpoint de cambio ni de reset de contraseña.** `user.routes.js` sólo tiene
  `PATCH /update` (nombre, email, foto) y `GET /expenses`, así que las cuentas creadas antes de la
  regla de fuerza siguen entrando y no pueden ponerse al día. Eso es del punto 5.

## 3. Landing page

**Estado actual (verificado):**

- En `frontend/src/App.jsx:26` la ruta `/` monta `<Layout>` con rutas hijas, pero **no hay ruta índice**. Al entrar en `/` el `<Outlet />` no renderiza nada: se ve el header y el `<main>` vacío.
- El `<Route path="*" element={<NoMatch />} />` **no** cubre este caso: `/` casa exactamente con la ruta padre, así que no cae en el comodín.

**A decidir:**

- Lo mínimo para tapar el agujero es un `<Route index element={...} />` dentro del layout. Redirigir a `/groups` si hay token y a `/login` si no es de una línea, y sirve mientras no exista landing.
- Para la landing de verdad: qué cuenta (el proyecto ya tiene capturas y copy en el `README.md` que se pueden reaprovechar), y si debe redirigir a `/groups` cuando el usuario ya está logueado.

## 5. Auth con Better Auth (login/register con Google y demás proveedores)

Sustituir el auth artesanal por [Better Auth](https://better-auth.com) para tener login social (Google, y GitHub/Apple si interesa) sin escribir el flujo OAuth a mano. Se solapa con el punto 1: si se hace esto, **no tiene sentido montar antes el esquema access + refresh token**, porque Better Auth ya trae sesiones con cookie `httpOnly` y rotación. Decidir primero cuál de los dos caminos se toma.

**Estado actual (verificado):**

- Todo el auth está a mano en `backend/src/routers/auth.routes.js`: `/register` y `/login` con bcrypt (`user.schema.js:33-44`) y `generateJWT()`. No hay verificación de email, ni reset de contraseña, ni proveedores sociales.
- El token viaja en `Authorization: Bearer` y `jwtMiddleware` lo verifica en **19 rutas**; los controladores leen `req.jwtPayload` en **17 sitios**.
- En el front, 22 ficheros tocan `useAuth()`, `getUserSession()` o `authHeaders(token)`. El token se pasa a mano en cada llamada — no hay interceptor de axios donde meter el cambio en un único punto.
- `User` es un modelo de Mongoose (colección `users`) y su `_id` es la identidad que referencian `Group.members[]`, `Expense` y `Payment`. Cualquier migración tiene que preservar esos `_id` o remapear todo el grafo.
- Backend es CommonJS y corre en Node 24 (`node -v` → v24.13.0).

**A tener en cuenta al integrarlo:**

- **Montaje en Express**: el handler de Better Auth (`toNodeHandler(auth)` de `better-auth/node`) tiene que ir **antes de `express.json()`**, porque necesita leer el body crudo. Hoy `src/index.js:10` hace `app.use(express.json())` antes de montar el router; hay que colar el handler por encima.
- **Colisión de rutas**: Better Auth quiere servir en `/api/auth/*` y ahí ya está montado `auth.routes.js` con `/login` y `/register`. O se retiran esas rutas, o se le da a Better Auth otro `basePath`.
- **Adaptador de BD**: `mongodbAdapter` espera un `Db` nativo del driver de mongodb, no Mongoose. Se puede pasar `mongoose.connection.db`, pero **solo después de que `connectDB()` haya resuelto** — hoy `connectDB()` se llama sin await en `index.js:18`, así que el orden de arranque cambia.
- **Dos fuentes de identidad**: Better Auth crea sus propias colecciones (`user`, `session`, `account`, `verification`) al margen de la colección `users` de Mongoose. Hay que decidir si `User` pasa a ser un perfil que referencia al usuario de Better Auth, o si se migran los usuarios existentes conservando el `_id`. La segunda opción es la que no rompe los grupos, expenses y payments que ya existen.
- **Cookies cross-site**: front en Cloudflare Pages y back en Koyeb son dominios distintos, así que la cookie de sesión necesita `SameSite=None; Secure`, `trustedOrigins` en la config, `cors({ credentials: true, origin: CLIENT_URL })` en vez del `cors()` abierto de hoy, y `credentials: 'include'` en el cliente. Mismo peaje que ya se apuntaba en el punto 1.
- **Alternativa si no se quiere pasar a cookies**: Better Auth tiene plugins `bearer` y `jwt` que permiten seguir mandando un token en la cabecera y tocar menos el front. Menos correcto frente a XSS, pero mantiene vivos `authHeaders()` y el `localStorage` actual.
- **Socket.IO**: `socket.server.js` mete al cliente en `user:<userId>` fiándose del `userId` que le manda el propio cliente en el evento `register` — hoy ya es suplantable. Al migrar conviene validar la sesión en el handshake en vez de creerse el payload.
- **Vinculación de cuentas**: alguien registrado con email+contraseña que luego entra con Google usando el mismo email. Better Auth lo cubre con `accountLinking`/`trustedProviders`, pero es una decisión explícita: enlazar automáticamente por email verificado, o pedir que inicie sesión con el método original primero.
- **Contraseñas existentes**: los hashes son bcrypt de `bcryptjs`. Better Auth usa scrypt por defecto, así que o se configura un `password.verify` personalizado para los hashes viejos, o los usuarios actuales tienen que resetear contraseña.
- **Google Cloud**: hay que crear el OAuth client (client ID + secret) y registrar la redirect URI del callback, tanto la de producción como `http://localhost:3001` para desarrollo. Variables nuevas: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y las credenciales del proveedor.
- **Tests**: `bootstrapApp()` monta el router en `/` y no conecta BD. Better Auth sí necesita una BD real, así que los tests de rutas autenticadas tendrían que crear sesiones contra `mongodb-memory-server` en vez de firmar un JWT a mano.
- **Instalación**: `minimumReleaseAge: 4320` en `pnpm-workspace.yaml` bloquea versiones publicadas hace menos de 3 días — Better Auth publica a menudo, así que puede no resolver la última. Y tiene que ir en `dependencies` del backend, no en dev, o el contenedor (`--prod`) se cae al arrancar.
- Confirmar contra la doc de la versión que se instale que el import de CommonJS funciona sin transpilar; el paquete es TypeScript/ESM-first.

## 10. `react-router` 7.18.1 tiene un aviso de seguridad, y el parche es un major

**Decidido el 04-08-2026: se hace, pero más adelante y en su propia rama.** No estamos afectados hoy
(ver abajo), así que no es urgente y no se cuela en ningún otro PR: subir de major el router que
gobierna todas las rutas necesita su rama, su PR y una pasada completa de Cypress.

**Estado actual (verificado):**

- `pnpm audit --prod`, que es lo que de verdad se despliega, devuelve **una sola** vulnerabilidad:
  `react-router` >=7.12.0 <8.3.0, severidad alta, *RSC Mode CSRF Bypass*
  ([GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)). El resto de avisos que
  enseña GitHub en cada push son de dependencias de desarrollo.
- **La exposición real aquí es prácticamente nula**: el fallo es del modo RSC y esta app no usa React
  Server Components ni el router de datos. No hay `createBrowserRouter` ni nada de `@react-router/server`.
  Los 15 imports de `react-router-dom` que hay en `src/` son la API declarativa (`BrowserRouter` en
  `App.jsx:2`, más `Link`, `Navigate`, `Outlet`, `useNavigate`, `useParams`, `useLocation`): ni un
  `loader` ni una `action` en todo el front. Y las mutaciones van por axios contra Express con
  `Authorization: Bearer` explícito, que no viaja solo en una petición cross-site, así que el vector
  CSRF clásico tampoco aplica.
- El parche es `>=8.3.0`, o sea **subir de major**, en la librería que gobierna todas las rutas,
  incluida `/join/:inviteCode` y el `RequireAuth` que conserva el destino.

**A tener en cuenta cuando se haga:**

- No es un `pnpm update`: hay que leer la guía de migración de v7 a v8 y volver a pasar los cinco
  specs de Cypress, que son la única red que cubre el enrutado.
- Ojo con `minimumReleaseAge: 4320` en `pnpm-workspace.yaml`: una versión publicada hace menos de
  tres días no resuelve.
- La ruta que más vigilar es `/join/:inviteCode` y el `RequireAuth` que conserva el destino
  (`components/auth/requireAuth.jsx`), porque es lo último que se montó y lo que peor se ve si se
  rompe: `useLocation` y `Navigate` con `state` son justo lo que toca una migración de router.
- Los 36 tests de jest del front no tocan el enrutado, así que la validación real es Cypress y nada
  más.
- Cambia el estado del riesgo si algún día se plantea SSR o RSC en el front: en cuanto se escriba la
  primera server action, esto pasa de aplazable a bloqueante y hay que subir antes.

## 11. Las validaciones, a Zod y en un paquete compartido

Que cada endpoint declare la forma de su entrada en un esquema y no en una escalera de `if`. Hoy la
validación existe, pero está escrita a mano y repetida.

**Decidido el 04-08-2026:**

- **Una sola fuente de verdad, compartida entre backend y frontend.** No es Zod suelto en cada lado
  repitiendo los regex: es un tercer paquete del workspace que los dos importan. Si no se comparte,
  la tarea no vale la pena, porque lo que duele es la duplicación, no la escalera de `if`.
- **Sólo forma de entrada.** Lo que necesita la BD (que el grupo exista, que el miembro pertenezca,
  que los `amountOwed` sumen el total) se queda en el controlador del backend y no entra al paquete.
- **El backend pasa a ESM** (punto 13) y **el proyecto a TypeScript** (punto 14). Las dos deshacen
  las restricciones que hacían fea esta tarea, así que van antes.
- **Los mensajes no se comparten: viaja un código de error** y la copy es del front (punto 15).

Con eso, el orden es **13 → 14 → 15 → 11**, y el 12 cae solo por el camino. Ninguna de las cuatro
depende de este punto, así que se pueden hacer y desplegar sueltas.

**Estado actual (verificado):**

- **33 `res.status(400)`** repartidos por los controladores: 16 en `group.controller.js`, 12 en
  `expense.controller.js`, 4 en `auth.routes.js` y 1 en `payments.controller.js`. Cada uno con su
  propio `if` y su propio texto.
- No hay `middlewares/`: sus tres helpers murieron con las rutas que los usaban (`796040b`), así que
  no queda ni un punto común donde enganchar nada.
- La regla de contraseña del punto 1 vive **en dos sitios a la vez**: `registrationErrors()` en
  `auth.routes.js` y el `pattern` de `registerForm.jsx`. Son el mismo regex copiado, y nada obliga a
  que sigan iguales.
- `zod` **no está instalado** en ninguno de los dos workspaces.
- Formato de error actual: `{ error: "motivo. otro motivo" }`, motivos unidos con `. `. Zod devuelve
  un array de issues con `path`, que es más útil para pintar el error junto a su campo pero **cambia
  el contrato** de la API.

**Las dos cosas que rompen esto, las dos comprobadas.** (La tercera, que jest no puede consumir un
paquete ESM, se la lleva por delante el punto 13.)

- **El Dockerfile no lo copiaría.** `backend/Dockerfile` copia explícitamente los manifiestos raíz,
  `backend/package.json`, `frontend/package.json` y `backend/src`. Un `packages/contracts/` nuevo no
  entra: el `pnpm install --frozen-lockfile` falla porque el lockfile referencia un miembro del
  workspace que no está en la imagen, y aunque pasara, el código no estaría para requerirlo en
  runtime. Hacen falta dos `COPY` más.
- **El build de Cloudflare Pages tampoco.** El comando es
  `pnpm install --frozen-lockfile --filter @monorepo/frontend`, **sin los tres puntos finales**, así
  que selecciona sólo ese paquete y no sus dependencias del workspace. Tiene que pasar a
  `--filter @monorepo/frontend...`, como ya hace el Dockerfile con el backend. Y vive en el panel de
  Pages, no en el repo, así que no se ve en ningún diff.

Además, `pnpm-workspace.yaml` declara `backend` y `frontend` uno a uno, no con un glob, así que el
paquete nuevo hay que añadirlo ahí a mano.

**A decidir, lo que queda:**

- **Cómo se llama y dónde vive.** `packages/contracts`, `packages/validation`, `shared/`. Con TS
  hecho (punto 14) el formato ya no es una decisión: ESM + TS compilado, como los otros dos.
- **¿Sólo esquemas, o también los tipos de las respuestas?** Un paquete de contratos que declare
  también la forma de lo que devuelve la API es más útil que uno de sólo validación, pero es más
  superficie que mantener y no hace falta para cerrar la duplicación de hoy.
- **`login` no puede usar el mismo esquema que `register`.** El registro exige la regla de fuerza;
  el login tiene que aceptar cualquier cosa que un usuario antiguo tenga guardada, o dejas fuera a
  las cuentas creadas antes de la regla. Son dos esquemas, no uno reutilizado.
- Zod tiene que ir en `dependencies` del backend, no en dev, o el contenedor (`--prod`) se cae al
  arrancar. Y ojo con `minimumReleaseAge: 4320`.
- En el front, `react-hook-form` ya está y tiene `@hookform/resolvers/zod`, así que el formulario
  validaría con el mismo esquema en vez de con `pattern` a mano.
- ¿Middleware genérico (`validate(schema)` delante de cada ruta) o `schema.safeParse(req.body)` al
  principio de cada controlador? Lo primero saca la validación del controlador del todo, pero
  reintroduce el `middlewares/` que se borró.
- En el front, `react-hook-form` ya está y tiene `@hookform/resolvers/zod`, así que el formulario
  pasaría a validar con el mismo esquema en vez de con `pattern` a mano.
- Cambiar el formato del error toca el front: hoy los componentes pintan `error` como un string.
  O se mantiene la forma actual aplanando los issues de Zod, o se migran los consumidores.
- Hay red de seguridad razonable: los 103 tests del backend cubren buena parte de esos 400, así que
  el refactor se puede hacer sin adivinar. `auth.test.js` fija los del registro con el texto exacto.

## 13. El backend a ESM

Hoy el backend es CommonJS y el frontend ESM. Unificar los dos es lo que permite que un paquete
compartido (punto 11) lo consuman ambos sin build dual, y es la preferencia declarada.

**Estado actual (verificado):**

- **99 `require()` en 28 ficheros** de `backend/src`, más sus `module.exports`. Es mecánico, pero hay
  que pasarlo entero: no se puede migrar a medias dentro de un mismo paquete.
- **El problema real no es el código, es jest.** El backend corre jest **sin `jest.config` y sin
  `babel.config`**, o sea CommonJS puro sin transform. Un `export` ahí peta con
  `SyntaxError: Unexpected token 'export'` (comprobado). ESM en jest pide
  `--experimental-vm-modules` más `extensionsToTreatAsEsm`, o meter un transform.
- **Los 103 tests no usan ni un mock de jest**: ni `jest.fn()`, ni `jest.mock()`, ni spies. Sólo
  `describe`/`it`/`it.each`/`expect`/`beforeAll`/`beforeEach`/`afterAll`, supertest y la BD en
  memoria. Todo eso es API que vitest ya cubre con el mismo nombre.
- **vitest ya está en el repo**, como devDependency del frontend (`vitest ^3.0.8`, más
  `vitest.workspace.js` para el addon de Storybook). No sería una dependencia nueva en el monorepo.
- `node:22-slim` en el Dockerfile y v24.13.0 en local: los dos soportan ESM nativo de sobra.
- Ojo con dos sitios que dependen de CommonJS por motivos que no son de estilo: el `require` **lazy**
  de `mongodb-memory-server` dentro de `connectDB()` (es devDependency y no está en la imagen de
  producción, por eso no puede ser un import de nivel superior) y el `secret` que `user.schema.js` y
  `security/jwt.js` leen **en el momento del import**, que ya obliga al workaround de
  `group.test.js`. Con ESM los imports se evalúan antes, así que ese orden hay que revisarlo.

**A decidir:**

- **jest con ESM, o cambiar a vitest.** Yo iría a vitest: resuelve ESM y TypeScript (punto 14) sin
  configurar nada, ya está en el repo, y la migración es casi renombrar el script porque no hay
  mocks. `--runInBand` pasa a ser `--no-file-parallelism` o `pool: 'forks'`, que sigue haciendo falta
  porque los tests comparten BD.
- El `require` lazy de `mongodb-memory-server` pasa a `await import()`, que obliga a que `connectDB()`
  siga siendo async. Ya lo es.
- Si se hace junto al punto 14 o antes: hacer los dos a la vez es un diff enorme; hacer ESM primero
  y TS después son dos pasadas por los mismos 28 ficheros. No hay respuesta obvia.

## 14. TypeScript

**Decidido el 04-08-2026: sí.** El proyecto es lo bastante pequeño como para que la migración no sea
tediosa, y es lo que hace que Zod (punto 11) aporte tipos y no sólo validación en runtime.

**Estado actual (verificado):**

- Ni `typescript` ni `tsconfig.json` en ningún workspace. Nada empezado.
- Backend: 28 ficheros en `src/`. Frontend: JSX con `prop-types` como devDependency, que TS deja
  obsoleto en cuanto entra.
- El backend se despliega en Docker: con TS aparece un paso de build que hoy no existe, y el
  `COPY backend/src ./backend/src` del Dockerfile pasa a copiar el compilado, no el fuente.
  Alternativa sin build: dejar que el runtime ejecute TS directamente, que Node 22+ ya hace con
  `--experimental-strip-types`, pero eso ata la imagen a esa bandera.
- Cloudflare Pages compila el front con Vite, que ya entiende TS sin configurar nada. Ese lado es
  gratis.

**A decidir:**

- **Alcance y orden.** Los tres paquetes de golpe, o backend primero (donde Zod aporta más) y front
  después. Migrar `.jsx` a `.tsx` con MUI y react-hook-form tipados es donde está el trabajo de
  verdad.
- **Cuánto rigor**: `strict: true` desde el principio duele más al migrar pero es lo único que
  justifica la tarea. `allowJs` permite convivencia fichero a fichero y hace la migración gradual.
- El `Decimal` de decimal.js y los `ObjectId` de Mongoose son los dos puntos donde los tipos se
  vuelven incómodos. Merece la pena mirarlos antes de comprometerse con `strict`.

## 15. Contrato de errores por código, como en Cartobol

Que la API deje de devolver una frase en inglés y devuelva un código estable, y que el front lo
traduzca. Es el patrón que ya existe en Cartobol y funciona.

**Cómo está en Cartobol (leído del repo):**

- `backend/src/middlewares/errorHandler.js` es un middleware de error único que responde siempre
  `{ error: { code, details } }`. Mapea lo conocido (Prisma `P2002` → `DUPLICATE_FIELD`, `P2025` →
  `RESOURCE_NOT_FOUND`, Stripe `resource_missing` → 404) y cae a `INTERNAL_SERVER_ERROR`. Un error
  que ya trae `status` y `code` se responde tal cual.
- Los validadores no escriben prosa: `withMessage('VALIDATION_PASSWORD_TOO_SHORT')`, o sea el mensaje
  **es** el código.
- `frontend/src/utils/apiError/getApiErrorCode.js` es de una línea:
  `err?.response?.data?.error?.code || 'INTERNAL_SERVER_ERROR'`.
- `useApiErrorToast` traduce `errors.${code}` por i18n, con un `ERROR_NAMESPACE` que dice en qué
  namespace vive cada código y un `err.handled` para que un caller pueda marcarlo como ya tratado.

**Lo que cambia respecto a DivvyUp:**

- Hoy la API devuelve `{ error: "Password must be at least 8 characters long and..." }`: prosa en
  inglés, generada en el controlador. Todos los consumidores del front la pintan como string.
- No hay middleware de errores: cada controlador hace su `try/catch` y su `res.status(500)`. Son
  **33 `res.status(400)`** y sus 500 correspondientes, cada uno con su texto.
- No hay i18n en el front. Sin él, el código tiene que resolverse contra un diccionario en alguna
  parte igualmente, así que o entra i18next o se hace un mapa `code -> texto` a mano.

**A decidir:**

- **Si entra i18n o no.** El patrón de Cartobol se apoya en `react-i18next`. En DivvyUp no hay nada,
  y montar i18n para traducir errores a un solo idioma es mucho aparato. Un mapa
  `code -> texto` en el front da el 90% del valor (desacoplar copy de API) sin la dependencia, y deja
  la puerta abierta.
- **Cuánto se migra de golpe.** El contrato nuevo rompe a todos los consumidores actuales. O se migra
  todo a la vez, o se responden código y mensaje a la vez durante una temporada.
- **De dónde salen los códigos.** Si el paquete compartido del punto 11 exporta los esquemas de Zod,
  lo natural es que exporte también el enum de códigos, y entonces front y back no pueden
  desincronizarse. Ese es el argumento más fuerte para hacer el 15 después del 11 y no antes.
- Cartobol usa express-validator y **no comparte los validadores con el front**: su fuente única son
  los códigos, no las reglas. Aquí se quiere lo segundo también, así que este punto es la mitad del
  patrón, no el patrón entero.

## 17. Un `Button` propio, reutilizable y que pase WCAG

Hoy conviven **dos implementaciones de botón sin nada en común**: los formularios usan `<button>`
nativo con su propio CSS Module, y el resto de la app usa `@mui/material/Button` con su `sx` copiado.
Ninguna de las dos pasa el contraste mínimo de AA, y entre las dos hay tres azules distintos.

**Estado actual (verificado):**

- **Nativos, con CSS Module propio:** `loginForm.jsx:65`, `registerForm.jsx:136`, `expenseForm.jsx:118`, `groupForm.jsx:115` y `:123`, `userEditForm.jsx:146`,
  `userEdit.jsx:11`, `join.jsx:81` y `:119`, `logout.jsx:19`.
- **De MUI, con `sx` a mano:** `debt.jsx:35`, los dos de `useConfirmationToast.jsx`, los cinco de
  `groupActions.jsx`, los tres de `expenseActions.jsx`, y `join.jsx:54` y `:114`.
- La duplicación es literal, no parecida. `.submitButton` de `expenseform.module.css` y el de
  `groupform.module.css` son **byte a byte el mismo bloque** (nueve declaraciones). `.loginSubmitBtn`
  y `.registerSubmitButton` son el mismo bloque con las declaraciones en otro orden. Del lado de MUI,
  `debt.jsx:40` y `useConfirmationToast.jsx:26` repiten `borderRadius: "8px", textTransform: "none",
  fontWeight: "bold"`, y los ocho de `groupActions`/`expenseActions` repiten
  `color: textColor, minWidth: '0px'` resolviendo el color con su propio `useTheme()`.
- **Tres azules de botón, sin relación entre ellos.** Los formularios de auth y de perfil usan
  `#007bff` con hover `#0056b3`, que es el azul de Bootstrap y no aparece en ningún otro sitio de la
  app. Los formularios de gasto y grupo usan `var(--primary-color-dark)` (`#3c8ccd`). `join.jsx:54`
  hereda `palette.primary` (`#1e90ff`). Ese `#007bff` es el único hex de color que quedó sin
  centralizar en el tema, precisamente porque vive en botones.
- **Contraste con texto blanco:** `#1e90ff` **3.24:1**, `#3c8ccd` **3.61:1**, `#007bff` **3.98:1**.
  AA pide 4.5:1 para texto normal, así que **ningún botón de la app lo pasa**. El único que llegaba
  era `join.jsx:54` cuando heredaba el `#1976d2` por defecto de MUI (4.60:1), hasta que el tema pasó
  a declarar `palette.primary`. Curiosamente el hover de login/register, `#0056b3`, da 7.04:1: el
  estado de reposo suspende y el de hover aprueba.
- No hay `Checkbox` ni `TextField` de MUI en el proyecto: los formularios son HTML nativo, así que la
  superficie a cubrir son botones e iconos, nada más.

**A decidir:**

- **Si el azul de marca se toca.** Es la raíz: mientras `#1e90ff` siga siendo el primary, un `Button`
  propio hereda el mismo suspenso. Sobre blanco hace falta bajar a algo del orden de `#0b6ecf` para
  llegar a 4.5:1, y eso repinta cabecera, títulos e iconos, no sólo los botones. La alternativa es
  reservar el azul claro para superficies grandes y usar el oscuro sólo para texto.
- **Si el componente envuelve a MUI, o es `<button>` nativo.** Envolver mantiene el ripple, el
  `disabled` y el anillo de foco que MUI ya resuelve; ir a nativo quita una capa y unifica con los
  formularios, que son mayoría (diez sitios contra doce), pero obliga a reimplementar el foco visible.
  Mezclar las dos es lo que hay hoy.
- **Qué variantes hacen falta.** Del inventario salen cinco formas reales: submit de formulario
  (relleno), acción principal (relleno), botón de menú con icono y texto, botón sólo icono, y enlace
  sin fondo (`addBtn`, `join.jsx:119` y `logout.jsx`, los tres con `all: unset` o equivalente).
- **`loginForm.jsx:65` ya es un `<button type="submit">`** — era el único `<input type="submit">` de
  la app, y como no admite hijos habría obligado al componente a soportar dos elementos distintos.
  Convertido por adelantado: ningún spec de Cypress envía ese formulario por UI, y los que sí envían
  otros ya usan el selector `button[type="submit"]`.
- Lo demás de WCAG que ya falta hoy: los dos botones que abren el menú de acciones
  (`groupActions.jsx:72`, `expenseActions.jsx:28`) contienen sólo un `<Icon variant='dots' />` y no
  tienen nombre accesible — `Icon` renderiza el SVG de `react-icons` sin `title`, `aria-label` ni
  `role`. Los de dentro del menú sí lo tienen, porque llevan texto visible. El foco de teclado se ve
  sólo con el outline por defecto del navegador.

## 18. El desplegable móvil a un `Drawer` (opcional)

El header colapsado usa `Menu` a propósito, y para lo que hay dentro hoy sigue siendo la elección
correcta:
cinco entradas, y **el paper mide 111.6 x 290 px, el 29% del ancho y el 34% del alto** de una pantalla
de 390px (medido con Playwright a 390x844, no estimado). Un panel de altura completa serían ~550px
vacíos para el mismo contenido.

Lo que cambia eso es querer meter dentro algo que no cabe. Dos cosas, y cualquiera de las dos basta:

- **Que móvil muestre quién eres.** Hoy no lo muestra: en escritorio `UserMenu` pinta el avatar, en
  móvil sólo hay una hamburguesa, así que no hay forma de saber en qué cuenta estás. Una fila de
  cabecera con avatar y nombre (el `MemberAvatar` ya existe) no entra en un paper de 112px de ancho;
  en un `Drawer` es su sitio natural.
- **Que el menú pase de ~7-8 entradas.** A partir de ahí el paper flotante empieza a competir con el
  alto de la pantalla, y el `Drawer` deja de ser cromo de sobra.

**Qué arrastra el cambio (verificado sobre el código de hoy):**

- **`AppMenu` deja de servir para el header.** Su `sx` va sobre el `MuiPaper-root` de un `Menu`; un
  `Drawer` tiene su propio paper y su propio backdrop. O el `Drawer` se estiliza aparte —y entonces
  hay dos sitios que deciden cómo se ve una superficie desplegable, que es justo lo que `AppMenu`
  vino a evitar— o la pieza compartida pasa a ser el estilo y no el componente. `UserMenu` seguiría
  con `Menu` en escritorio en cualquier caso.
- **Los items dejan de ser `menuitem`.** Dentro de un `Drawer` son `ListItemButton` en una `List`, con
  rol `button`. La aserción de orden de `header.test.jsx` va por `getAllByRole('menuitem')`, así que
  hay que reescribirla. Es el único test que se rompe, y el orden que fija (`Groups`, `Expenses`,
  `Profile`, `Dark mode`, `Logout`, con `Logout` último y aislado) tiene que sobrevivir al cambio.
- **La semántica ARIA de la hamburguesa cambia.** Hoy lleva `aria-haspopup="true"`, `aria-controls` y
  `aria-expanded`, que describen un menú. Un `Drawer` es un diálogo: sería `aria-haspopup="dialog"`,
  y el `aria-labelledby` del `MenuList` pasa a ser el título del panel. Escape y click-fuera los sigue
  dando MUI, que en `Drawer` es un `Modal`.
- **El ancho y el toque se arreglan de paso.** Un `Drawer` es edge-to-edge o de ~280px, así que el
  29% de ancho deja de existir. Los items ya miden 48px de alto, que es la guía de Android y pasa el
  mínimo de WCAG 2.5.8, así que eso no cambia.

**Si esto no se hace, queda pendiente el pulido del `Menu`:** un `minWidth` del orden de 180px en el
paper —y ahí hay que decidir si va en `AppMenu`, que ensancha también el menú de escritorio donde a
nadie molesta, o sólo en el del header— y **subir la hamburguesa de 42 x 42 a 48**, que es lo único
que está por debajo de mínimos (44 de iOS, 48 de Android) y sale del `padding: 8px` por defecto del
`IconButton`. Ojo con el orden: el `minWidth` es trabajo que el `Drawer` tira a la basura, el de la
hamburguesa no, porque el botón se queda igual. Y el mínimo de 48 para botones de sólo icono es la
misma conversación que el punto 17.

