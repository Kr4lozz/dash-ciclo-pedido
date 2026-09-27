# Mis Calorías

App personal (estilo Fitia) para registrar lo que comes con una foto y las calorías que quemas cada día.

## Qué hace

- **Comida por foto:** tomas una foto y la IA (Claude) detecta cada alimento con su porción, kcal y macros. Puedes corregir todo antes de guardar.
- **Comida por texto:** escribes "2 huevos revueltos y un pan con palta" y la IA lo calcula.
- **Registro manual** y **recientes** (vuelves a agregar un alimento con un toque).
- **Ejercicio:**
  - captura de los anillos de Actividad del iPhone (la IA lee las kcal del anillo Moverse);
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
   - `ANTHROPIC_API_KEY`: tu API key de [console.anthropic.com](https://console.anthropic.com).
   - `APP_ACCESS_CODE`: un código que inventes. La app lo pide para usar la IA, así nadie más gasta tu saldo con tu link.
4. Pulsa **Deploy**.
5. Abre el link, ve a **Perfil → Conexión con la IA** y escribe tu código.

Opcional: `ANTHROPIC_MODEL` para usar otro modelo de Claude (por defecto `claude-opus-5`). Por ejemplo, `claude-sonnet-5` cuesta menos por foto.

## Desarrollo local

```bash
cd calorias-app
cp .env.example .env.local   # completa ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

En local, `APP_ACCESS_CODE` es opcional.

## Estructura

- `src/app/page.tsx`: pantalla Hoy.
- `src/app/agregar/`: agregar comida (foto, texto, manual, recientes).
- `src/app/ejercicio/`: agregar ejercicio (captura, actividad, pasos, manual).
- `src/app/progreso/`, `src/app/perfil/`: progreso y perfil.
- `src/app/api/analyze/route.ts`: llamada a Claude con salida estructurada. Es el único código de servidor.
- `src/lib/`: almacenamiento local, cálculos nutricionales, tabla MET y utilidades.
