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
- Coste añadido en este proyecto: con el punto 20 hecho, front (`divvyup.jorgeaf.dev`) y back (`divvyup-api.jorgeaf.dev`) van bajo el mismo dominio registrable, así que la cookie es same-site y puede ser `SameSite=Lax` (antes, con Pages + Koyeb en dominios distintos, obligaba `SameSite=None; Secure`).
- Alternativa intermedia si el esquema completo es demasiado: `expiresIn` corto + re-login, sin refresh token.

**Suelto, del mismo repaso:**

- **El `secret` ya se lee en el momento de la llamada**, no a nivel de módulo (arreglado con el paso a ESM, punto 13): `user.schema.js` y `security/jwt.js` leen `process.env.jwt_secret` dentro de `generateJWT()` y del middleware, así que el orden de carga frente a `dotenv.config()` deja de importar y el workaround de los tests desapareció.
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
- Backend es ESM (punto 13) y corre en Node 24 (`node -v` → v24.13.0).

**A tener en cuenta al integrarlo:**

- **Montaje en Express**: el handler de Better Auth (`toNodeHandler(auth)` de `better-auth/node`) tiene que ir **antes de `express.json()`**, porque necesita leer el body crudo. Hoy `src/index.js:10` hace `app.use(express.json())` antes de montar el router; hay que colar el handler por encima.
- **Colisión de rutas**: Better Auth quiere servir en `/api/auth/*` y ahí ya está montado `auth.routes.js` con `/login` y `/register`. O se retiran esas rutas, o se le da a Better Auth otro `basePath`.
- **Adaptador de BD**: `mongodbAdapter` espera un `Db` nativo del driver de mongodb, no Mongoose. Se puede pasar `mongoose.connection.db`, pero **solo después de que `connectDB()` haya resuelto** — hoy `connectDB()` se llama sin await en `index.js:18`, así que el orden de arranque cambia.
- **Dos fuentes de identidad**: Better Auth crea sus propias colecciones (`user`, `session`, `account`, `verification`) al margen de la colección `users` de Mongoose. Hay que decidir si `User` pasa a ser un perfil que referencia al usuario de Better Auth, o si se migran los usuarios existentes conservando el `_id`. La segunda opción es la que no rompe los grupos, expenses y payments que ya existen.
- **Cookies (same-site, ya que el punto 20 está hecho)**: front y back bajo `jorgeaf.dev`, así que la
  cookie de sesión puede ser `SameSite=Lax`. Falta para el camino cookies: `trustedOrigins` en la config
  de Better Auth, `credentials: true` en el `cors` del back (el `origin` ya está atado a `CLIENT_URL`,
  ver *Deployment* en `CLAUDE.md`) y `credentials: 'include'` en el cliente. Mismo peaje que ya se
  apuntaba en el punto 1.
- **El punto 20 (dominios propios) ya está hecho**, así que el camino limpio con cookies está
  disponible: front y back bajo el mismo dominio registrable permiten `SameSite=Lax`, lo que reduce la
  superficie CSRF y esquiva el bloqueo de third-party cookies que hace frágil el montaje cross-site.
  `Lax` no es inmunidad total (Better Auth trae su propia protección CSRF igualmente). La alternativa
  sin cookies es el plugin `bearer`/`jwt` (token en cabecera, sin CSRF), pero mantiene la exposición a
  XSS de hoy.
