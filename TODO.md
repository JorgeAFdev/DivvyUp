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
- **`password` ya tiene `select: false` — HECHO.** El campo se declara con `select: false`
  (`user.schema.js:21-30`) y el único sitio que pide el hash es el login, con
  `.select('+password')` (`auth.routes.js:74`). Al hacerlo apareció una fuga viva que no estaba
  apuntada: `updateUser` devolvía el documento entero de `findByIdAndUpdate`, así que `PATCH
  /user/update` mandaba el hash bcrypt del propio usuario al navegador y lo escribía en los logs
  con su `console.log`. No hizo falta tocar ese controlador: con el `select: false` desaparece de
  los dos sitios, que es justo la diferencia entre proteger el campo y proteger cada llamada.
  Cubierto por `src/tests/auth.test.js` (9 tests, antes no había ninguno de auth): login correcto,
  las dos ramas de credenciales inválidas con el mismo mensaje, que ni login ni register ni
  `PATCH /user/update` devuelven el hash, y que `select('+password')` sigue trayéndolo para que
  `comparePassword` funcione.

  Antes de esto, la primera fuga —`getGroupDetails` hacía `.populate('members.user')` sin proyección y mandaba el
  hash bcrypt de todos los miembros en cada carga— se cerró al desplegar la tarea 2 proyectando
  `MEMBER_FIELDS` en los diez `populate`. Esa proyección se queda como está: sigue haciendo falta
  para no mandar el email de los miembros, pero ya no es lo único que separa el hash del cliente.
- **Validación de fuerza de contraseña — HECHO.** `registrationErrors()` en `auth.routes.js`
  valida nombre, email y contraseña antes de tocar la BD y devuelve 400 con los motivos unidos.
  La regla es `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/`, el `validatePassword` que vivía en el
  `middlewares/index.js` borrado en `796040b`. `registerForm.jsx` valida el mismo patrón y lo
  anuncia junto a la etiqueta.

  Va en el controlador y no en el esquema a propósito: validando arriba, el 400 sale donde se lee
  la petición, y el `catch` vuelve a significar sólo "esto ha fallado de verdad" en vez de tener
  que distinguir un `ValidationError` de un error real. Es también lo que ya decía CLAUDE.md.
  El precio es que la regla vive en dos sitios (controlador y front), que es lo que viene a
  arreglar el punto 11.

  **Corrección de lo que decía este punto:** era falso que se pudiera registrar una cuenta con la
  contraseña `a`. El esquema ya tenía `minlength: 8` y la validación de Mongoose corre *antes* que
  el hook `pre('save')` de bcrypt, así que veía la contraseña escrita y no el hash. Lo que sí
  entraba era cualquier cosa de 8 caracteres: `password` y `12345678` se registraban con un 200.

  Dos cosas que aparecieron al hacerlo:

  - El registro devolvía **500 `Error creating new user`** para cualquier fallo de validación,
    porque llegaba a `save()` y el `catch` genérico se lo tragaba. Le pasaba igual al nombre de
    menos de 3 caracteres y al email mal formado: error del cliente reportado como error de
    servidor, sin decir cuál. Con la validación arriba ya no llega ninguno.
  - La regla **no** puede apoyarse en `minlength`: su mensaje por defecto cita el valor que
    rechaza (`` Path `password` (`a`, length 1) ``), o sea que metería la contraseña en claro en
    el cuerpo de la respuesta y en los logs. El `minlength: 8` del esquema se queda como
    restricción estructural, pero desde el registro ya no lo alcanza nada. Hay tests que fijan
    que ninguna respuesta de error contenga la contraseña.

  Sin migración y sin nadie fuera: la regla sólo corre en el registro, así que las cuentas
  existentes con contraseña débil siguen entrando. Tampoco pueden ponerse al día: **no existe
  endpoint de cambio ni de reset de contraseña**, `user.routes.js` sólo tiene `PATCH /update`
  (nombre, email, foto) y `GET /expenses`. Eso es del punto 5.

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
- El `pnpm test` del front sigue roto (§4), así que la validación es Cypress y nada más. Si se
  arregla el §4 antes, mejor red para este.
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

## 12. El código de auth vive en el router, no en un controlador

`auth.routes.js` es el único router que además implementa. Rompe el patrón del resto de la API y por
eso la validación del punto 1 acabó ahí en vez de junto a las demás.

**Estado actual (verificado):**

- `auth.routes.js` son **121 líneas** con los handlers de `/register` y `/login` dentro. Los otros
  cuatro routers son de 10 a 19 líneas y sólo enganchan ruta con controlador: `expense.routes.js`
  (11), `payment.routes.js` (10), `user.routes.js` (15), `group.routes.js` (19).
- `controllers/` ya tiene `group`, `expense`, `payments` y `user`. **Falta `auth.controller.js`**, que
  es el único hueco del patrón.
- Dentro de esos handlers hay además cosas que no son de una ruta: `registrationErrors()`, los dos
  regex, cuatro `console.time`/`console.timeEnd` de instrumentación y el `sendEmail` de bienvenida
  comentado (`auth.routes.js:46`).

**A decidir:**

- Mover y ya está, o aprovechar para sacar `registrationErrors()` a donde acabe la validación del
  punto 11. Si el 11 se hace antes, este movimiento es casi automático.
- Los `console.time` con etiquetas fijas (`'register user'`, `'query user'`) se pisan si hay dos
  registros a la vez. Al mover conviene decidir si se quedan, porque hoy son la única instrumentación
  de la API.
- `auth.test.js` (21 tests) va contra las rutas, no contra el controlador, así que cubre el
  movimiento entero sin tocarlo. Es refactor puro: si algo se rompe, sale ahí.

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
