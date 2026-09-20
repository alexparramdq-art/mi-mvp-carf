# Mi MVP (by C.A.R.F.) — con login (familia / entrenador)

Sobre la versión que ya tenías funcionando (`carf-app.vercel.app`), se
agregó:

1. **Login real** — cada familia crea su cuenta y sólo ve a su propio
   jugador/a. El entrenador (con un código secreto) ve a todos los
   jugadores.
2. **Restricción real en la base de datos** — las sesiones cargadas en
   "C.A.R.F." (con la evaluación técnica del entrenador) sólo las
   puede insertar la cuenta del entrenador. Esto está reforzado en
   Supabase con una política de seguridad (RLS), no sólo en la
   pantalla — no se puede saltear editando el código del navegador.
3. **Base preparada para el cobro** — se agregó una tarjeta "Mi
   suscripción" en la pantalla de inicio (sólo para familias) con los
   tres medios de pago (Tarjeta, Mercado Pago, Transferencia)
   mostrados como "Próximamente". Todavía no cobran nada — es el
   siguiente paso, cuando quieras.

El diseño y las pantallas (ficha del jugador, sesión, partido, zona,
estadísticas, Método C.A.R.F.) siguen exactamente iguales.

## 1. Actualizar la base de datos

1. Entrá a tu proyecto de Supabase → **SQL Editor** → **New query**.
2. Pegá **todo** el contenido de `supabase/schema.sql` de esta
   entrega y apretá **Run**. Es seguro correrlo aunque ya hayas
   corrido una versión anterior: agrega las tablas y columnas nuevas
   sin borrar los jugadores que ya cargaste.

## 2. Elegir el código de entrenador

