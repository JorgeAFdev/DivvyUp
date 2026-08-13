# Migración a TypeScript — plan

Plan acordado el 11-08-2026 para el punto 14 del `TODO.md`. **Backend primero; el
frontend es un esfuerzo aparte y posterior.** El backend va en **dos PRs, en este orden**.

> **Estado: backend HECHO el 11-08-2026** — PR A (#103, refactor del motor) y PR B (#104, migración TS)
> mergeados, imagen desplegada en Coolify y verificada en producción (`https://divvyup-api.jorgeaf.dev`).
> El plan de abajo describe lo ejecutado. Sobre lo escrito aquí se aplicaron además dos rondas de code
> review: entre otras cosas, el tipado de Mongoose acabó usando un tipo hidratado (5º genérico del
> modelo) para que los subdocumentos lleven `_id`/métodos; `hydrateMembers` es genérico con los paths
> validados contra el tipo; `req.jwtPayload` se declara **requerido** (el `jwtMiddleware` lo garantiza,
> sin `!` ni wrappers); y `clean-e2e` pasó a TS.

> **Estado del frontend (12-08-2026) — en curso.** Progreso por PR (ver [sección final](#frontend-plan-ratificado-el-12-08-2026)):
> - ✅ **PR0** — jest → vitest (PR #105, mergeado).
> - ✅ **PR1** — `packages/shared` + wiring Turbo/Docker/matrix, backend consume el contrato como tipos (PR #106).
> - ✅ **PR2** — `utils/*.js` → `.ts` tipados contra el contrato; toolchain del frontend y frontend en el matrix de typecheck (PR #107).
> - ✅ **PR3** — `hooks/*` + `theme` → `.ts`; react-query tipado (datos del contrato, variables de mutación con los input DTOs) (PR #108).
> - ✅ **PR4a** — `components/**` → `.tsx` (35); `apiErrorMessage` + `@types/react`; verificado con 13/13 Cypress e2e (PR #109).
> - ⏳ **PR1.5** — serializadores del backend (doc→contrato campo a campo), tras PR2–PR4.
> - ⏳ **PR4b** — `pages`+`App`+providers (incl. `userContextAuth`, `useConfirmationToast`) · **PR5** — cierre.

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

## Frontend (plan ratificado el 12-08-2026)

Migración a TS del frontend **por fases en 7 PRs**, no big-bang: son 72 ficheros y el tipado
de MUI / react-hook-form / react-router es el trabajo de verdad, así que cada PR convierte una
capa y queda revisable. Durante la transición el `tsconfig` del frontend lleva `allowJs: true`
+ `checkJs: false` (el `.jsx`/`.js` sin convertir se permite pero no se chequea); se retira en
el último PR. Cada fichero convertido nace en `strict`.

**Decisiones:**

- **Runner: jest → vitest.** Unifica con el backend (un solo runner en el monorepo) y vitest
  entiende TS/TSX vía esbuild sin config extra. El swap va como **PR prólogo JS-only** (PR0),
  con todo aún en `.jsx` y en verde, aislando el cambio de runner del de lenguaje — misma
  filosofía que el PR A del backend. Convive con el proyecto vitest de Storybook ya existente
  (`vitest.workspace.js`) como un segundo proyecto con nombre; `pnpm test` corre solo el de
  unidad (`--project unit`, jsdom), no el de navegador.
- **Exigencia: la misma vara que el backend.** El `tsconfig` del frontend extiende
  `tsconfig.base.json` (solo `strict` + `isolatedModules`) y añade lo suyo: `moduleResolution:
  Bundler`, `jsx: react-jsx`, `lib` con `DOM`, `noEmit`. Sin flags más severos
  (`noUncheckedIndexedAccess`, etc.): "tipado serio sin `any`" se sostiene por disciplina y por
  el gate de typecheck, no por más config sobre 52 componentes.
- **Gate de typecheck: matrix.** `typecheck.yaml` pasa a un matrix `[backend, frontend]` (más
  `shared`), con el path filter ampliado a `frontend/**`. Vite nunca comprueba tipos, así que
  el `tsc --noEmit` del frontend es su propia puerta de PR.
- **Tipos de dominio: `packages/shared`.** Un paquete **compilado** del monorepo con el
  **contrato API serializado** — las shapes JSON que devuelven los endpoints (`_id` y fechas
  como `string`, montos `number`), no los tipos Mongoose, que llevan `ObjectId`/`Date`/`Decimal`.
  Es **aditivo**: el backend mantiene `InferSchemaType` como fuente interna del schema y además
  **tipa las respuestas de sus controllers contra el contrato**, así el drift entre lo que
  serializa y lo que el frontend espera se pilla en compilación. El frontend lo importa en
  `utils/*Api` → hooks → componentes. Se consume vía **`dist/` compilado** (Turborepo
  `dependsOn: ^build`, watch en `turbo dev`) y el Dockerfile copia `shared` en ambos stages. Por
  ahora **solo tipos**; el TODO #11 (Zod compartido, dedupe del regex de password) se hará luego
  sobre esta infra ya montada.
- **Cypress se queda en JS.** La migración se centra en la app (`src`); los specs no son código
  de producción y meterían config TS de Cypress por una capa que no es la app.
- **`prop-types` fuera.** Se retira inline al convertir cada componente a `.tsx`; el devDep se
  dropea en el último PR.

**Secuencia de PRs:**

1. **PR0 — vitest (JS-only).** Los 3 suites (`header`, `icon`, `darkModeContext`) pasan de jest
   a vitest sin tocar el lenguaje; jest y babel fuera.
2. **PR1 — `packages/shared` (fundacional).** Paquete compilado con el contrato de tipos;
   Turborepo (`dependsOn: ^build`), Docker (copiar `shared` en build+runtime) y el matrix de
   typecheck (`shared` + `backend`). El backend lo consume ya como **tipos** (`import type` +
   `satisfies` en las respuestas triviales ya serializadas), sin serializar aún. No toca la app
   frontend.
   - **PR1.5 — adopción completa del backend.** Serializadores en los 5 controllers que mapean
     doc→contrato campo a campo (`res.json(serializeX(doc))`), tipando las respuestas contra el
     contrato para pillar drift en compilación. Va aparte porque cambia la serialización de
     runtime (deja de mandar `__v`, fija el output) y obliga a re-verificar los 106 tests vitest
     + 13 Cypress — separarlo del andamiaje del paquete lo mantiene revisable. Se hace tras PR2–PR4,
     ya con las shapes validadas por el uso real del frontend.
3. **PR2 — `utils/*.js` → `.ts` (11).** `tsconfig` del frontend (`allowJs`/`checkJs:false`),
   `vite-env.d.ts` para `import.meta.env`; el frontend entra al matrix.
4. **PR3 — `hooks/*` + `theme` → `.ts` (9).** react-query tipado sobre el contrato de `shared`.
5. **PR4a — `components/**` → `.tsx` (35).** MUI y react-hook-form tipados; `prop-types` fuera.
6. **PR4b — `pages/**` + `App.jsx` + `main.jsx` → `.tsx` (9).** Importan componentes ya tipados;
   aquí caen el routing y los providers.
7. **PR5 — cierre.** Tests (3) y stories (2) → `.tsx`, se quita `allowJs` y se dropea el devDep
   `prop-types`. Frontend 100% TS estricto.
