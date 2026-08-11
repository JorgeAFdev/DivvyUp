# Migración a TypeScript — plan

Plan acordado el 11-08-2026 para el punto 14 del `TODO.md`. **Backend primero; el
frontend es un esfuerzo aparte y posterior.** El backend va en **dos PRs, en este orden**.

> **Estado: backend HECHO el 11-08-2026** — PR A (#103, refactor del motor) y PR B (#104, migración TS)
> mergeados, imagen desplegada en Coolify y verificada en producción (`https://divvyup-api.jorgeaf.dev`).
> El plan de abajo describe lo ejecutado. Sobre lo escrito aquí se aplicaron además dos rondas de code
> review: entre otras cosas, el tipado de Mongoose acabó usando un tipo hidratado (5º genérico del
> modelo) para que los subdocumentos lleven `_id`/métodos; `hydrateMembers` es genérico con los paths
> validados contra el tipo; `req.jwtPayload` se declara **requerido** (el `jwtMiddleware` lo garantiza,
> sin `!` ni wrappers); y `clean-e2e` pasó a TS. El **frontend sigue pendiente** (sección final).

## PR A — Refactor del motor (JS-only, prólogo)

Sacar `updateBalance` y `generateDebts` de `group.schema.js` a **funciones sueltas en
`services/`** (p. ej. `services/ledger.js`):

```js
await updateBalance(group);
await generateDebts(group);
```

- **Funciones con nombre, no un objeto-service.** Es la convención que ya sigue todo el
  backend (`sendEmail`, `sendNotificationToUser`, `hydrateMembers`); no hay ni un
  service-objeto en el repo, y meterlo sería inconsistencia por nada.
- **Actualizar las 7 llamadas de producción**: `payments.controller.js` (×2),
  `group.controller.js` (×4) y el hook `post('save'|'findOneAndUpdate'|'findOneAndDelete')`
  de `expense.schema.js`. Y las **5 de `engine.test.js`**.
- **Cuidado con el import circular** `expense.schema → ledger → group.schema →
  expense.schema`: resolverlo con lookups perezosos `mongoose.model(...)`, como ya hace hoy
  el hook para no importar `Group`.
- **Se queda en JS a propósito.** Los 103 tests en verde prueban que el comportamiento no
  cambia, y la edición de `engine.test.js` ocurre aquí, aislada del cambio de lenguaje. Es
  la misma filosofía con la que se hizo el punto 13 (ESM como paso propio, verificado en
  verde sin ruido).

Este PR es el que hace viable `InferSchemaType` en el PR B: deja el schema centrado solo en
la estructura persistida.

## PR B — Migración TS del backend (big-bang)

- **`tsconfig.base.json` en la raíz** con lo común (`strict: true`, `target`, `skipLibCheck`,
  `esModuleInterop`, `forceConsistentCasingInFileNames`) y `backend/tsconfig.json` que
  `extends` de él con lo propio: `module`/`moduleResolution: NodeNext`, `outDir: dist`,
  `rootDir: src`. La base no fija `module`/`moduleResolution` porque backend (NodeNext) y
  frontend (Bundler) difieren.
- **Big-bang, `strict: true`, sin `allowJs`.** Los 25 ficheros de `src` más los 5 de test
  pasan a `.ts` de una tacada. Son pocos ficheros y van en su rama; la convivencia gradual
  solo añadiría ruido de config.
- **Mongoose con `InferSchemaType<typeof Schema>`.** El schema es la única fuente de la
  estructura, sin duplicar una interfaz a mano. Viable **solo** tras el PR A, porque
  `InferSchemaType` no expresa métodos de instancia ni statics. `Decimal` (decimal.js trae
  sus tipos) y `Types.ObjectId` se tipan en el schema.
- **Tipos de terceros**: `@types/express`, `@types/cors`, `@types/jsonwebtoken`,
  `@types/bcryptjs`, `@types/multer`, `@types/node`, `@types/supertest`. `decimal.js` y
  `mongoose` traen los suyos.
- **Tests a `.ts` en este mismo PR.** vitest ya compila TS vía esbuild sin tocar
  `vitest.config.js`. Dejarlos en `.js` obligaría a reactivar `allowJs`, que contradice la
  decisión big-bang.
- **Dev con `tsx watch src/index.js`.** Ejecuta TS directo, ESM-nativo, sin config. No
  comprueba tipos al vuelo, y está bien: el type-check es puerta aparte y el IDE ya da tipos
  vivos. `tsx` es devDependency y no entra en la imagen.
- **Producción con `tsc` → `dist/`, Dockerfile multi-stage.** Stage de build con devDeps
  (`typescript`) hace `pnpm build`; stage final `node:22-slim` copia solo `dist/` +
  `node_modules --prod` y arranca `node dist/index.js`. La imagen final no lleva TS.
- **Puerta de type-check: `tsc --noEmit` (incluye tests) como tarea de `turbo` + un GitHub
  Action nuevo que la corre en cada PR.** Es la primera puerta de PR del repo (hoy no corre
  nada en PR CI; el deploy es path-filtered a `backend/**` al push a main). `strict` sin una
  comprobación forzada es teatro: vitest y Vite despojan tipos sin comprobar, y el `tsc` del
  build solo cubre código de producción al hacer merge.

## Frontend (aparcado)

Explícitamente después, en su propia sesión. Extiende el mismo `tsconfig.base.json` con
`moduleResolution: Bundler`, `lib: [DOM]`, `jsx: react-jsx`, `noEmit`. Decisiones abiertas:

- jest → vitest, o `@babel/preset-typescript` para que babel-jest entienda TS.
- Retirar `prop-types` (TS lo deja obsoleto).
- Rigor de `.jsx` → `.tsx` con MUI y react-hook-form tipados, que es el trabajo de verdad.
- Si el frontend se engancha al mismo Action de `typecheck` (Vite nunca comprueba tipos).
