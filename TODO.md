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
- Coste añadido en este proyecto: front y back están en dominios distintos (Netlify / Koyeb), así que la cookie sería cross-site y necesita `SameSite=None; Secure`.
- Alternativa intermedia si el esquema completo es demasiado: `expiresIn` corto + re-login, sin refresh token.

**Suelto, del mismo repaso:**

- `secret` se lee a nivel de módulo (`user.schema.js:6`), igual que en `security/jwt.js`. Si el módulo se carga antes de `dotenv.config()`, el secreto es `undefined` y `jwt.sign` peta. Ya obliga a un workaround en `backend/src/tests/group.test.js`.
- La validación de contraseña en registro está en `middlewares/index.js` (`validatePassword`) pero `auth.routes.js` **no la usa**: registra sin comprobar fuerza de contraseña.

## 2. Miembros de grupo que no son usuarios registrados

**Estado actual (verificado):**

- `createGroup` y `updateGroup` exigen que **todos** los miembros existan ya como `User`: si algún email no resuelve, devuelven 400 `'One or more members do not exist'` (`backend/src/controllers/group.controller.js:29` y `:106`).
- `Group.members[]` solo admite `ObjectId` con `ref: 'User'` (`backend/src/schemas/group.schema.js`). No hay forma de representar a alguien sin cuenta.
- `pay` exige dos cosas (`backend/src/controllers/payments.controller.js:27-37`): ser miembro del grupo, y ser el `from` o el `to` del pago.

**A decidir:**

- El modelo tiene que dejar de asumir que un miembro es un `User`. Opción: `members[]` pasa a `{ user?: ObjectId, name?, email?, status: 'registered' | 'invited' | 'guest' }`. Afecta a `updateBalance()` y `generateDebts()`, que hoy indexan el balance por `user._id`.
- **Invitado con cuenta futura**: se le invita por email, al registrarse se enlaza su `User` con las participaciones que ya tenía. Hay que decidir qué pasa si se registra con un email distinto al de la invitación.
- **Invitado permanente (sin cuenta)**: alguien tiene que poder liquidar deudas en su nombre. ¿Quién? Lo natural es que sea el creador del grupo o cualquier miembro registrado — pero eso relaja justo la restricción de `pay`, así que hay que decidirlo explícitamente y no dejarlo caer por omisión.
- Ojo con la seguridad: si se relaja `pay` para invitados, que la excepción cubra **solo** pagos donde el `from` o el `to` sea un invitado, no cualquier pago del grupo.
- Los emails de invitación pueden ir por SendGrid, que ya está integrado (`backend/src/services/sendgrid.js`), aunque el envío de bienvenida está comentado ahora mismo en `auth.routes.js`.

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
- El backend sí pasa (2/2), así que esto es solo del workspace de frontend.

**A decidir:**

- `Icon` (`src/components/icon/icon.jsx`) es presentacional puro: recibe `variant`, `className`, `handleClick` y devuelve un icono de `react-icons`. Se testea sin providers, en unas seis líneas. Buen primer test real.
- `Header` es más caro: necesita `MemoryRouter` más `AuthProvider` y `DarkModeContextProvider`. Ojo con la rama de usuario logueado, porque renderiza `Notifications`, que abre un socket y hace `getUserSession()`; sin sesión en `localStorage` eso revienta al desestructurar. Testear primero la rama sin token, que no monta `Notifications`, es lo barato.
- Salida rápida si no se quiere escribir tests ahora: borrar las dos plantillas. Deja `pnpm test` en verde de forma honesta en vez de con una suite rota.
- No usar `--passWithNoTests` para taparlo: enmascara el día que un fichero de test deje de ejecutarse por error.

## 5. Migrar react-query v3 a TanStack Query v5

**Estado actual (verificado):**

