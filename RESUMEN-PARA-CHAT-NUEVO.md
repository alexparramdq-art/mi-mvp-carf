# Mi MVP (by C.A.R.F.) — resumen para continuar en un chat nuevo

Pegá este archivo entero al principio del chat nuevo, junto con el
`carf-app.zip` adjunto, y decile a Claude: "seguimos este proyecto,
acá está todo lo configurado hasta ahora".

## Qué es
App de seguimiento de entrenamientos de fútbol para el C.A.R.F.
(Alejandro Parra), con familias, entrenador, login, prueba gratuita,
y cobro real.

## Publicada en
- **https://mi-mvp-carf.vercel.app** (dirección pública, la que se
  comparte con las familias)
- Cuenta de Vercel: alexparramdq-art (login con GitHub)
- Proyecto de Vercel: **carf2** (el nombre interno es "carf2", el
  dominio público es el de arriba)
- Conectado a GitHub: repositorio **alexparramdq-art/mi-mvp-carf**
  → cualquier cambio subido ahí (reemplazando archivos) redespliega
  la app sola, sin tocar nada en Vercel.

## Cómo se sube un cambio nuevo (IMPORTANTE)
1. Pedirle a Claude el archivo actualizado (o los archivos).
2. Entrar a github.com/alexparramdq-art/mi-mvp-carf
3. Entrar a la carpeta/archivo a reemplazar (ej. `src/CarfApp.jsx`).
4. Ícono de lápiz (Edit this file) → Ctrl+A → Delete → pegar el
   contenido nuevo → "Commit changes".
5. Vercel se actualiza solo en 1-2 minutos.

(Ya NO hace falta usar "Vercel Drop" ni crear proyectos nuevos —
eso era el método viejo, con problemas. Usar siempre GitHub.)

## Supabase (base de datos)
- Proyecto: **MI MVP** (bppcuezhtbadpmysppfd.supabase.co)
- Cuenta: alexparramdq@gmail.com (login con GitHub)
- El archivo `supabase/schema.sql` de esta entrega tiene TODO
  (tablas, permisos, la función de videos ya lista para cuando se
  arme la pantalla). Es seguro volver a correrlo entero si hace
  falta — no borra datos.

## Variables de entorno cargadas en Vercel (proyecto carf2)
Ya están cargadas, no hace falta tocarlas salvo que cambien:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_COACH_SIGNUP_CODE` = carf2026
- `MP_ACCESS_TOKEN` (Mercado Pago, producción)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL` = https://mi-mvp-carf.vercel.app

## Mercado Pago
- Cuenta común de Alejandro (no hace falta otra).
- Ya conectado de verdad: Checkout Pro + webhook que activa la
  cuenta de la familia sola cuando paga.
- Alias de transferencia manual (opción aparte): `chueco.madero.basico`
- WhatsApp de Alejandro para comprobantes: +54 9 223 5974246

## Stripe
**Decisión: NO se va a usar.** Argentina no está en la lista de
países habilitados por Stripe — haría falta crear una empresa en
EE.UU. (LLC), demasiado trámite para esto. Mercado Pago ya suele
aceptar tarjetas de crédito extranjeras a través de su Checkout Pro,
así que probablemente no haga falta nada más para cobrar
internacionalmente.

## AstroPay (opción para más adelante, si hace falta)
A diferencia de Stripe, AstroPay SÍ está disponible para negocios
argentinos — tiene API para cobrar en varias monedas, pensada para
e-commerce en LATAM. No se implementó todavía: la decisión fue
probar primero si Mercado Pago ya le sirve a familias de otros
países, y sólo sumar AstroPay si aparece un caso real donde haga
falta (para no acumular pasarelas de pago sin necesidad).

## DolarApp (descartada para esto)
Es una billetera PERSONAL para guardar/mover dólares digitales, no
tiene API para que un negocio le cobre a sus clientes. No aplica
para cobrar dentro de la app — podría servirle a Alejandro para
guardar personalmente la plata ya cobrada, pero es un tema aparte,
no de la app.

## Qué falta armar (para el chat nuevo)
1. **Pantalla de Videos** — la base de datos (tabla `videos` +
   bucket de Storage privado + permisos) ya está lista en
   `supabase/schema.sql`. Falta la parte visual en la app: subir
   video, listarlos, descargarlos. Quién sube: tanto el entrenador
   como la propia familia. Solo lo ve el entrenador y la familia
   dueña de ese jugador.
2. Publicación eventual en App Store / Play Store (evaluado como
   "más adelante", no urgente).

## Precios definidos
- Mensual: USD 9 (resto del mundo) / $14.000 ARS (Argentina)
- Anual: USD 90 / $140.000 ARS (2 meses gratis)
- (revisar la cotización del dólar de vez en cuando, el número en
  pesos puede quedar viejo — está en `src/CarfApp.jsx`, buscar
  `PRECIOS`)

## Estructura del proyecto
```
src/
  main.jsx       → entrada de la app
  App.jsx        → login/sesión (decide Auth o CarfApp)
  Auth.jsx       → pantalla de login/registro
  CarfApp.jsx    → toda la app (pantallas, lógica, precios, pagos)
  assets.js      → los 3 logos en base64 (CARF original, ícono MVP, logo completo MVP)
api/
  create-preference.js  → arma el link de pago de Mercado Pago
  mp-webhook.js          → recibe el aviso de pago y activa la cuenta
supabase/schema.sql      → toda la base de datos (tablas, roles, permisos)
```