- **Alternativa si no se quiere pasar a cookies**: Better Auth tiene plugins `bearer` y `jwt` que permiten seguir mandando un token en la cabecera y tocar menos el front. Menos correcto frente a XSS, pero mantiene vivos `authHeaders()` y el `localStorage` actual.
- **Socket.IO**: `socket.server.js` mete al cliente en `user:<userId>` fiándose del `userId` que le manda el propio cliente en el evento `register` — hoy ya es suplantable. Al migrar conviene validar la sesión en el handshake en vez de creerse el payload.
- **Vinculación de cuentas**: alguien registrado con email+contraseña que luego entra con Google usando el mismo email. Better Auth lo cubre con `accountLinking`/`trustedProviders`, pero es una decisión explícita: enlazar automáticamente por email verificado, o pedir que inicie sesión con el método original primero.
- **Contraseñas existentes**: los hashes son bcrypt de `bcryptjs`. Better Auth usa scrypt por defecto, así que o se configura un `password.verify` personalizado para los hashes viejos, o los usuarios actuales tienen que resetear contraseña.
- **Google Cloud**: hay que crear el OAuth client (client ID + secret) y registrar la redirect URI del callback, tanto la de producción como `http://localhost:3001` para desarrollo. Variables nuevas: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y las credenciales del proveedor.
- **Tests**: `bootstrapApp()` monta el router en `/` y no conecta BD. Better Auth sí necesita una BD real, así que los tests de rutas autenticadas tendrían que crear sesiones contra `mongodb-memory-server` en vez de firmar un JWT a mano.
- **Instalación**: `minimumReleaseAge: 4320` en `pnpm-workspace.yaml` bloquea versiones publicadas hace menos de 3 días — Better Auth publica a menudo, así que puede no resolver la última. Y tiene que ir en `dependencies` del backend, no en dev, o el contenedor (`--prod`) se cae al arrancar.
- El paquete es TypeScript/ESM-first, y desde el punto 13 el backend también es ESM, así que se importa de forma nativa sin transpilar.

## 6. Descablear el correo de bienvenida (y los que vengan) con Resend

El servicio de email ya está montado (punto 19), pero no se llama desde ningún sitio: la bienvenida
al registrar sigue **comentada** en `auth.controller.js:54` y ni siquiera importa el módulo.

**A tener en cuenta:**

- Importar `sendEmail` de `services/email.js` y llamarlo tras crear el usuario. **Envolver la
  llamada en el controlador** (`.catch()` o try/catch aparte del flujo de registro) para que un
  fallo de email **no tumbe el registro**: `sendEmail` lanza a propósito, y la bienvenida es
  best-effort.
- Con el remitente de pruebas (`onboarding@resend.dev`) el correo sólo llega al email dueño de la
  cuenta de Resend, así que probarlo con usuarios reales exige verificar antes un dominio (SPF/DKIM),
  que hoy no existe — mismo peaje que apunta el punto 19.
- El reset de contraseña (parte del punto 5) es el otro llamante, y ahí el throw **sí** importa: si
  el correo no se pudo mandar, la operación tiene que fallar de cara al usuario, no seguir como si
  nada.

**Dominio verificado: la entrega a usuarios reales ya no está bloqueada.** El subdominio de envío
`send.jorgeaf.dev` está verificado en Resend (SPF/DKIM/return-path en el DNS de Cloudflare), y el
`from` es `RESEND_FROM=DivvyUp <noreply@send.jorgeaf.dev>`. Con eso `sendEmail` entrega a cualquier
destinatario, no sólo a la cuenta de Resend. Lo que queda de este punto es puramente descablear el
llamante; no hay bloqueante de infraestructura.

Para la historia (por qué se eligió así): la entrega a destinatarios arbitrarios **exige** verificar
el dominio del `from` con control del DNS — no es cosa de Resend, es de cualquier proveedor. Los
subdominios por defecto de Cloudflare Pages y del PaaS del back no valían (su DNS no es nuestro), y un
dominio ajeno al proyecto como `from` se lee como phishing. Se resolvió comprando `jorgeaf.dev` en
Cloudflare y verificando el subdominio `send`.

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

## 11. Las validaciones, a Zod y en un paquete compartido — HECHO el 17-08-2026

Las cinco áreas de entrada (auth, group, expense, payment e invite/join) están en `main` y
desplegadas: cada endpoint declara la forma de su entrada en un esquema Zod de `@monorepo/validation`
en vez de una escalera de `if`. La arquitectura (forma→esquema / BD→controlador, `objectId` y
`decimal.js` compartidos, el `validate` de cuerpo y de params, el contrato de error `{ error: "..." }`
sin tocar) vive en `CLAUDE.md` → *packages/validation*, *Auth* y *Backend request flow*.

