# TODO

## 3. Landing page

**Estado actual (verificado):**

- En `frontend/src/App.jsx:26` la ruta `/` monta `<Layout>` con rutas hijas, pero **no hay ruta índice**. Al entrar en `/` el `<Outlet />` no renderiza nada: se ve el header y el `<main>` vacío.
- El `<Route path="*" element={<NoMatch />} />` **no** cubre este caso: `/` casa exactamente con la ruta padre, así que no cae en el comodín.

**A decidir:**

- Lo mínimo para tapar el agujero es un `<Route index element={...} />` dentro del layout. Redirigir a `/groups` si hay token y a `/login` si no es de una línea, y sirve mientras no exista landing.
- Para la landing de verdad: qué cuenta (el proyecto ya tiene capturas y copy en el `README.md` que se pueden reaprovechar), y si debe redirigir a `/groups` cuando el usuario ya está logueado.

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
