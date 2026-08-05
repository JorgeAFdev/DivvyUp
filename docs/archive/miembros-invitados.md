# Miembros de grupo que no son usuarios registrados — registro de decisiones

**Completado y en producción el 04-08-2026** (PR #81), tarea 2 del [TODO](../../TODO.md), decidida el
30-07-2026.

Este fichero fue el plan de la feature mientras duró. Ya no lo es: **cómo se comporta el código hoy
está en [CLAUDE.md](../../CLAUDE.md)** y el paso a paso de la ejecución está en el historial de git.
Lo que queda aquí es lo único que no se puede reconstruir leyendo el repo: qué se decidió, qué se
descartó y por qué.

Modelo de referencia: **Tricount**. Un miembro se crea escribiendo un nombre; enlazar una cuenta
a ese miembro es una acción posterior, opcional, y la hace la propia persona.

## Propósito

**Con una sola cuenta se puede llevar el grupo entero.** Creas el grupo escribiendo nombres,
metes gastos, ves balances y liquidas deudas sin que nadie más se registre. Que los demás se unan
es una mejora opcional encima, no un requisito para empezar.

Un miembro de grupo deja de ser una cuenta y pasa a ser **un nombre**. La cuenta es un atributo
que puede engancharse después, o nunca.

Ese es el criterio con el que se juzgó cualquier decisión de este plan: si algo obliga a esperar a
que otra persona actúe para que el grupo funcione, está mal.

Con un solo mecanismo se cubren los dos casos:

- **Invitado permanente** — nunca tendrá cuenta (la madre de alguien, un compañero de piso del
  que sólo sabemos el nombre) y el grupo cuadra igual, desde el primer segundo.
- **Invitado con cuenta futura** — recibe el enlace del grupo, se registra o inicia sesión, se
  elige de la lista y a partir de ahí es miembro con cuenta, heredando todo el historial que ese
  miembro ya tenía: sus gastos, su balance y sus deudas pendientes.

El bloqueo que se eliminó: `createGroup` y `updateGroup` devolvían
400 `'One or more members do not exist'` si algún email no resolvía a un `User`, así que **no podías
crear un grupo hasta que todos se hubieran registrado** — la app era inservible hasta que el último
de tus amigos se daba de alta.

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

`user.schema.js`, `auth.routes.js` y `services/sendgrid.js` no se tocaron.

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
venir resueltos solos, y hay que hacer el join a mano. Medido antes de empezar: 16 líneas de
`populate` (≈25 invocaciones), 7 comprobaciones de permisos, las dos funciones del motor, dos
esquemas y 5 ficheros del front.

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
alrededor — por el mismo motivo por el que se rechazaban emails duplicados. Se mantiene el
`'You cannot remove yourself from the group while updating it'` anterior.

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

Si el miembro aparece como `paidBy`, como participante de algún gasto o en un pago ya liquidado, el
PUT falla con 409 y el nombre de quién bloquea. Aplica igual a miembros con cuenta y sin ella.

Arregló un bug que ya existía: `updateGroup` llamaba a `updateBalance()` pero **no** a
`generateDebts()`, y `updateBalance()` reconstruye el balance desde los *gastos*, no desde los
miembros — así que podías echar a alguien y sus deudas seguían vivas.

### El miembro sin cuenta es participante de primera clase

Puede ser `paidBy` y por tanto acreedor. Si no, cuando tu tía paga la cena hay que falsear el
gasto a nombre de otro y el reparto real se pierde. Con la identidad en el miembro esto sale
gratis: `paidBy` es un `_id` de miembro y da igual si tiene `user` o no.

Las notificaciones se emiten sólo a miembros con `user` enlazado; a los demás se salta el bucle
(si no, emitiría a una sala `user:<id>` sin nadie escuchando).

### La única excepción en `pay`

La regla anterior era: ser miembro **y** ser el `from` o el `to`. Contra lo que suponía el TODO,
casi nada había que relajar:

- un miembro sin cuenta me debe a mí → `to` soy yo → **ya permitido**
- yo le debo a un miembro sin cuenta → `from` soy yo → **ya permitido**
- **sin cuenta → sin cuenta** → nadie puede liquidarla. Único caso roto, y `generateDebts` lo
  genera en cuanto hay dos miembros sin cuenta y uno paga algo.

No añade ninguna capacidad nueva a un atacante: `deleteExpense` y `updateExpense` sólo comprueban
`isMember`, así que cualquier miembro puede ya borrar o reescribir cualquier gasto del grupo. El
libro de cuentas ya es colectivo.

Se descartó restringirlo al creador del grupo: el campo `createdBy` **no existe** en el esquema
(el `createdBy` que recibía `groupForm` era un adorno del front), habría que migrar los grupos
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

Enviarlo por email desde la propia app sería una **capa fina opcional encima del mismo enlace**, no
un mecanismo distinto: `sendEmail(email, asunto, enlace)` con SendGrid, que ya está integrado y con
clave real en `backend/.env`. No toca el modelo, ni el endpoint de unirse, ni la seguridad — el
enlace es el mismo y sigue siendo el enlace del grupo, no un token por persona. **Quedó fuera de
alcance**; si entra algún día, ojo con que `sendEmail` hace `sendgrid.send(msg)` sin `await` ni
`catch`, y en Node 24 una promesa rechazada sin manejar mata el proceso.

### El flujo

Unirse **exige estar autenticado**. Así hay un solo camino: registro y login se quedan sin tocar, y
el enlace funciona igual para quien ya tiene cuenta y para quien no.

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

### Quien llegaba sin sesión aterrizaba en un login mudo

El enlace es la puerta de entrada de la feature y la mitad de quien lo abre no tiene cuenta todavía,
pero lo que veía era la pantalla de login de siempre, sin una palabra sobre el grupo: un formulario
que no había pedido, sin saber que venía de una invitación. Lo normal era cerrar la pestaña.

Decidido el 04-08-2026: **ruta nueva sin auth**, `GET /group/invite/:inviteCode`, que devuelve sólo
`{ name }` y 404 si el código ya no vale, con handler aparte en vez de una condición dentro del
existente — la lista de miembros libres es lo único que hay que proteger de verdad, y una condición
compartida está a un bug de filtrarla. `/join/:inviteCode` sale de `RequireAuth` y es la propia
pantalla la que, sin token, explica qué es esto y ofrece *Sign in* / *Create account* con el `?next=`
ya puesto.

Se consideró y se descartó quedarse en lo mínimo: pintar el aviso sólo con lo que dice el `?next=`,
sin tocar backend. No cuesta nada, pero **no puede decir el nombre del grupo**, y un aviso que
afirme "te han invitado" miente si el código fue regenerado. Servir el nombre sin auth deja mirar
cómo se llama un grupo sin dejar rastro de ninguna cuenta; se acepta, porque quien tiene el
`inviteCode` (22 caracteres de `crypto.randomBytes(16)`) podría unirse de todas formas.

## El céntimo del reparto

Un falso positivo que conviene dejar escrito, porque volverá a parecer un bug: repartir 1600 € entre
tres da cuotas de 533,34 / 533,33 / 533,33. No existe un reparto en céntimos donde los tres paguen
lo mismo, así que alguien pone un céntimo más. Lo que importa es que las cuotas suman exactamente el
total y el balance suma exactamente cero, que es justo lo que **no** pasaba antes: con tres cuotas de
533,33 el grupo se quedaba descuadrado en un céntimo para siempre, sin ninguna deuda que liquidar.

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