En el archivo `.env` (el mismo que ya tenías con
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`), agregá:

```
VITE_COACH_SIGNUP_CODE=elegí-una-palabra-secreta
```

Se lo compartís sólo a Alejandro (o al staff técnico). Con ese
código, su cuenta queda como "entrenador": ve a todos los jugadores y
es el único que puede cargar sesiones de C.A.R.F.

**¿Y quién es "alumno del CARF" con acceso gratis?** Eso ya **no** se
resuelve con un código que la familia escribe sola (un código así se
puede compartir con cualquiera y no era realmente seguro). Ahora lo
decide directamente Alejandro, a mano, desde adentro de la app —
ver el paso 3.

## 3. Probarla

```bash
npm run dev
```

1. Alejandro entra, toca "Crear cuenta", completa el código de
   entrenador, y ya puede ver a todos los jugadores y cargar sesiones
   de C.A.R.F.
2. Cada familia entra, toca "Crear cuenta", **sin ningún código**, y
   carga a su hijo/a con "+ Nuevo jugador". Por defecto queda en
   "Prueba gratuita" (con la tarjeta de medios de pago visible, sin
   cobro real todavía).
3. Alejandro entra a la pantalla **"Familias"** (el botón celeste,
   visible sólo para su cuenta), ve la lista de familias registradas,
   y toca **"Marcar alumno"** en las que efectivamente entrenan con
   él. Esa familia pasa a ver el badge verde "ALUMNO C.A.R.F." y
   tiene el acceso completo incluido, sin costo — y nadie más puede
   otorgárselo a sí mismo.

## 4. Publicar de nuevo en Vercel

Igual que la primera vez: arrastrás esta carpeta actualizada a tu
proyecto en Vercel (botón para agregar un nuevo despliegue) — en un
minuto `carf-app.vercel.app` queda con el login activado.

**Importante**: los jugadores que ya estén cargados en la base de
datos (de antes del login) van a quedar sin dueño asignado hasta que
alguien los edite estando logueado, o hasta que el entrenador los
revise (el entrenador ve todos los jugadores sin importar quién los
cargó).

## Cómo funciona la "Prueba gratuita"

Toda familia que se registra sin ser marcada "Alumno C.A.R.F." arranca
con **7 días de prueba** desde el momento en que crea la cuenta.

- **Durante esos 7 días**: puede usar la app sin restricciones —
  cargar jugadores, sesiones, partidos, zonas.
- **Pasados los 7 días, si todavía no activó un medio de pago**:
  sigue viendo todo lo que ya cargó (nada se borra ni se oculta),
  pero no puede agregar nada nuevo — los botones de "+ Nuevo jugador"
  y "+ Sesión / + Partido / + Zonas" desaparecen, y en su lugar ve un
  aviso invitándola a activar un medio de pago.
- Esto está reforzado en la base de datos (no sólo en la pantalla):
  aunque alguien intentara forzar la carga editando el código del
  navegador, Supabase la rechaza igual.
- **El entrenador y los "Alumno C.A.R.F."** no tienen este límite —
  siempre pueden cargar.

Cuando quieras cambiar la duración (por ejemplo a 14 o 30 días), es
un solo número para ajustar en `supabase/schema.sql` — avisame y lo
hacemos.

## Cobro real — Mercado Pago (ya conectado)

**Precio definido** (se ve en la tarjeta "Mi suscripción"):

| | Mensual | Anual (2 meses gratis) |
|---|---|---|
| Resto del mundo (USD) | USD 9 | USD 90 |
| Argentina (ARS) | $14.000 | $140.000 |

El precio en pesos se calculó con el dólar blue del 5/9/2026
(~$1.540). Como el dólar en Argentina se mueve seguido, conviene
revisar este valor cada tanto — avisame cuando quieras actualizarlo y
te cambio el número en un momento (está en `src/CarfApp.jsx`, buscá
`PRECIOS`).

**Cómo funciona ahora**: cuando una familia elige "Argentina (ARS)" y
toca "Mercado Pago", la app la manda a la página de pago real de
Mercado Pago. Cuando paga, Mercado Pago le avisa automáticamente a
la app (esto se llama "webhook", vive en `api/mp-webhook.js`), y la
cuenta de esa familia pasa sola a "SUSCRIPCIÓN ACTIVA" — sin que
nadie tenga que hacer nada a mano.

**Importante — variables que hay que cargar en Vercel** (Settings →
Environment Variables, no en el `.env` de tu compu, porque son
secretas y no deben viajar al navegador):

```
MP_ACCESS_TOKEN=el access token de Mercado Pago (producción)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=la clave service_role de Supabase (Settings → API → Legacy anon, service_role)
APP_URL=https://mi-mvp-carf.vercel.app (o el dominio final que uses)
```

Después de cargarlas, hay que volver a desplegar el proyecto en
Vercel una vez para que las tome (un simple "Redeploy" alcanza, no
hace falta subir la carpeta de nuevo si no cambió nada más).

**Transferencia bancaria (manual, ya conectada)**: cuando una familia
toca "Transferencia" (con "Argentina (ARS)" elegido), ve tu alias
(`chueco.madero.basico`) y el monto a transferir. Una vez que
transfiere de verdad, te avisa por fuera de la app (WhatsApp, en
persona), y vos confirmás el pago desde la pantalla **"Familias"** →
botón **"Confirmar pago (transferencia)"` en la fila de esa familia —
ahí pasa a "Suscripción activa" igual que si hubiera pagado con
Mercado Pago. Si te transfirieron por error o querés revertirlo, el
mismo botón lo saca de "activa" y vuelve a "trial".

**Todavía sin conectar** (queda pendiente para más adelante):
- **Stripe**: para cobrar en dólares a familias fuera de Argentina —
  hoy el chip "Tarjeta" sigue deshabilitado.

## Borrar un jugador

Entrando a la ficha del jugador → "Editar" → botón rojo **"🗑 Eliminar
jugador"** al final (pide confirmación). Al borrar un jugador se
borran también, automáticamente, todas sus sesiones, partidos, zonas
y videos — no queda nada suelto. Lo puede borrar la familia dueña de
ese jugador, o el entrenador.

## Instalar la app en el celular (ícono propio)

Ya tiene todo lo necesario (manifest + íconos) para instalarse como
cualquier app, sin pasar por ninguna tienda:

- **Android/Chrome**: entrar a `mi-mvp-carf.vercel.app` → menú (⋮) →
  "Instalar app" o "Agregar a pantalla de inicio".
- **iPhone/Safari**: entrar a la misma dirección → botón compartir →
  "Agregar a pantalla de inicio".

Queda con el ícono real de Mi MVP y abre a pantalla completa, sin la
barra del navegador — como una app instalada de verdad.

## Evaluación C.A.R.F. (planilla exclusiva del entrenador)

Botón verde **"📋 Evaluación C.A.R.F."** en el Inicio, sólo visible
para la cuenta del entrenador.

- Elegís a los jugadores del turno de hoy (varios a la vez, con
  check), escribís el "Turno" (texto libre, lo cargás vos cada día) y
  la fecha.
- Después vas completando **una planilla por jugador, de a una** —
  9 categorías (Coordinación, Velocidad, Control, Pase, Amague,
  Dribbling, Remate, Cabezazo, Cognición) con sus ítems, cada uno con
  los mismos 10 círculos de siempre (un click = verde/logrado, dos
  clicks = rojo/a trabajar).
- Lleva el logo de **Mi MVP** y el escudo original de **C.A.R.F.**
  arriba, con el título "EVALUACIÓN C.A.R.F." y la fecha.
- Al tocar **"Confirmar y enviar"**, esa planilla queda guardada en
  la ficha de ese jugador — visible para su familia — **sin poder
  editarse después** (es justo en ese momento cuando vos la
  "autorizás": mientras la estás completando no se guardó nada
  todavía).
- Sólo el entrenador puede crear este tipo de carga — reforzado en la
  base de datos, no sólo en la pantalla.
- Suma sola a las **Estadísticas** del jugador: cada evaluación
  aporta a un resumen por período (semanal/mensual/anual, como el
  resto) y además a un **"🏆 Acumulado histórico"** que nunca se
  resetea — el promedio de todas las evaluaciones hechas desde
  siempre.

## Estructura de archivos

```
src/
  main.jsx      → entrada de la app
  App.jsx       → decide si mostrar el login o la app, según la sesión
  Auth.jsx      → pantalla de login / registro
  CarfApp.jsx   → tu archivo original, con las restricciones de rol agregadas
supabase/schema.sql → tablas, roles y permisos en Supabase
```
