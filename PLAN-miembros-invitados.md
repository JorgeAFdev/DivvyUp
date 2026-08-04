# Plan — Miembros de grupo que no son usuarios registrados

Desarrollo de la tarea 2 del [TODO](TODO.md). Decisiones cerradas el 30-07-2026.
Este fichero es la fuente de verdad del alcance: si algo no está aquí, no entra.

Modelo de referencia: **Tricount**. Un miembro se crea escribiendo un nombre; enlazar una cuenta
a ese miembro es una acción posterior, opcional, y la hace la propia persona.

➜ Progreso paso a paso en [Estado de ejecución](#estado-de-ejecución), al final del fichero.

## Propósito

**Con una sola cuenta se puede llevar el grupo entero.** Creas el grupo escribiendo nombres,
metes gastos, ves balances y liquidas deudas sin que nadie más se registre. Que los demás se unan
es una mejora opcional encima, no un requisito para empezar.

Un miembro de grupo deja de ser una cuenta y pasa a ser **un nombre**. La cuenta es un atributo
que puede engancharse después, o nunca.

Ese es el criterio con el que se juzga cualquier decisión de este plan: si algo obliga a esperar a
que otra persona actúe para que el grupo funcione, está mal.

Con un solo mecanismo se cubren los dos casos:

- **Invitado permanente** — nunca tendrá cuenta (la madre de alguien, un compañero de piso del
  que sólo sabemos el nombre) y el grupo cuadra igual, desde el primer segundo.
- **Invitado con cuenta futura** — recibe el enlace del grupo, se registra o inicia sesión, se
  elige de la lista y a partir de ahí es miembro con cuenta, heredando todo el historial que ese
  miembro ya tenía: sus gastos, su balance y sus deudas pendientes.

El bloqueo que se elimina: hoy `createGroup` y `updateGroup` devuelven
400 `'One or more members do not exist'` si algún email no resuelve a un `User`
(`backend/src/controllers/group.controller.js:29` y `:106`), así que **no puedes crear un grupo
hasta que todos se hayan registrado** — la app es inservible hasta que el último de tus amigos se
haya dado de alta.

## Modelo: la identidad es el miembro, no la cuenta

```js
// group.schema.js
{
  name, description,
  inviteCode: { type: String, unique: true, index: true },
  members: [{
    // _id: lo pone Mongoose. ES la identidad de gastos, balances y pagos.
    name: { type: String, required: true, trim: true },
    user: { type: ObjectId, ref: 'User', default: null }   // null = sin cuenta enlazada
  }],
  balance: [{ member: ObjectId, amount: Number }]
}

// expense.schema.js
paidBy:       { type: ObjectId, required: true }                    // _id de miembro, sin ref
participants: [{ member: { type: ObjectId, required: true }, amountOwed: Number }]

// payment.schema.js
from: ObjectId, to: ObjectId                                        // _ids de miembro
```

**Unirse a un grupo es `members[i].user = userId`.** Un campo. Nunca hay fusión de identidades ni
reescritura de gastos, porque el `_id` del miembro no cambia jamás.

`user.schema.js`, `auth.routes.js` y `services/sendgrid.js` **no se tocan**.

### Por qué no el usuario-sombra

La alternativa era que un invitado fuese un documento `User` con `accountStatus: 'invited'`, lo
que dejaba intactos los refs, los `populate` y el motor de balances. Se descartó al decidir que
unirse exige tener cuenta: en ese escenario reclamar un miembro con historial obliga a reescribir
`Group.members`, `Group.balance`, `Expense.paidBy`, `Expense.participants` y `Payment.from/to` de
ese grupo y a borrar la sombra. La ventaja principal del usuario-sombra —que reclamar era
gratis— desaparecía, y quedaban sólo sus costes: sombras huérfanas en `users` para siempre,
índice de email a sparse y migración manual del índice en producción.

### El coste que sí se asume

`populate` **no puede resolver un ref que apunta dentro del array de subdocumentos de otro
documento**. Así que `balance.user.name`, `debt.from.name` y `participants.user.name` dejan de
venir resueltos solos, y hay que hacer el join a mano. Medido: 16 líneas de `populate` (≈25
invocaciones), 7 comprobaciones de permisos, las dos funciones del motor, dos esquemas y 5
ficheros del front.

## Reglas de negocio

### Alta de miembros: sólo por nombre

El email desaparece del formulario de grupo. El creador se añade automáticamente desde el JWT,
con su `User.name`.

```js
POST /group
{ name: "Piso", description: "...", members: [{ name: "Mamá" }, { name: "Ana" }] }

→ members: [
    { _id: m1, name: "Jorge", user: <del JWT> },
    { _id: m2, name: "Mamá", user: null },
    { _id: m3, name: "Ana",  user: null }
  ]
```

```js
PUT /group/:groupId
{ name, description, members: [{ _id: "m1", name: "Jorge" }, { _id: "m2", name: "Mamá" },
                               { name: "Luis" }] }
```

- entrada **con** `_id` → miembro existente (se permite renombrarlo)
- entrada **sin** `_id` → miembro nuevo
- miembro que **no aparece** → baja (ver más abajo)

Se rechazan nombres duplicados dentro del mismo grupo, comparando en minúsculas y sin espacios
alrededor — por el mismo motivo por el que hoy se rechazan emails duplicados. Se mantiene el
`'You cannot remove yourself from the group while updating it'` actual.

Precio de la versión pura, asumido: `getUserGroups` filtra por `members.user`, así que **quien ya
tiene cuenta no verá el grupo en su app hasta que pulse el enlace**. Con los mismos compañeros de
piso cada mes es fricción repetida. Se acepta a cambio de un único camino de resolución y de que
desaparezca toda la clase de error "ese email no existe".

### Ajustes de contrato cerrados el 31-07-2026

Salieron de la revisión de los PRs A, B y C, antes de escribir el front:

- **El nombre que se pinta es siempre `member.name`**, nunca `member.user.name`. El nombre pertenece
  al grupo y cualquier miembro puede editarlo; la cuenta enlazada sólo aporta el avatar. Si mandara
  el de la cuenta, cambiarse el nombre en el perfil se lo cambiaría a todo el mundo en todos sus
  grupos.
- **Lista vacía es `200 []`, no 404.** Afecta a `getUserGroups`, `getExpensesByUserId` y
  `getExpensesByGroupId`. Recién registrado, y también nada más crear un grupo sin gastos, la app
  recibía 404 de algo que simplemente no existe todavía.
- **`MEMBER_FIELDS` es `'name profilePicture'`**: fuera el email. El formulario de miembros es sólo
  nombre, así que el front ya no necesita correos de nadie.
- **Liquidar un pago ya `paid` es 409.** Dos clics seguidos mandaban dos PATCH y llegaban dos
  notificaciones al acreedor.

### Baja de un miembro con gastos → 409

Si el miembro aparece como `paidBy` o participante de algún gasto, el PUT falla con 409 y el
nombre de quién bloquea. Aplica igual a miembros con cuenta y sin ella.

Esto arregla un bug que ya existe: hoy `updateGroup` llama a `updateBalance()` pero **no** a
`generateDebts()`, y `updateBalance()` reconstruye el balance desde los *gastos*, no desde los
miembros — así que puedes echar a alguien y sus deudas siguen vivas.

### El miembro sin cuenta es participante de primera clase

Puede ser `paidBy` y por tanto acreedor. Si no, cuando tu tía paga la cena hay que falsear el
gasto a nombre de otro y el reparto real se pierde. Con la identidad en el miembro esto sale
gratis: `paidBy` es un `_id` de miembro y da igual si tiene `user` o no.

Las notificaciones se emiten sólo a miembros con `user` enlazado; a los demás se salta el bucle
(hoy emitiría a una sala `user:<id>` sin nadie escuchando).

### La única excepción en `pay`

La regla actual (`payments.controller.js:27-37`) es: ser miembro **y** ser el `from` o el `to`.
Contra lo que suponía el TODO, casi nada hay que relajar:

- un miembro sin cuenta me debe a mí → `to` soy yo → **ya permitido**
- yo le debo a un miembro sin cuenta → `from` soy yo → **ya permitido**
- **sin cuenta → sin cuenta** → nadie puede liquidarla. Único caso roto, y `generateDebts` lo
  genera en cuanto hay dos miembros sin cuenta y uno paga algo.

```js
const me = memberOf(group, userId);
if (!me) return 403;
const bothUnclaimed = !group.members.id(payment.from)?.user
                   && !group.members.id(payment.to)?.user;
const isParty = me._id.equals(payment.from) || me._id.equals(payment.to);
if (!isParty && !bothUnclaimed) return 403;
```

No añade ninguna capacidad nueva a un atacante: `deleteExpense` y `updateExpense` sólo comprueban
`isMember`, así que cualquier miembro puede ya borrar o reescribir cualquier gasto del grupo. El
libro de cuentas ya es colectivo.

Se descartó restringirlo al creador del grupo: el campo `createdBy` **no existe** en el esquema
(el `createdBy` que recibe `groupForm` es un adorno del front), habría que migrar los grupos
existentes sin saber quién los creó, y no protegería de nada.

## Unirse por el enlace del grupo

### El enlace

`Group.inviteCode`, string aleatorio con índice único, generado al crear el grupo y devuelto en
el payload del grupo — así no hace falta endpoint para leerlo; lo ven los miembros, que son
quienes lo comparten.

```js
crypto.randomBytes(16).toString('base64url')   // 22 chars, crypto es nativo
```

No vale un número corto ni un id secuencial: adivinar un código es entrar en el grupo de un
desconocido y apropiarse de un miembro con deudas.

**Permanente y regenerable.** Sin caducidad, porque en un grupo de gastos la gente se une con
semanas de retraso. Cualquier miembro puede regenerarlo, lo que invalida el enlace anterior al
instante — es la única defensa real si el enlace acaba en el grupo de WhatsApp equivocado.

### Cómo llega el enlace a la otra persona

La app **no lo envía**: lo copias y lo mandas por donde ya hables con esa gente (WhatsApp,
Telegram, en persona). En el front es un botón de copiar más `navigator.share` en móvil, que abre
el compartir nativo del sistema. Cero infraestructura de correo.

Enviarlo por email desde la propia app es una **capa fina opcional encima del mismo enlace**, no un
mecanismo distinto: `sendEmail(email, asunto, enlace)` con SendGrid, que ya está integrado y con
clave real en `backend/.env`. No toca el modelo, ni el endpoint de unirse, ni la seguridad — el
enlace es el mismo y sigue siendo el enlace del grupo, no un token por persona. **Fuera de alcance
por ahora**; si entra, ojo con que `sendEmail` hoy hace `sendgrid.send(msg)` sin `await` ni
`catch`, y en Node 24 una promesa rechazada sin manejar mata el proceso.

### El flujo

Unirse **exige estar autenticado**. Si no hay token, el front manda a login/registro y vuelve.
Así hay un solo camino: registro y login se quedan sin tocar, y el enlace funciona igual para
quien ya tiene cuenta y para quien no.

```
GET  /join/AbC123            sin token → /login?next=/join/AbC123
GET  /group/join/:inviteCode → { groupName, members libres }
POST /group/join/:inviteCode { memberId }   → members[i].user = userId
POST /group/join/:inviteCode { name }       → miembro nuevo ya enlazado
POST /group/:groupId/invite-code/regenerate → código nuevo
```

Reglas, ninguna negociable:

- **Sólo se pueden elegir miembros con `user == null`.** Si no, entro por el enlace, me declaro
  "Jorge" y me quedo con la cuenta del creador del grupo.
- **Un usuario no puede ser dos miembros del mismo grupo.** Si ya soy miembro, 409.
- Reclamar un miembro existente no cambia el balance. Crearse uno nuevo añade una entrada a 0, así
  que se llama a `updateBalance()` por consistencia.

Quien entra y no está en la lista puede **crearse un miembro nuevo** ("no estoy en la lista"), con
el nombre que quiera. Es seguro por un motivo concreto: un miembro recién creado no tiene
historial, así que no le roba deudas a nadie — a diferencia de elegir uno existente. El riesgo es
que alguien con el enlace infle el grupo con miembros de más, y son miembros sin gastos que
cualquier miembro puede quitar.

### Quien llega sin sesión aterriza en un login mudo

Entra en esta rama: el enlace es la puerta de entrada de la feature, y hoy la mitad de la gente que
lo abre no tiene cuenta todavía.

**Estado actual (verificado):** `/join/:inviteCode` va envuelta en `RequireAuth` (`App.jsx:33`), que
redirige a `/login?next=/join/<code>` con `replace`. El destino se conserva y el salto entre login y
registro lo arrastra (`loginForm.jsx:63`, `registerForm.jsx:120`), así que el mecanismo funciona —
es lo que valida el smoke de Cypress. Lo que falta es el **contexto**: la pantalla de login es la de
siempre, sin una palabra sobre el grupo. Quien abre el enlace desde WhatsApp sin cuenta ve un
formulario de login que no ha pedido, no sabe que venía de una invitación ni que tiene que
registrarse para continuar, y lo normal es que cierre la pestaña.

**A decidir:**

- **Lo mínimo, sin tocar backend:** el `?next=` ya dice que el destino era `/join/…`, así que la
  pantalla de login/registro puede pintar un aviso ("te han invitado a un grupo; inicia sesión o crea
  una cuenta para unirte"). Cero llamadas nuevas y cero cambios de contrato, pero **no puede decir el
  nombre del grupo**.
- **Con el nombre del grupo hay que abrir un endpoint.** `GET /group/join/:inviteCode` lleva
  `jwtMiddleware` (`group.routes.js:9`), así que sin sesión no se puede leer nada del grupo. Haría
  falta una variante pública que devuelva **sólo el nombre**, nunca la lista de miembros. El
  `inviteCode` ya es el secreto (22 caracteres de `crypto.randomBytes(16)`), así que quien lo tiene
  podría unirse de todas formas; pero servirlo sin auth deja mirar el nombre de un grupo sin dejar
  rastro de ninguna cuenta. Es una decisión explícita, no un detalle de implementación.
- **Que `/join/:inviteCode` salga de `RequireAuth`** y sea la propia pantalla la que, sin token,
  explique qué es esto y ofrezca *Entrar* / *Crear cuenta* con el `?next=` ya puesto. Es lo más
  amigable, porque el visitante nunca es expulsado del enlace, pero mete en un componente la vista
  con sesión y la vista sin ella. Si se elige esto, `RequireAuth` sigue haciendo falta para el resto
  de rutas privadas.
- **Enlace caducado:** un aviso que afirme "te han invitado" miente si el código fue regenerado. Sin
  llamada previa el error sólo aparece después de logarse, al cargar `/join`; con endpoint público se
  puede avisar antes. Otro motivo para decidir primero lo del endpoint.
- **Alcance:** es UI y copy sobre un flujo que ya funciona. Nada de tokens por persona ni de correos
  — eso sigue descartado más abajo.

## Camino de lectura: hidratación en el backend

Un helper construye el `Map` de miembros una vez por petición y deja las respuestas con el
miembro embebido, en los ~6 endpoints que hoy usan `populate`. La API sigue siendo
autodescriptiva y el front sólo renombra campos, en vez de repetir la lógica de join en cinco
componentes.

```js
GET /group/:id/groupDetails
{
  members: [{ _id: m1, name: "Jorge", user: { name, profilePicture } }, ...],
  balance: [{ member: { _id: m2, name: "Mamá", user: null }, amount: -12.5 }],
  debts:   [{ from: { _id: m2, name: "Mamá" }, to: { _id: m1, name: "Jorge" }, amount: 12.5 }]
}
```

## Cambios en el motor

`updateBalance()` indexa por `_id` de miembro en vez de por `user._id`, y **pierde todos sus
`populate`**: sólo necesita los gastos crudos (`Expense.find({ group: this._id })`), porque ya no
tiene que resolver nombres para calcular.

`generateDebts()` lee `{ member, amount }` y crea los pagos con `from: debtor.member`,
`to: creditor.member`.

Un helper sustituye las 7 comprobaciones de permisos, que además necesitan el `_id` del miembro,
no un booleano:

```js
const memberOf = (group, userId) =>
  group.members.find(m => m.user && m.user.toString() === userId);
```

**`getExpensesByUserId` hay que rehacerlo entero.** Hoy consulta
`{ $or: [{ "participants.user": userId }, { paidBy: userId }] }`, y el id de usuario ya no
aparece en ningún gasto. Pasa a: buscar los grupos del usuario, sacar su `_id` de miembro en cada
uno, y consultar por esos ids.

Y de paso, un bug adyacente: `deleteGroup` borra el grupo y sus gastos pero **no sus pagos**.

## Entrega

### PR 0 — rutas de usuario sin autenticar (directo a main, aparte)

No es la tarea 2, pero está **en producción ahora mismo**. En `backend/src/routers/user.routes.js`:

| Ruta | Problema |
|---|---|
| `GET /api/user/` | `getAllUsers` sin `jwtMiddleware`: devuelve todos los usuarios **con el hash de contraseña** |
| `DELETE /api/user/:id` | borra cualquier usuario, sin auth |
| `POST /api/user/create` | crea usuarios sin auth y sin validar fuerza de contraseña |
| `GET /api/user/:id` | sin auth |
| `GET /api/user/me` | sin `jwtMiddleware`, así que `req.jwtPayload` es `undefined` → 500 |

El front sólo usa `/user/update` y `/user/expenses`; Cypress no usa ninguna. Las cinco son
**código muerto**: se borran las rutas y los controladores se quedan inertes. Diff de cinco
líneas, en su propio PR para que no se entierre entre los 20 ficheros de la feature.

### La feature: rama `feat/miembros-invitados` con PRs internos

Los cambios entran por PRs pequeños **contra la rama de feature**, y la rama se mergea a `main`
una sola vez. Así las revisiones son pequeñas sin que haya ninguna ventana de producción roto: la
forma de la respuesta cambia, así que un backend mergeado antes que su front rompe la app en
cuanto Koyeb redespliega.

**PR A — modelo y motor.** `group.schema.js` (`inviteCode`, `members[]`, `balance[]`),
`expense.schema.js`, `payment.schema.js`, `updateBalance()`, `generateDebts()`, helper `memberOf`.
Tests del motor con ids de miembro.

**PR B — controladores de grupo.** Contrato nuevo de `members[]`, nombres duplicados, 409 de bajas
con gastos, `inviteCode` en los payloads, `GET`/`POST /group/join/:inviteCode`, regenerar código,
borrar los pagos en `deleteGroup`.

**PR C — gastos, pagos y hidratación.** `paidBy` y `participants` como ids de miembro (fuera las
comprobaciones `User.findById`, que ya no significan nada), excepción de `pay`,
`getExpensesByUserId` rehecho, helper de hidratación en los ~6 endpoints, notificaciones sólo a
miembros enlazados.

**PR D — frontend.**

| Fichero | Cambio |
|---|---|
| `components/group/groupForm/groupForm.jsx` | filas de **nombre**, sin campo ni validación de email; los existentes llevan su `_id` |
| `components/group/createGroup/createGroup.jsx` | fuera el baile de `getUserSession()` y el `...data.members.push({ email })` (que además es un bug: extiende el número que devuelve `push`) |
| `components/expense/expenseForm/expenseForm.jsx` | selectores de pagador y participantes por `_id` de miembro |
| `components/balance/balance/balance.jsx` | `balance.user.name` → `balance.member.name` |
| `components/expense/expense/expense.jsx` | participantes y pagador por miembro |
| `components/debts/debt/debt.jsx` | sigue leyendo `debt.from.name`, que la hidratación mantiene |
| pantalla nueva `/join/:inviteCode` | lista de miembros libres, "no estoy en la lista", y redirección a login conservando el destino |
| UI de grupo | compartir enlace, regenerarlo, y distintivo de "sin cuenta" en los miembros libres |
| avatares | `user.profilePicture` sólo existe en miembros enlazados; los libres, iniciales del nombre |

### Tests

Sobre la base que hay hoy: **un solo fichero**, `backend/src/tests/group.test.js`, 74 líneas, 2
tests.

- crear grupo con miembros por nombre; el creador queda enlazado desde el JWT
- nombres duplicados en el mismo grupo → 400
- renombrar un miembro por `_id` sin perder su historial
- quitar a un miembro con gastos → 409
- gasto pagado por un miembro sin cuenta → el balance lo pone como acreedor
- `pay` de una deuda sin-cuenta→sin-cuenta por un miembro con cuenta → 200
- la misma, por alguien que no es miembro → 403
- unirse con `memberId` libre → `members[i].user` queda enlazado y sus deudas siguen siendo suyas
- unirse eligiendo un miembro **ya enlazado** → 409
- unirse estando ya en el grupo → 409
- unirse con `{ name }` → miembro nuevo enlazado, balance con entrada a 0
- regenerar el código invalida el enlace anterior
- `getExpensesByUserId` devuelve los gastos de todos los grupos donde el usuario es miembro

`group.test.js` fija `process.env.jwt_secret` **antes** de sus requires, porque `security/jwt.js` y
`user.schema.js` capturan el secreto al importarse. Los tests nuevos que firmen tokens necesitan
lo mismo.

## Vaciado de la base

No hay script de migración: los grupos que hay son de prueba. Se borran `groups`, `expenses` y
`payments` en Koyeb **antes de mergear**, no después. **`users` no se toca** — no cambia de forma.

El orden importa y estaba al revés hasta la review del 04-08-2026. El push a `main` toca
`backend/**`, así que **dispara el despliegue de Koyeb solo**: si la base aún tiene documentos
viejos, el código nuevo se encuentra gastos con `participants.user` en vez de `.member`, y
`entryFor(undefined)` revienta en *cada* recálculo de balance; los grupos viejos no tienen
`members[].name`, que ahora es obligatorio, ni `inviteCode`, así que con dos o más el índice único
ni siquiera se puede construir. Vaciando primero, lo peor que pasa son unos minutos con el código
viejo sobre una base vacía: no ves grupos, y nada falla.

Es obligatorio y no puede quedarse a medias: un gasto viejo guarda un `_id` de usuario donde el
código nuevo espera un `_id` de miembro, y **los dos son `ObjectId` válidos**, así que no falla —
devuelve datos silenciosamente incorrectos. Eso es peor que un error.

El push toca también `frontend/**`, así que Cloudflare Pages sale **en paralelo** con Koyeb: hay
unos minutos de descoordinación inevitable. `CLIENT_URL` en Koyeb tiene que seguir siendo el origen
de producción de Pages sin barra final (se compara literalmente en `socket/socket.server.js`) y
ahora también construye el enlace de invitación.

## Estado de ejecución

Se marca cada paso al completarlo. Una fase no se da por cerrada hasta que sus tests pasan.

**Leyenda:** `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[!]` bloqueado o replanteado

### Fase 0 — PR aparte, directo a `main`

- [x] 1. Borrar de `backend/src/routers/user.routes.js` las 5 rutas muertas y sin auth:
      `POST /create`, `GET /`, `GET /me`, `GET /:id`, `DELETE /:id`. Los controladores se quedan.

### Fase 1 — PR A: modelo y motor · rama `feat/miembros-invitados`

- [x] 2. `group.schema.js`: `inviteCode` (único, `crypto.randomBytes(16).toString('base64url')` en
      `pre('validate')`), `members: [{ name, user }]`, `balance: [{ member, amount }]`
- [x] 3. `updateBalance()` indexa por `_id` de miembro y pierde **todos** sus `populate`
- [x] 4. `generateDebts()` crea los pagos con `from: debtor.member` / `to: creditor.member`
- [x] 5. `expense.schema.js`: `paidBy: ObjectId` sin ref, `participants: [{ member, amountOwed }]`
- [x] 6. `payment.schema.js`: `from` y `to` a `ObjectId` sin ref
- [x] 7. Nuevo `backend/src/utils/members.js` con `memberOf()` y `hydrateMembers()`
- [x] 8. Tests del motor con ids de miembro (`backend/src/tests/engine.test.js`)

### Fase 2 — PR B: controladores de grupo

- [x] 9. `createGroup` recibe `members: [{ name }]`, añade al creador desde el JWT, rechaza
      nombres duplicados
- [x] 10. `updateGroup` con `_id` opcional por miembro; **409** al dar de baja a alguien con gastos
- [x] 11. `inviteCode` en los payloads de `getGroupById`, `getUserGroups` y `getGroupDetails`
- [x] 12. `GET /group/join/:inviteCode` → grupo y **sólo** miembros con `user == null`
- [x] 13. `POST /group/join/:inviteCode` con `{ memberId }` o `{ name }`; 409 si el miembro ya está
      enlazado o si quien llama ya es miembro
- [x] 14. `POST /group/:groupId/invite-code/regenerate`
- [x] 15. Rutas registradas en `group.routes.js`
- [x] 16. `deleteGroup` borra también los `Payment` del grupo
- [x] 17. Tests de los controladores de grupo y del flujo de unirse

### Fase 3 — PR C: gastos, pagos e hidratación

- [x] 18. `expense.controller.js`: `paidBy` y `participants` como ids de miembro validados contra
      `group.members`; fuera `User.findById(paidBy)` y `User.find({ _id: { $in: … } })`
- [x] 19. `getExpensesByUserId` rehecho: grupos del usuario → su `_id` de miembro → consulta
- [x] 20. `pay` con la excepción sin-cuenta→sin-cuenta
- [x] 21. `hydrateMembers` aplicado en los ~6 endpoints que hoy usan `populate`
- [x] 22. Notificaciones sólo a miembros con `user` enlazado; de paso, `notificationTypes` pasa a
      exportar `DEBT_SETTLED`, que es la clave que `payments.controller.js` lee
- [x] 23. Tests de gastos y pagos (`backend/src/tests/expense.test.js`)

### Fase 4 — PR D: frontend

- [x] 24. `groupForm.jsx` con filas de nombre, sin email; los existentes llevan su `_id`. Tu propia
      fila no lleva botón de quitar, porque el backend rechaza que te borres y sólo se salía cancelando
- [x] 25. `createGroup.jsx` sin `getUserSession()` ni el `...data.members.push({ email })`
- [x] 26. `group.jsx` pasa `group.members` tal cual; avatares con iniciales si `user` es `null`
- [x] 27. `expenseForm.jsx`: sólo el `defaultChecked` (`p.user._id` → `p.member._id`)
- [x] 28. `balance.jsx` → `balance.member.name`; `expense.jsx` por miembro (`debt.jsx` sólo refresca
      cuando `pay` responde 409). `userExpenses.jsx` deja de tratar el 404 como lista vacía
- [x] 29. Pantalla `/join/:inviteCode` + ruta en `App.jsx`, con login que conserva destino:
      `components/auth/requireAuth.jsx` en **todas** las rutas privadas y `utils/nextDestination.js`,
      que sólo acepta rutas del propio sitio para que `?next=` no sea un redirector abierto. Los
      enlaces entre login y registro arrastran el destino
- [x] 30. Compartir enlace (copiar + `navigator.share`), regenerarlo, distintivo de "sin cuenta"

Verificado con `frontend/cypress/e2e/smoke-miembros.cy.js` contra la app real (2/2): grupo creado por
nombres, gasto pagado por un miembro sin cuenta que sale acreedor, una segunda cuenta uniéndose por
el enlace y heredando el historial, y el visitante sin sesión redirigido a `/login?next=…`.

### Fase 4b — aterrizaje del enlace para quien no tiene sesión

- [x] 31. Decidido el 04-08-2026: **ruta nueva sin auth**, `GET /group/invite/:inviteCode`, que
      devuelve sólo `{ name }` y 404 si el código ya no vale. Handler aparte, no una condición dentro
      del actual: la lista de miembros libres es lo único que hay que proteger de verdad, y una
      condición compartida está a un bug de filtrarla
- [x] 32. Pantalla de aterrizaje (`pages/join/inviteLanding.jsx`): quien abre `/join/:inviteCode` sin
      token ve el nombre del grupo, qué es DivvyUp, y *Sign in* / *Create account* con el `?next=`
      puesto. La ruta sale de `RequireAuth`, porque ahora decide la propia pantalla
- [x] 33. **La foto de perfil deja de ser obligatoria al registrarse** (punto 6 del TODO), que era el
      último obstáculo del camino que abre esta fase: el `append` sólo viaja si hay fichero —antes
      mandaba el string `"undefined"`—, el avatar cae a la inicial del nombre, y desaparece
      `via.placeholder.com`, que ya no responde (punto 8). De paso, `updateUser` deja de borrar la
      foto cada vez que editas sólo el nombre
- [x] 34. Cypress `invite-landing.cy.js`: visitante sin sesión abre el enlace → ve la explicación con
      el nombre del grupo → se registra desde ahí sin subir foto → cae en `/join/:inviteCode` y
      reclama su miembro, sin volver a pegar el enlace

### Fase 4c — lo que la review dejó para después

Los cuatro hallazgos que no bloqueaban: ninguno afecta a la corrección de los datos, y por eso no
entraron en el paso 40. Van antes del cierre porque son de código ya escrito y el 37 conviene
hacerlo antes de que el payload crezca en producción.

- [ ] 35. `userExpenses.jsx`: el `toast.error` sale del render a un `useEffect`, como ya lo hace
      `groupDetails.jsx`. Hoy es un efecto secundario en el render, así que React avisa y el toast se
      repite en cada uno
- [ ] 36. `createExpense.jsx` recibe los miembros por props en vez de pedir `getGroupById`, porque
      `getGroupDetails` ya los devuelve y son exactamente los mismos
- [ ] 37. `MEMBER_PATHS` a `utils/members.js`: `group.controller.js` lo inlinea mientras
      `expense.controller.js` tiene la constante
- [ ] 38. `expenseResponse` deja de empotrar el grupo entero —miembros incluidos— en cada gasto. Con
      50 gastos y 8 miembros esa lista viaja 50 veces. Arrastra `expense.jsx`, que lee
      `expense.group.members` y `expense.group._id`, así que hay que pasarle ambos por props

### Fase 5 — cierre

- [x] 39. Review de `feat/miembros-invitados` entera, con los cuatro PRs ya dentro. Es la última
      oportunidad de leerla como una sola pieza: el merge a `main` ya no tiene vuelta atrás barata,
      porque arrastra el vaciado de la base
- [x] 40. Corregir los hallazgos que bloquean: reparto con más de 2 decimales, `participants` que no
      es lista, grupo que se queda en un miembro, participante repetido, nombre de miembro sin tope,
      nombre del creador sin `trim`, deudas regeneradas al renombrar, pago `cancelled` reactivable,
      cuenta borrada en `getExpensesByUserId`, y el botón de quitar miembro al crear grupo
- [ ] 41. **Vaciar `groups`, `expenses` y `payments` en Koyeb, antes del merge** (`users` no se
      toca). Ojo: ahí siguen los usuarios de prueba que dejaron los Cypress de los pasos 30 y 34
- [ ] 42. Merge de `feat/miembros-invitados` a `main`
- [ ] 43. Repaso extremo a extremo en producción: crear grupo por nombres, gasto pagado por un
      miembro sin cuenta, unirse por el enlace desde otra cuenta, regenerar el código

## Descartado

- **Usuario-sombra en `users`** (`accountStatus: 'invited'`, password condicional, email sparse) —
  su única ventaja real, que reclamar era gratis, desaparece al exigir cuenta para unirse.
- **Colección `GuestMember`** aparte con `refPath` — cada ref pasaba a ser un par `(kind, id)`, lo
  que rompe todas las comparaciones `_id.toString() === userId`.
- **Invitación por email con token por miembro** (SendGrid) — más segura, porque el token nombra a
  la persona y nadie elige quién es, pero no es el modelo Tricount. SendGrid se queda sin usar en
  esta feature.
- **Añadir miembros por email**, aunque fuese opcional junto al nombre — dos caminos de
  resolución, y devuelve la conducta de meter a alguien en un grupo sin que lo acepte.
- **Reclamo por email sin token** — aceptaba que registrarse con el email de otro te diera su
  historial de grupos.
- **Dos caminos al unirse** (registro desde el flujo que actualiza el miembro en su sitio, frente a
  fusión si ya tienes cuenta) — ahorraba reescrituras en el modelo de usuario-sombra, que ya no
  se usa.
- **Restringir la liquidación al creador del grupo** — el campo `createdBy` no existe.
- **Emparejar en `generateDebts` para evitar deudas sin-cuenta→sin-cuenta** — hay configuraciones
  en las que es matemáticamente inevitable, y quedaría una deuda imposible de liquidar.
- **Enlace del grupo con caducidad** — el caso normal en un grupo de gastos sería el enlace
  caducado.
- **Endpoints dedicados de miembros** (`POST`/`DELETE /group/:id/members`) — más correcto que el
  reemplazo masivo del PUT, pero convierte el formulario de edición en una lista con acciones.
  Queda como posible tarea futura.
