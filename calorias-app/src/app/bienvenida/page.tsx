"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Camera,
  ChartColumn,
  ChevronLeft,
  Droplet,
  Dumbbell,
  History,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Utensils,
} from "lucide-react";
import { WELCOME_SEEN_KEY } from "@/components/ClientGate";
import { Button, ButtonLink, Card } from "@/components/ui";
import { startGuest, useSession } from "@/lib/session";

const FEATURES: { Icon: typeof Camera; title: string; text: string }[] = [
  {
    Icon: Camera,
    title: "Foto de tu comida",
    text: "Toma una foto del plato. La IA reconoce cada alimento y estima la porción, las calorías y los macros. Revisas y corriges antes de guardar.",
  },
  {
    Icon: Sparkles,
    title: "Descríbela con palabras",
    text: "¿Sin foto? Escribe lo que comiste, por ejemplo «2 huevos revueltos y un pan con palta», y la IA hace el cálculo.",
  },
  {
    Icon: History,
    title: "Recientes y manual",
    text: "Vuelve a agregar en un toque lo que comes seguido, o escribe tú los datos de una etiqueta.",
  },
  {
    Icon: Smartphone,
    title: "Calorías quemadas",
    text: "Anota las calorías que marca Apple Fitness (o sube la captura de los anillos y la app las lee, sin IA). También puedes elegir una actividad y sus minutos, contar pasos o anotar lo que marca tu reloj.",
  },
  {
    Icon: Scale,
    title: "Déficit del día",
    text: "En «Balance del día» ves cuánto gastaste, cuánto comiste y tu déficit (o superávit): gasto − comidas.",
  },
  {
    Icon: Utensils,
    title: "Qué comer",
    text: "En Menú eliges la comida y ves platos caseros peruanos y económicos, o ingredientes por grupo, con los gramos que te tocan según tu meta y tus macros. También puedes pedir el día completo armado.",
  },
  {
    Icon: Dumbbell,
    title: "Gym y rutinas",
    text: "Anota cada ejercicio con el peso y las repeticiones de cada serie, arma y guarda tus rutinas y mira en Progreso tu volumen, tus récords y cómo sube el peso de cada ejercicio.",
  },
  {
    Icon: Target,
    title: "Tu meta diaria",
    text: "Con tu edad, altura, peso, actividad y objetivo calculamos cuántas calorías te tocan al día. Te queda: meta − comidas + ejercicio.",
  },
  {
    Icon: ChartColumn,
    title: "Progreso",
    text: "Mira tus calorías consumidas y quemadas de los últimos 7 o 30 días con el déficit de cada día y el acumulado, tu entrenamiento (volumen, músculos y récords), cuántos días cumpliste la meta y cómo evoluciona tu peso.",
  },
  {
    Icon: Droplet,
    title: "Agua",
    text: "Suma vasos de agua durante el día hasta llegar a tu meta.",
  },
];

export default function BienvenidaPage() {
  const session = useSession();
  const router = useRouter();
  const accounts =
    session.status === "anon" || session.status === "user" || session.status === "guest";
  const signedIn = session.status === "user";
  const guest = session.status === "guest";

  function start() {
    try {
      window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
    } catch {
      // sin almacenamiento
    }
    router.push("/");
  }

  const actions = signedIn ? (
    <ButtonLink href="/" className="w-full">
      Ir a mi diario
    </ButtonLink>
  ) : guest ? (
    <div className="space-y-2">
      <ButtonLink href="/registro" className="w-full">
        Crear mi cuenta
      </ButtonLink>
      <ButtonLink href="/" variant="secondary" className="w-full">
        Seguir probando
      </ButtonLink>
    </div>
  ) : accounts ? (
    <div className="space-y-2">
      <ButtonLink href="/registro" className="w-full">
        Crear mi cuenta
      </ButtonLink>
      <ButtonLink href="/entrar" variant="secondary" className="w-full">
        Ya tengo cuenta
      </ButtonLink>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          startGuest();
          router.push("/");
        }}
      >
        Probar sin cuenta
      </Button>
      <p className="text-center text-xs text-muted">
        Sin cuenta, tus registros se guardan solo en este celular. Si luego creas tu cuenta,
        puedes pasarlos a ella.
      </p>
    </div>
  ) : (
    <Button className="w-full" onClick={start}>
      Empezar
    </Button>
  );

  const steps = accounts
    ? [
        "Crea tu cuenta (el código familiar viene en el link de invitación) o pruébala sin cuenta.",
        "Completa tu perfil para calcular tu meta de calorías.",
        "Registra tu primera comida con el botón de la cámara.",
        "Instala la app en tu celular para abrirla como cualquier otra.",
      ]
    : [
        "Completa tu perfil para calcular tu meta de calorías.",
        "Registra tu primera comida con el botón de la cámara.",
        "Instala la app en tu celular para abrirla como cualquier otra.",
      ];

  return (
    <main className="space-y-6 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      {signedIn || guest ? (
        <Link
          href="/perfil"
          aria-label="Volver"
          className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-card"
        >
          <ChevronLeft className="size-6" />
        </Link>
      ) : null}

      <section className="pt-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícono estático de la app */}
        <img src="/icon.svg" alt="" className="mx-auto size-20 rounded-[1.4rem] shadow-md" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Mis Calorías</h1>
        <p className="mx-auto mt-2 max-w-xs text-ink-2">
          Tu diario de comida y ejercicio. Toma una foto de tu plato y la app calcula las
          calorías por ti.
        </p>
      </section>

      {actions}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Cómo funciona</h2>
        <ul className="space-y-2">
          {FEATURES.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-3xl bg-card p-4 ring-1 ring-border">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-ink-2">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Primeros pasos</h2>
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                {i + 1}
              </span>
              <span className="pt-0.5 text-ink-2">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Instálala como app</h2>
        <Install title="iPhone">
          Abre el link en <b>Safari</b>, toca el botón <b>Compartir</b> (el cuadrado con la flecha) y
          elige <b>Agregar a pantalla de inicio</b>.
        </Install>
        <Install title="Android">
          Abre el link en <b>Chrome</b>, toca el menú <b>⋮</b> y elige <b>Instalar app</b> o{" "}
          <b>Agregar a pantalla principal</b>.
        </Install>
      </Card>

      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="size-5 text-accent-text" /> Tus datos
        </h2>
        {accounts ? (
          <p className="text-sm text-ink-2">
            Cada persona tiene su cuenta y solo ve sus propios registros. Se guardan en la nube,
            así que puedes usar la app en varios dispositivos sin perder nada. Si la pruebas sin
            cuenta, tus registros quedan solo en tu celular.
          </p>
        ) : (
          <p className="text-sm text-ink-2">
            Tus registros se guardan solo en este dispositivo. Desde Perfil puedes descargar un
            respaldo cuando quieras.
          </p>
        )}
        <p className="text-sm text-ink-2">
          Las fotos de comida se envían a Google Gemini solo para analizarlas; la app no las guarda.
          Los cálculos son estimaciones: ajústalos si algo no cuadra.
        </p>
      </Card>

    </main>
  );
}

function Install({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-field p-3 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-ink-2">{children}</p>
    </div>
  );
}
