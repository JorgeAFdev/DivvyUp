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
- **`password` sigue sin `select: false`.** La fuga concreta que había —`getGroupDetails` hacía `.populate('members.user')` sin proyección y mandaba el hash bcrypt de todos los miembros en cada carga— se cerró al desplegar la tarea 2: ahora todos los `populate` llevan la proyección `MEMBER_FIELDS`, definida en un único sitio. Pero la defensa de verdad sigue pendiente: `select: false` en el campo, más `.select('+password')` en el login de `auth.routes.js`, que es el único sitio que necesita el hash. Mientras no esté, cualquier `populate` o `findOne` nuevo que se olvide de proyectar vuelve a exponerlo.
- **No hay validación de fuerza de contraseña en ningún sitio.** `auth.routes.js` sólo comprueba que `email` y `password` vengan en el body, así que hoy se puede registrar una cuenta con la contraseña `a`. El único regex que existía (`validatePassword`, 8 caracteres con mayúscula, minúscula y dígito) vivía en `middlewares/index.js`, colgado de `POST /user/create` — una ruta sin auth que el front nunca llamó y que se borró junto con el fichero. Si se reengancha, sale de ahí: `git show HEAD~1:backend/src/middlewares/index.js`.

## 2. Miembros de grupo que no son usuarios registrados — HECHO