- `react-query` v3 lleva años sin mantenimiento. Es la **única fuente de vulnerabilidades que queda en producción**: arrastra `brace-expansion` (HIGH) por la cadena `react-query → broadcast-channel → rimraf → glob → minimatch`.
- Bloquea además la subida a React 19: los peer deps de v3 llegan hasta React 18.
- Superficie real: **5 ficheros**. `App.jsx`, `pages/groups/groupDetails/groupDetails.jsx`, `components/user/userEditForm.jsx`, `components/register/registerForm.jsx`, `components/userExpenses/userExpenses.jsx`. En total 4 `useQuery`, 4 `useMutation`, 8 `useQueryClient`, 3 `invalidateQueries`.

**A tener en cuenta al migrar:**

- Cambia el paquete: `react-query` pasa a `@tanstack/react-query`.
- La API pasa de posicional a objeto. Hoy: `useQuery(['groupDetails', groupId], () => getGroupDetails(...), { ... })`. En v5: `useQuery({ queryKey: [...], queryFn: ... })`.
- **`onError` y `onSuccess` desaparecen de `useQuery`** en v5 (siguen existiendo en `useMutation`). Esto afecta directamente a `groupDetails.jsx:19-23`, que usa `onError` para hacer `navigate('/groups')` cuando falla la carga. Hay que reescribir esa redirección leyendo `isError` en el render o en un efecto.
- `isLoading` pasa a llamarse `isPending` en las mutaciones.
- `invalidateQueries` también pasa a firma de objeto: `invalidateQueries({ queryKey: [...] })`.

## 6. Auth con Better Auth (login/register con Google y demás proveedores)

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
- **Cookies cross-site**: front en Netlify y back en Koyeb son dominios distintos, así que la cookie de sesión necesita `SameSite=None; Secure`, `trustedOrigins` en la config, `cors({ credentials: true, origin: CLIENT_URL })` en vez del `cors()` abierto de hoy, y `credentials: 'include'` en el cliente. Mismo peaje que ya se apuntaba en el punto 1.
- **Alternativa si no se quiere pasar a cookies**: Better Auth tiene plugins `bearer` y `jwt` que permiten seguir mandando un token en la cabecera y tocar menos el front. Menos correcto frente a XSS, pero mantiene vivos `authHeaders()` y el `localStorage` actual.
- **Socket.IO**: `socket.server.js` mete al cliente en `user:<userId>` fiándose del `userId` que le manda el propio cliente en el evento `register` — hoy ya es suplantable. Al migrar conviene validar la sesión en el handshake en vez de creerse el payload.
- **Vinculación de cuentas**: alguien registrado con email+contraseña que luego entra con Google usando el mismo email. Better Auth lo cubre con `accountLinking`/`trustedProviders`, pero es una decisión explícita: enlazar automáticamente por email verificado, o pedir que inicie sesión con el método original primero.
- **Contraseñas existentes**: los hashes son bcrypt de `bcryptjs`. Better Auth usa scrypt por defecto, así que o se configura un `password.verify` personalizado para los hashes viejos, o los usuarios actuales tienen que resetear contraseña.
- **Google Cloud**: hay que crear el OAuth client (client ID + secret) y registrar la redirect URI del callback, tanto la de producción como `http://localhost:3001` para desarrollo. Variables nuevas: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y las credenciales del proveedor.
- **Tests**: `bootstrapApp()` monta el router en `/` y no conecta BD. Better Auth sí necesita una BD real, así que los tests de rutas autenticadas tendrían que crear sesiones contra `mongodb-memory-server` en vez de firmar un JWT a mano.
- **Instalación**: `minimumReleaseAge: 4320` en `pnpm-workspace.yaml` bloquea versiones publicadas hace menos de 3 días — Better Auth publica a menudo, así que puede no resolver la última. Y tiene que ir en `dependencies` del backend, no en dev, o el contenedor (`--prod`) se cae al arrancar.
- Confirmar contra la doc de la versión que se instale que el import de CommonJS funciona sin transpilar; el paquete es TypeScript/ESM-first.