Con invite hecho, la revisión de `utils/validation.ts` quedó resuelta: el `cleanName` del `name` del
join se fue al `.trim()` del esquema; `hasDuplicateNames` (group + invite) y `cleanName(creator.name)`
de `createGroup` se quedan porque son BD, no forma. El módulo sobrevive, aún usado por ambos.

## 13. El backend a ESM — HECHO el 08-08-2026

Backend y frontend son ambos ESM ahora. Esto es lo que permite que un paquete compartido (punto 11)
lo consuman los dos sin build dual. Se hizo como paso propio, antes de TypeScript (punto 14), para
que la pasada mecánica se verificara en verde sin ruido de tipos.

**Estado actual:**

- `backend/package.json` lleva `"type": "module"` y se quedan las extensiones `.js`. Los 28 ficheros
  de `src` más `scripts/clean-e2e.js` pasaron a `import`/`export`, con `.js` explícito en cada import
  relativo (ESM no resuelve directorios: `./mongo/connection` pasó a `./mongo/connection/index.js`).
  Los routers importan los controladores como namespace (`import * as groupController`), porque los
  controladores exportan funciones con nombre, no un default.
- **El runner es vitest** (`vitest run --coverage`), no jest. jest y `cross-env` se han quitado de las
  devDependencies; `vitest` y `@vitest/coverage-v8` (`^3.0.8`, ya en el repo por el frontend) entran.
  La config vive en `backend/vitest.config.js`: `globals: true` para que los tests sigan usando
  `describe`/`it`/`expect` sin importarlos, `fileParallelism: false` como equivalente de `--runInBand`
  (cada fichero levanta su propio memory server sobre la conexión global de mongoose, así que se
  corren en serie), y coverage con proveedor `v8`. Los 103 tests siguen en verde.
- **El `secret` ya no se captura en el import.** `jwt.js` y `user.schema.js` leen
  `process.env.jwt_secret` en el momento de la llamada, no a nivel de módulo, así que el orden de
  imports deja de importar (que con ESM es obligatorio: los `import` se izan por encima de cualquier
  sentencia). El workaround por fichero de los tests desaparece: el secreto se pone una sola vez en
  `backend/vitest.setup.js` (`setupFiles`).
- El `require` lazy de `mongodb-memory-server` dentro de `connectDB()` pasó a `await import(...)`,
  dentro de la rama `NODE_ENV === 'test'`. `connectDB()` ya era async.

## 14. TypeScript — HECHO el 14-08-2026

**Backend y frontend a TypeScript estricto, completo.** El plan por fases y las decisiones (qué se
descartó y por qué) están archivados en [docs/archive/ts-migration.md](docs/archive/ts-migration.md);
las reglas vigentes viven en `CLAUDE.md`.

