# Mis Calorías

App personal (estilo Fitia) para registrar lo que comes con una foto y las calorías que quemas cada día.

## Qué hace

- **Comida por foto:** tomas una foto y la IA (Google Gemini, capa gratuita) detecta cada alimento con su porción, kcal y macros. Puedes corregir todo antes de guardar.
- **Comida por texto:** escribes "2 huevos revueltos y un pan con palta" y la IA lo calcula.
- **Registro manual** y **recientes** (vuelves a agregar un alimento con un toque).
- **Ejercicio:**
  - captura de los anillos de Actividad del iPhone: un OCR que corre en el celular lee las kcal del anillo Moverse, sin IA y sin costo (si no las encuentra, puedes leerla con IA);
  - actividades con cálculo por MET;
  - pasos;
  - kcal manuales.
- **Meta diaria** calculada con Mifflin-St Jeor según sexo, edad, altura, peso, actividad y objetivo. También puedes fijarla a mano.
- **Resumen del día:** restantes = meta − comidas + ejercicio, macros y agua.
- **Progreso:** calorías por día (7 o 30 días), peso y días dentro de la meta.
- **Se instala en el celular** (Compartir → "Agregar a inicio" en iPhone).

Los datos se guardan **en el dispositivo** (localStorage), sin cuentas. Desde Perfil puedes exportar o importar un respaldo JSON.

## Publicar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio `dash-ciclo-pedido`.
2. En **Root Directory** elige `calorias-app`. Next.js se detecta solo.
3. En **Environment Variables** agrega:
   - `GEMINI_API_KEY`: key gratuita de [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (solo necesitas una cuenta de Google).
   - `APP_ACCESS_CODE`: un código que inventes. La app lo pide para usar la IA, así nadie más gasta tu cuota con tu link.
4. Pulsa **Deploy**.
5. Abre el link, ve a **Perfil → Conexión con la IA** y escribe tu código.

Opcional: `GEMINI_MODEL` para usar otro modelo de Gemini (por defecto `gemini-flash-latest`).

La capa gratuita de Gemini tiene límites por minuto y por día (de sobra para uso personal). Google puede usar lo que envías en la capa gratuita para mejorar sus productos: no subas fotos que no quieras compartir.

## Desarrollo local

```bash
cd calorias-app
cp .env.example .env.local   # completa GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

En local, `APP_ACCESS_CODE` es opcional.

## Estructura

- `src/app/page.tsx`: pantalla Hoy.
- `src/app/agregar/`: agregar comida (foto, texto, manual, recientes).
- `src/app/ejercicio/`: agregar ejercicio (captura, actividad, pasos, manual).
- `src/app/progreso/`, `src/app/perfil/`: progreso y perfil.
- `src/app/api/analyze/route.ts`: llamada a Gemini con salida JSON estructurada. Es el único código de servidor.
- `src/lib/ocr.ts`, `src/lib/activity-text.ts`: OCR de capturas de actividad (Tesseract.js, en el navegador). `npm run build` copia el motor a `public/ocr` con `scripts/copy-ocr-assets.mjs`.
- `src/lib/`: almacenamiento local, cálculos nutricionales, tabla MET y utilidades.
