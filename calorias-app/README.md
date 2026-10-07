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
- **Gym** (pestaña propia, sin IA): registra tu entrenamiento serie por serie con el peso y las
  repeticiones, y ve la última vez de cada ejercicio mientras entrenas.
  - Catálogo de ~80 ejercicios por grupo muscular (con peso, peso corporal o tiempo) y ejercicios propios.
  - **Rutinas:** crea las tuyas (series y repeticiones por ejercicio), agrega rutinas sugeridas
    (cuerpo completo, empuje, tirón, pierna, torso…), duplícalas, edítalas o guárdalas desde un
    entrenamiento libre.
  - Entrenamiento en curso con descanso entre series (cuenta regresiva); se guarda en el celular y
    no se pierde si cierras la app. Al terminar avisa de los récords nuevos.
  - Historial con edición de entrenamientos pasados; en Hoy aparecen los del día.
  - En **Progreso → Entrenamiento:** entrenamientos, volumen (kg × repeticiones) por día, series por
    grupo muscular, récords personales (con 1RM estimado) y evolución del peso de cada ejercicio.
- **Ejercicio:**
  - actividades con cálculo por MET;
  - pasos;
  - kcal manuales.
- **Menú** (sin IA, con platos caseros peruanos de bajo costo de `src/lib/menu-data.ts`):
  - **Opciones:** eliges desayuno, almuerzo, cena o snack y ves lo que te toca (según lo que te
    queda del día) y el catálogo de platos ordenado por qué tan bien se ajusta, con el peso de
    cada ingrediente y «Agregar al diario». En «Por ingrediente», listas para elegir una opción de
    cada grupo (proteína, carbohidrato, menestras, grasa) con la cantidad que toca.
  - **Día completo:** pregunta qué comidas haces, qué snacks te gustan y qué no comes, y arma el
    día; las cantidades se ajustan para todo el día a la vez con mínimos cuadrados
    (`src/lib/menu.ts`). Cada comida tiene «Otra opción» y «Agregar al diario».
  - Desde Hoy, «¿Qué como?» en cada comida abre sus opciones.
- **Meta diaria** calculada con Mifflin-St Jeor según sexo, edad, altura, peso, actividad y objetivo. También puedes fijarla a mano.
- **Resumen del día:** restantes = meta − comidas + ejercicio, macros y agua.
- **Progreso:** calorías consumidas y quemadas por día (7 o 30 días) y, debajo, el déficit de cada
  día (superávit si comes más de lo que gastas); recuadros con el déficit acumulado (y su equivalente
  en grasa), el consumo, el gasto y el déficit medios; tabla con el acumulado día a día; peso y días
  dentro de la meta. «Quemadas» es el gasto total del día (Apple Fitness o estimado con el perfil) y
  solo cuentan los días con comidas registradas.
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
- **Uso de la app:** en **Perfil → Familia → Uso de la app** quien administra ve, por persona,
  su último uso, los días activos, las aperturas, los toques (aproximados), los registros hechos
  y los análisis con IA de los últimos 7 o 30 días, con las pantallas más vistas. Solo son
  contadores por día (`use:{id}:{año-mes}` en la base): **nunca** se guarda lo que alguien anota
  ni sus fotos, ni a qué botón toca. Todos los miembros lo ven avisado en Perfil, en el registro
  y en la bienvenida. Quien prueba sin cuenta no se cuenta. Se cuenta desde que se activó la
  función y es aproximado: si el celular se apaga o no hay conexión, algo puede perderse.

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
de análisis por persona y `GUEST_AI_DAILY_LIMIT` para quien prueba sin cuenta. Si la IA falla,
el intento no se descuenta.

### Si Gemini falla

- La app prueba un modelo de Gemini tras otro (cada uno tiene su propia cuota y capacidad) y, si
  un modelo rechaza el esquema JSON, lo repite sin esquema. Si todo falla, el mensaje incluye los
  códigos (p. ej. «Gemini 500, Respaldo 429») y en Vercel → Logs queda el detalle de cada intento.
- **IA de respaldo (opcional):** agrega en Vercel una llave y la app la usa sola cuando Gemini no
  responde, avisando que fue otra IA: `GROQ_API_KEY` (gratis en
  [console.groq.com/keys](https://console.groq.com/keys), recomendada), `MISTRAL_API_KEY`
  ([console.mistral.ai/api-keys](https://console.mistral.ai/api-keys)) u `OPENAI_API_KEY` (de pago).
  Cada una admite su `GROQ_MODEL`, `MISTRAL_MODEL` u `OPENAI_MODEL`. Para otra IA con API
  compatible con OpenAI y que acepte imágenes: `FALLBACK_AI_BASE_URL`, `FALLBACK_AI_API_KEY`,
  `FALLBACK_AI_MODEL` y, opcional, `FALLBACK_AI_NAME`. Los modelos de respaldo pueden ser menos
  precisos que Gemini.
- **Perfil → Familia → Estado de la IA** (solo quien administra): «Probar ahora» comprueba cada
  modelo, la consulta real de texto y de foto y la base de datos, y dice si el problema es de
  Gemini, de la llave o de la app. Gasta unas pocas solicitudes de la cuota (máximo 8 pruebas
  cada 10 minutos).
- Para probar sin gastar cuota: `node scripts/mock-ai.mjs` simula Gemini y una IA de respaldo con
  fallos que se activan en caliente (ver el encabezado del archivo).

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
- `src/app/menu/`: opciones por comida y día completo (platos, ingredientes y cantidades).
- `src/app/gym/`: inicio de Gym (entrenar, rutinas, historial), `entrenar/` (entrenamiento en curso
  y edición) y `rutina/` (editor de rutinas). Catálogo en `src/lib/gym-data.ts`, cálculos en
  `src/lib/gym.ts` y borrador del entrenamiento en `src/lib/gym-draft.ts`.
- `src/app/progreso/`, `src/app/perfil/`: progreso y perfil.
- `src/app/bienvenida/`, `src/app/entrar/`, `src/app/registro/`, `src/app/familia/`: inicio, acceso y administración de la familia.
- `src/app/api/analyze/route.ts`: acceso, límites y respuesta del análisis; `src/server/ai.ts`: cadena de modelos de Gemini, IA de respaldo y diagnóstico (`src/app/api/family/ai/`, `src/components/AiStatus.tsx`).
- `src/app/api/{session,auth,data,family}/`: cuentas y datos en la base (`src/server/`).
- `src/lib/usage.ts`, `src/components/UsageTracker.tsx`, `src/app/api/usage/`, `src/app/api/family/usage/`, `src/components/FamilyUsage.tsx`: contadores de uso y su panel para quien administra (`src/lib/usage-shared.ts` define qué se cuenta).
- `src/lib/store.ts`, `src/lib/session.ts`: datos en el navegador y sincronización con la cuenta.
- `src/lib/ocr.ts`, `src/lib/activity-text.ts`: OCR de capturas de actividad (Tesseract.js, en el navegador). `npm run build` copia el motor a `public/ocr` con `scripts/copy-ocr-assets.mjs`.
- `src/lib/`: almacenamiento local, cálculos nutricionales, tabla MET y utilidades.