- **Backend (PR #103 + #104):** `src` + tests a `.ts`, `strict`, sin `allowJs`. Mongoose vía
  `InferSchemaType` + tipos hidratados; motor de balances en `services/ledger.ts` y reparto en
  `services/split.ts`. Dev con `tsx watch`, producción `tsc` → `dist/` en Dockerfile multi-stage.
  Puerta `tsc --noEmit` en cada PR.
- **`packages/shared` (#106) + serializadores (#113):** contrato serializado; cada controller tipa su
  respuesta contra el contrato vía `serializers/contract.ts`.
- **Frontend (#105, #107–#111):** `frontend/src` 100% `.ts`/`.tsx` estricto; jest → vitest,
  `prop-types` fuera, react-query/MUI/react-hook-form tipados. `noUnusedLocals`/`noUnusedParameters`
  activos en el gate.

## 15. Contrato de errores por código, como en Cartobol — APLAZADO el 17-08-2026

**Absorbido en el punto 11, aplazado el resto.** Sin multiidioma, devolver un código estable en vez
del mensaje sólo tiene sentido para traducirlo, y no hay i18n ni lo va a haber por ahora. Montar el
error handler global + el diccionario `code → texto` en el front es aparato para un problema que hoy
no existe. Lo único que se rescata —desacoplar la copy del controlador— se resuelve en el 11 metiendo
el texto del error en el esquema de Zod del paquete `packages/validation`, sin cambiar el contrato
`{ error: "..." }` que el front ya consume. **Este punto revive el día que entre multiidioma:** ahí
el mensaje literal deja de valer y hay que pasar a códigos + i18next, y el enum de códigos saldría
del propio `packages/validation` (así front y back no se desincronizan). Hasta entonces, no se hace.

Lo de abajo se conserva como referencia del patrón de Cartobol para cuando se retome.

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

## 19. Cambiar SendGrid por Resend — HECHO el 09-08-2026

El proveedor de email es Resend. El servicio vive en `backend/src/services/email.js`:
`sendEmail(to, subject, text)`, ahora `async`, que instancia `new Resend(process.env.RESEND_API_KEY)`
**en el momento de la llamada** —no a nivel de módulo, el mismo patrón que `jwt_secret` desde el
punto 13, así que el orden frente a `dotenv` deja de importar— y hace `resend.emails.send({...})`. La
firma no cambia respecto a SendGrid, así que el (futuro) llamante no se toca.

**Estado:**

- **El `from` sale de `RESEND_FROM`, con default en código `DivvyUp <onboarding@resend.dev>`** — el
  remitente de pruebas de Resend, que **sólo entrega al email dueño de la cuenta de Resend**. Para
  mandar a usuarios reales hace falta un `from` en un dominio verificado (SPF/DKIM); eso **ya existe**
  (`send.jorgeaf.dev`, verificado al comprar `jorgeaf.dev` — ver punto 9), así que sólo queda rellenar
  `RESEND_FROM` con una dirección de ese dominio, sin tocar código. El envío real depende además de
  descablear el único llamante (punto 6).
- **Resend no lanza en un fallo de envío: devuelve `{ data, error }`.** `sendEmail` mira `error` y
  **lanza** si viene, para que ningún fallo se trague en silencio (el SendGrid anterior ni siquiera
  hacía `await`, así que un fallo era un unhandled rejection). Qué hacer con ese throw es del
  llamante, no del servicio: la bienvenida es best-effort, el reset es crítico.
- **Sigue sin enviarse nada:** el único llamante es la línea comentada de `auth.controller.js:54`.
  Descablearla es el punto 6.
- Dependencia: `resend@^6.18.1` en `dependencies` (no dev, o el contenedor `--prod` se cae al
  arrancar). `@sendgrid/mail` fuera. Variables: `RESEND_API_KEY` (obligatoria) y `RESEND_FROM`
  (opcional). `SENDGRID_API_KEY` y `SENDGRID_EMAIL` retiradas de `.env`, README y `CLAUDE.md`.
- Test: `backend/src/tests/email.test.js` mockea `resend` y fija el payload (from/to/subject/text) y
  que un `{ error }` hace que `sendEmail` rechace.

## 20. Dominio propio (`jorgeaf.dev`) — HECHO el 11-08-2026

Front en `divvyup.jorgeaf.dev` (Cloudflare Pages) y back en `divvyup-api.jorgeaf.dev` (VPS OVH VPS-1
2027 + Coolify). Koyeb dado de baja. El detalle operativo (deploy con polling, los dos tokens, TLS,
el bloqueo del panel, el Bulk Redirect de `pages.dev`, el CORS atado a `CLIENT_URL`) vive en
`CLAUDE.md` → *Deployment*.

Con front y back bajo el mismo dominio registrable, **queda desbloqueado el camino-cookies del punto
5**: la cookie de sesión de Better Auth puede ser same-site (`SameSite=Lax`) en vez de
`SameSite=None; Secure` cross-site.

