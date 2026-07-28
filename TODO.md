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
