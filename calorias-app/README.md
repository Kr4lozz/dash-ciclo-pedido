# Mis Calorías

App personal (estilo Fitia) para registrar lo que comes con una foto y las calorías que quemas cada día.

## Qué hace

- **Comida por foto:** tomas una foto y la IA (Google Gemini, capa gratuita) detecta cada alimento con su porción, kcal y macros. Puedes corregir todo antes de guardar.
- **Comida por texto:** escribes "2 huevos revueltos y un pan con palta" y la IA lo calcula.
- **Registro manual** y **recientes** (vuelves a agregar un alimento con un toque).
- **Calorías de Apple Fitness:** en Hoy → **Balance del día** anotas las calorías activas (anillo
  Moverse) y, si quieres, las totales del día. También puedes subir la captura de los anillos: un
  OCR que corre en el celular lee las kcal del anillo Moverse, sin IA y sin costo (si no las
  encuentra, puedes leerla con IA).
- **Déficit del día:** gasto − comidas. El gasto sale de las calorías totales del reloj; si solo
  anotas las activas, se suman a tu metabolismo en reposo (Mifflin-St Jeor); sin datos del reloj se
  estima con tu perfil más el ejercicio registrado.
- **Ejercicio:**
  - actividades con cálculo por MET;
  - pasos;
  - kcal manuales.
- **Menú del día:** preguntas qué comidas haces (desayuno, media mañana, almuerzo, lonche, cena),
  qué snacks te gustan y qué no comes, y arma el día con platos caseros peruanos de bajo costo
  (`src/lib/menu-data.ts`). Las cantidades, en medidas caseras, se ajustan para todo el día a la vez
  con mínimos cuadrados para acercarse a la meta de calorías y macros (`src/lib/menu.ts`), sin IA.
  Cada comida tiene «Otra opción» y «Agregar al diario»; puede descontar lo ya registrado.
- **Meta diaria** calculada con Mifflin-St Jeor según sexo, edad, altura, peso, actividad y objetivo. También puedes fijarla a mano.
- **Resumen del día:** restantes = meta − comidas + ejercicio, macros y agua.
- **Progreso:** calorías por día (7 o 30 días), déficit medio, peso y días dentro de la meta.
- **Se instala en el celular** (Compartir → "Agregar a inicio" en iPhone).

## Cuentas para la familia

Con una base de datos conectada, cada persona crea su cuenta (usuario y contraseña) y sus
registros se guardan en la nube: no se pierden al cambiar de celular y cada uno ve solo lo suyo.

- Para crear una cuenta se pide el **código familiar** (`APP_ACCESS_CODE`), así nadie ajeno a
  la familia crea cuentas ni gasta la cuota de la IA. El link de invitación
  (`/registro?codigo=…`) ya lo incluye, así que la familia no tiene que escribirlo.
- La **primera cuenta** que se crea administra la familia. Desde **Perfil → Familia** puede
  compartir la invitación, dar una contraseña nueva a quien la olvidó y eliminar cuentas.
- **Probar sin cuenta:** quien no quiera registrarse puede usar la app con sus datos solo en el
  celular y hasta 5 análisis con IA por día (`GUEST_AI_DAILY_LIMIT`). Si después crea su cuenta,
  puede pasar esos registros a ella.
- Cada persona tiene un máximo diario de análisis con IA (40 por defecto) para no agotar la
  cuota gratuita de Gemini de toda la familia.
- Si antes usaste la app sin cuenta, al entrar aparece la opción de pasar esos registros a tu
  cuenta.

Sin base de datos la app funciona en **modo local**: todo se guarda solo en el dispositivo
(localStorage) y desde Perfil puedes exportar o importar un respaldo.

## Publicar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio `dash-ciclo-pedido`.
2. En **Root Directory** elige `calorias-app`. Next.js se detecta solo.
3. En **Environment Variables** agrega:
   - `GEMINI_API_KEY`: key gratuita de [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   - `APP_ACCESS_CODE`: el código familiar que inventes.
4. Pulsa **Deploy**.

### Activar las cuentas (base de datos gratis)

1. En el proyecto de Vercel entra a **Storage** → **Create Database** → **Upstash for Redis**
   (plan **Free**).
2. Conéctala al proyecto `calorias-app` (todas las opciones marcadas). Vercel agrega solo las
   variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. En **Deployments**, abre el menú **⋯** del último despliegue y elige **Redeploy**.
4. Abre la app y crea tu cuenta primero (así quedas como administrador).

Opcional: `GEMINI_MODEL` para cambiar el modelo principal (por defecto `gemini-flash-latest`;
si está saturado se usa `gemini-flash-lite-latest`), `AI_DAILY_LIMIT` para el máximo diario
de análisis por persona y `GUEST_AI_DAILY_LIMIT` para quien prueba sin cuenta. Si Gemini falla,
el intento no se descuenta.

La capa gratuita de Gemini tiene límites por minuto y por día. Google puede usar lo que envías
en la capa gratuita para mejorar sus productos: no subas fotos que no quieras compartir.

## Desarrollo local

```bash
cd calorias-app
cp .env.example .env.local   # completa GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000 (modo local)
```

Para probar las cuentas sin crear una base real hay un servidor que imita a Upstash:

```bash
node scripts/mock-upstash.mjs
KV_REST_API_URL=http://127.0.0.1:8079 KV_REST_API_TOKEN=dev APP_ACCESS_CODE=familia npm run dev
```

## Estructura

- `src/app/page.tsx`: pantalla Hoy.
- `src/app/agregar/`: agregar comida (foto, texto, manual, recientes).
- `src/app/ejercicio/`: agregar ejercicio (captura, actividad, pasos, manual).
- `src/app/menu/`: menú del día (preguntas, platos sugeridos y cantidades).
- `src/app/progreso/`, `src/app/perfil/`: progreso y perfil.
- `src/app/bienvenida/`, `src/app/entrar/`, `src/app/registro/`, `src/app/familia/`: inicio, acceso y administración de la familia.
- `src/app/api/analyze/route.ts`: llamada a Gemini con salida JSON estructurada.
- `src/app/api/{session,auth,data,family}/`: cuentas y datos en la base (`src/server/`).
- `src/lib/store.ts`, `src/lib/session.ts`: datos en el navegador y sincronización con la cuenta.
- `src/lib/ocr.ts`, `src/lib/activity-text.ts`: OCR de capturas de actividad (Tesseract.js, en el navegador). `npm run build` copia el motor a `public/ocr` con `scripts/copy-ocr-assets.mjs`.
- `src/lib/`: almacenamiento local, cálculos nutricionales, tabla MET y utilidades.