**Desplegado el 04-08-2026** (PR #81). Un miembro es un nombre: `members[]` con `_id` propio como
identidad y `user` opcional, así que con una sola cuenta se lleva el grupo entero y quien quiera se
une después por el enlace, eligiéndose de la lista y heredando su historial.

El desarrollo completo, con las decisiones descartadas y por qué, está en
[PLAN-miembros-invitados.md](PLAN-miembros-invitados.md).

## 3. Landing page

**Estado actual (verificado):**

- En `frontend/src/App.jsx:26` la ruta `/` monta `<Layout>` con rutas hijas, pero **no hay ruta índice**. Al entrar en `/` el `<Outlet />` no renderiza nada: se ve el header y el `<main>` vacío.
- El `<Route path="*" element={<NoMatch />} />` **no** cubre este caso: `/` casa exactamente con la ruta padre, así que no cae en el comodín.

**A decidir:**

- Lo mínimo para tapar el agujero es un `<Route index element={...} />` dentro del layout. Redirigir a `/groups` si hay token y a `/login` si no es de una línea, y sirve mientras no exista landing.
- Para la landing de verdad: qué cuenta (el proyecto ya tiene capturas y copy en el `README.md` que se pueden reaprovechar), y si debe redirigir a `/groups` cuando el usuario ya está logueado.

## 4. `pnpm test` del frontend está en rojo

**Estado actual (verificado):**

- `cd frontend && pnpm test` sale con código 1: **2 suites fallidas, 0 tests ejecutados**. El error de las dos es el mismo: `Your test suite must contain at least one test.`
- La causa son los dos únicos ficheros de test, `src/components/header/header.test.jsx` y `src/components/icon/icon.test.jsx`. Son plantillas con **todo el contenido comentado**, y encima importan `./Header` y `./Button`, ficheros que no existen (son `header.jsx` e `icon.jsx`).
- El backend sí pasa (82/82), así que esto es solo del workspace de frontend. Los specs de Cypress también, y son runner aparte: esto es el jest del front.

**A decidir:**

- `Icon` (`src/components/icon/icon.jsx`) es presentacional puro: recibe `variant`, `className`, `handleClick` y devuelve un icono de `react-icons`. Se testea sin providers, en unas seis líneas. Buen primer test real.
- `Header` es más caro: necesita `MemoryRouter` más `AuthProvider` y `DarkModeContextProvider`. Ojo con la rama de usuario logueado, porque renderiza `Notifications`, que abre un socket y hace `getUserSession()`; sin sesión en `localStorage` eso revienta al desestructurar. Testear primero la rama sin token, que no monta `Notifications`, es lo barato.
- Salida rápida si no se quiere escribir tests ahora: borrar las dos plantillas. Deja `pnpm test` en verde de forma honesta en vez de con una suite rota.
- No usar `--passWithNoTests` para taparlo: enmascara el día que un fichero de test deje de ejecutarse por error.

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

## 6. La foto de perfil no debería ser obligatoria — HECHO

**Resuelto en la Fase 4b (PR #79)**, porque era el último obstáculo del camino que abría esa fase:
llegabas por una invitación sin cuenta y tenías que subir una imagen para poder entrar. Fuera el
`required` y el `validate` del formulario; el `append` del multipart sólo viaja si hay fichero, que
antes mandaba el string `"undefined"`; y el avatar cae a la inicial del nombre con `initialsOf()`.
El bug de `updateUser` que se describe abajo también está arreglado: sólo toca `profilePicture`
cuando llega un fichero, así que editar el nombre ya no te borra la foto.

Se queda escrito lo que había, que es de donde salió el diagnóstico:

Hoy no puedes registrarte sin subir una imagen. Debería ser opcional en el registro y quedar como
algo que el usuario añade después editando su perfil, si quiere.

**Estado actual (verificado):**

- El único sitio donde es obligatoria es el front: `registerForm.jsx:110-113` registra el input con
  `required: 'Profile picture is required'` **y** un `validate` que exige `value.length > 0`. El
  backend ya la trata como opcional (`auth.routes.js:15` arranca con `profilePicture = ''` y solo
  sube a Cloudinary `if (req.file)`), y el esquema tiene `default: ''` (`user.schema.js:26-29`).
- Quitar el `required` no basta: `registerForm.jsx:20` hace `formData.append('profilePicture', data.profilePicture[0])`
  sin comprobar nada, así que sin fichero manda el string `"undefined"` en el multipart. Hay que
  meter el `append` dentro de un `if`, como ya hace `userEditForm.jsx:31`.
- El fallback cuando no hay imagen es `https://via.placeholder.com/150`, en `userMenu.jsx:24` y
  `user.jsx:17`. Es un servicio externo de terceros que ya no responde, así que hoy un usuario sin
  foto ve un icono roto — detallado aparte en el **punto 8**. En `group.jsx:67` y `expense.jsx:57` se pasa
  `member.user?.profilePicture` (posiblemente `''`) directamente al `Avatar` de MUI, que en ese caso
  ya cae solo a su fallback.
- **Bug aparte, del mismo repaso:** `user.controller.js:13-14`, al editar el perfil sin subir
  fichero, asigna `profilePicture = req.jwtPayload.profilePicture`. El payload del JWT es
  `{id, name, email}` (`user.schema.js:52-56`), así que eso es `undefined` y el `findByIdAndUpdate`
  **borra la foto que el usuario ya tenía** cada vez que cambia solo el nombre o el email. Lo
  correcto es no incluir el campo en el `$set` cuando no viene fichero.

**A decidir:**

- Avatar por defecto con la inicial del nombre. El `Avatar` de MUI ya lo hace nativo: sin `src`,
  renderiza sus children, así que `<Avatar>{user.name[0].toUpperCase()}</Avatar>` cubre el caso sin
  añadir dependencias. Conviene derivar el color de fondo del nombre (hash → hue) para que cada
  usuario tenga el suyo y sean distinguibles en la lista de miembros de un grupo.
- Encaja con el punto 5: si se hace el auth con Better Auth, el login social ya devuelve la foto del
  proveedor (`user.image` de Google/GitHub) y se puede usar automáticamente, sin pedirle nada al
  usuario. Con lo cual el registro se queda sin campo de imagen: o viene del proveedor, o es la
  inicial, o el usuario la sube luego desde su perfil.
- Ese avatar por inicial sirve también para los miembros invitados del punto 2, que por definición no
  tienen `user` ni foto — hoy caen todos en el mismo `Avatar` vacío y son indistinguibles.

## 7. Sacar las queries de los componentes a hooks

Que cada fichero tenga una responsabilidad: el componente pinta, el hook trae los datos. Hoy la capa de datos está repartida entre los propios componentes en tres estilos distintos.

**Estado actual (verificado):**

- Conviven **tres patrones** para hacer lo mismo:
  1. `useQuery`/`useMutation` escritos dentro del componente: `groupDetails.jsx:21`, `userExpenses.jsx:17`, `registerForm.jsx:36`, `userEditForm.jsx:51`. Son los **únicos 4 ficheros** que usan react-query.
  2. `useEffect` + `useState` + `await` de la función de `utils/*Api.js`, con el estado subido al padre: `groupList.jsx:8-21` (recibe `groups` y `setGroups` por props), `createExpense.jsx:20-30`, `createGroup.jsx:21`.
  3. Mutaciones a pelo en el handler, parcheando a mano el array del padre: `group.jsx:28` y `:46` (`setGroups(prev => prev.map(...) / .filter(...)`), `expense.jsx:21` y `:39`, `debt.jsx:21`.
- `src/hooks/` ya existe pero solo tiene `useConfirmationToast.jsx`. No hay ni un hook de datos.
- `registerForm.jsx:3`, `userEditForm.jsx:4` y `loginForm.jsx:17` llaman a `api` (la instancia de axios) directamente y se saltan `utils/*Api.js`, así que ni siquiera hay una única capa de acceso por recurso.
- Las claves de caché están sueltas como strings en cada componente: `['groupDetails', groupId]`, `['myExpenses']`, `['users']`. `registerForm.jsx:40` invalida `['users']`, clave que **nadie consulta** — invalidación muerta.
- `refreshGroupDetails` se define en `groupDetails.jsx:41` solo para llamar a `invalidateQueries`, y baja por props hasta las hojas (`expenseList` → `expense`, `debtsList` → `debt`, `createExpense`).
- Cada componente repite `const { token } = useAuth()` y se lo pasa a mano a la llamada, porque no hay interceptor de axios.
- `@tanstack/react-query` es **v5** (`frontend/package.json:20`), API de objetos.

**A decidir:**

- Un fichero de hooks por recurso (`hooks/useGroups.js`, `useGroupDetails.js`, `useExpenses.js`, `usePayments.js`) exponiendo `useGroups()`, `useCreateGroup()`, `useDeleteGroup()`… y que el hook coja el token de `useAuth()` por dentro, para que los componentes dejen de pasarlo.
- Centralizar las claves de caché (`hooks/queryKeys.js` o una factoría por recurso) para que las invalidaciones no se desincronicen de las queries.
- Migrar los patrones 2 y 3 se lleva por delante el prop drilling: `setGroups` y `refreshGroupDetails` desaparecen si cada hook invalida su propia clave. Eso cambia la firma de varios componentes (`GroupList` se queda sin props), no es solo mover código.
- ¿Dónde quedan los toasts y el `navigate`? Hoy están dentro de los handlers. Lo limpio es que el hook devuelva estado y el componente decida qué pintar, no que el hook reciba `onSuccess`/`onError` con UI dentro.
- Orden barato → caro: primero extraer los 4 que ya usan react-query (mover código, sin cambio de comportamiento), después migrar los manuales.
- Red de seguridad, a medias: el `pnpm test` del frontend sigue roto (punto 4), pero Cypress ya no. Hay **tres specs y 5 tests en verde** (`create-group`, `smoke-miembros`, `invite-landing`), todos siembran sesión, y entre ellos recorren crear grupo, meter un gasto, el balance, unirse por el enlace y `/my-expenses`. Es suficiente para validar un refactor de la capa de datos de punta a punta; lo que no cubren es nada a nivel de componente.

## 8. El avatar por defecto apunta a un servicio de terceros caído — HECHO

**Resuelto en la Fase 4b (PR #79)**, junto con el punto 6: no queda ninguna referencia a
`via.placeholder.com` en el repo. `userMenu.jsx` y `user.jsx` usan el `Avatar` de MUI con la inicial
del nombre como children, que es lo que ya hacían `group.jsx` y `expense.jsx` para los miembros sin
cuenta.

Se queda escrito lo que había:

Va en su propia rama: no toca nada del contrato de miembros, pero se ve nada más entrar con un
usuario sin foto.

**Estado actual (verificado):**

- La petición a `https://via.placeholder.com/150` falla con `net::ERR_CONNECTION_CLOSED`. No es un
  404 del recurso: la conexión se cierra sin devolver nada, el host ya no sirve.
- Dos usos, los dos como fallback de `profilePicture` vacío:
  - `frontend/src/components/user/userMenu.jsx:24` — la URL acaba en el `src` de un `<Avatar>` de MUI.
  - `frontend/src/pages/user/userProfile/user.jsx:17` — `<img>` pelado, sin fallback: se queda el
    icono de imagen rota del navegador.
- Se dispara siempre que `user.profilePicture` es `''`. Hasta ahora casi ningún usuario caía ahí
  porque todos se habían registrado con imagen; en cuanto la foto sea opcional en el registro
  (punto 6) pasa a ser el caso normal, y ya lo es para las cuentas que crea el e2e.
- El resto de sitios que pintan avatares no dependen del servicio: `group.jsx:67` y `expense.jsx:57`
  pasan `member.user?.profilePicture` directo al `Avatar`, que cae solo a su fallback, y
  `userEditForm.jsx:135` solo renderiza el `<img>` si hay foto.

**A decidir:**

- `userMenu.jsx` es sustitución directa: `<Avatar src={user.profilePicture || undefined}>` con la
  inicial como children. Sin `src`, MUI renderiza los children — ni petición de red ni dependencia
  nueva.
- `user.jsx` usa un `<img>` con estilo propio (`user.module.css`), así que hay que elegir: pasarlo
  también a `Avatar` (las dos vistas quedan iguales y el tamaño se va a `sx`), o dejar el `<img>` con
  un asset local. Para lo segundo, en `public/assets/` solo está `logo.png` y no existe `src/assets/`,
  o sea que habría que crear el SVG.
- Es el mismo avatar por inicial que pide el punto 6 y que necesitan los miembros invitados del
  punto 2, que por definición no tienen `user` ni foto. Mejor un único `components/user/userAvatar.jsx`
  compartido que resolverlo por separado en cada sitio.
- Si se hace antes que el punto 6, el resultado no se nota en producción hasta que haya usuarios sin
  foto; aun así es la dependencia externa que hay que quitar primero, porque el punto 6 la multiplica.

## 9. El header no colapsa en móvil

Que por debajo del breakpoint el header se quede en logo + botón de menú, y que dentro del
desplegable vayan los dos links de navegación, el toggle de tema y la cuenta.

**Estado actual (verificado):**

- `frontend/src/components/header/header.jsx` renderiza dos variantes. Sin token: logo + `Login` +
  `Register` + toggle de tema. Con token: logo, `<nav>` con `Groups` y `Expenses`, y un `<div>`
  derecho con el toggle, `<Notifications />` y `<UserMenu />`.
- `header.module.css` no tiene **ninguna** regla que reorganice el header en pantallas pequeñas:
  `.header` es un flex con `justify-content: space-between` y `width: min(90%, 120rem)`, sin
  `flex-wrap`. Los tres bloques se siguen repartiendo la misma fila por estrecha que sea.
- La única media query del fichero está dentro de `.nav` y va **al revés** de lo que hace falta:
  aplica `margin-left` y `gap: 20px` solo `@media (min-width: 768px)`, así que justo en móvil los dos
  links quedan pegados sin separación.
- El ancho mínimo lo fija sobre todo `.navItem`, con `padding: 10px 20px` por link, más el logo
  (`max-width: 80px`) y el avatar de `UserMenu`.
- `<Notifications />` devuelve `null` (`notifications.jsx`), así que no ocupa ancho: no es el que
  estorba, y puede quedarse montado donde está.
- El toggle sale de `useDarkMode()` del `darkModeContext`. Es de los pocos sitios que quedan usando
  ese contexto, cuando la dirección del proyecto es leer el tema de MUI (`useTheme`).
- `Icon` (`icon/icon.jsx`) mapea un `variant` a un icono de `react-icons`; **no hay variante de
  hamburguesa**, hay que añadirla al `iconsByVariant` en vez de importar el icono suelto en el header.
- MUI 6 está disponible y `UserMenu` ya usa `Menu` + `Avatar` + `IconButton`, así que hay precedente
  para `Drawer` o `useMediaQuery` sin añadir dependencias.

**A decidir:**

- Breakpoint: el CSS ya usa 768px a mano. O se mantiene ese número en el módulo, o se pasa a
  `theme.breakpoints.down('md')` con `useMediaQuery` — pero entonces la decisión de qué se ve vive en
  JS y no en el CSS, y conviene que no esté en los dos sitios a la vez.
- `Drawer` lateral de MUI frente a un `Menu` desplegable bajo el botón. El `Menu` es lo más parecido
  a lo que ya hace `UserMenu`; el `Drawer` va mejor si luego se añaden más entradas.
- La cuenta dentro del colapso: o se reutiliza `<UserMenu />` tal cual (queda un menú dentro de otro
  menú, que es incómodo en táctil), o se aplanan sus items (`Profile` y `Logout`) como entradas
  directas del desplegable y `UserMenu` se queda solo para escritorio.
- La variante sin token también se rompe: son dos links más el toggle. Puede compartir el mismo
  desplegable cambiando solo su contenido, o dejarse tal cual si se decide que tres elementos caben.
- Accesibilidad, que hoy no existe en el header: el botón tiene que ser un `<button>` real con
  `aria-label`, `aria-expanded` y `aria-controls`, cerrarse con `Escape` y al navegar a otra ruta.
  `Icon` renderiza el SVG con un `onClick` encima, sin foco ni rol, así que el botón lo tiene que
  envolver (`IconButton` de MUI ya lo resuelve).
- Sin red de seguridad: `header.test.jsx` es una de las dos plantillas comentadas del punto 4 y
  encima importa `./Header`, que no existe. Si se va a tocar el header, es el momento de escribir ese
  test de verdad — ojo con la rama con token, que monta `Notifications` y necesita sesión en
  `localStorage`.
