"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Minus, Plus, Target, Watch } from "lucide-react";
import { BalanceCard, BurnSheet } from "@/components/DayBalance";
import { ExerciseEditSheet, FoodEditSheet } from "@/components/EditSheets";
import { LegacyDataCard } from "@/components/LegacyDataCard";
import { CalorieRing, Meter } from "@/components/Meters";
import { Card, cx } from "@/components/ui";
import { addDays, dateLabel, longDate, todayStr } from "@/lib/dates";
import { fmt, fmt1 } from "@/lib/format";
import { computeTargets, dayActivity, sumFoods } from "@/lib/nutrition";
import { useSession } from "@/lib/session";
import { setSelectedDate, setWater, useAppData, useSelectedDate } from "@/lib/store";
import { MEALS, type ExerciseEntry, type FoodEntry, type MealType } from "@/lib/types";

export default function TodayPage() {
  const data = useAppData();
  const session = useSession();
  const date = useSelectedDate();
  const [editingFood, setEditingFood] = useState<FoodEntry | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseEntry | null>(null);
  const [editingBurn, setEditingBurn] = useState(false);

  const targets = useMemo(() => computeTargets(data.profile), [data.profile]);
  const foods = useMemo(() => data.foods.filter((f) => f.date === date), [data.foods, date]);
  const exercises = useMemo(
    () => data.exercises.filter((e) => e.date === date),
    [data.exercises, date],
  );
  const totals = sumFoods(foods);
  const burn = data.burned[date] ?? null;
  const burned = dayActivity(burn, exercises);
  const water = data.water[date] ?? 0;

  return (
    <>
      <DateNav date={date} />
      <main className="space-y-4 px-4">
        {session.status === "guest" ? (
          <Link
            href="/registro"
            className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-border"
          >
            <span className="flex-1 text-ink-2">Estás probando sin cuenta</span>
            <span className="font-semibold text-accent-text">Crear cuenta</span>
          </Link>
        ) : null}
        <LegacyDataCard />
        {!data.profile ? <ProfileCallout /> : null}

        <Card>
          <CalorieRing goal={targets.calories} consumed={totals.calories} burned={burned} />
        </Card>

        <BalanceCard
          targets={targets}
          goal={data.profile?.goal ?? null}
          eaten={totals.calories}
          burn={burn}
          exercises={exercises}
          onEdit={() => setEditingBurn(true)}
        />

        <Card className="space-y-3.5">
          <h2 className="font-semibold">Macronutrientes</h2>
          <Meter label="Proteína" value={totals.protein} max={targets.protein} color="var(--protein)" />
          <Meter label="Carbohidratos" value={totals.carbs} max={targets.carbs} color="var(--carbs)" />
          <Meter label="Grasas" value={totals.fat} max={targets.fat} color="var(--fat)" />
        </Card>

        {MEALS.map((m) => (
          <MealCard
            key={m.id}
            meal={m.id}
            title={m.label}
            emoji={m.emoji}
            entries={foods.filter((f) => f.meal === m.id)}
            onEdit={setEditingFood}
          />
        ))}

        <ExerciseCard
          entries={exercises}
          burned={burned}
          appleActive={burn?.active ?? null}
          onEdit={setEditingExercise}
          onEditApple={() => setEditingBurn(true)}
        />

        <Card className="space-y-3">
          <h2 className="font-semibold">💧 Agua</h2>
          <Meter label="Tomada" value={water} max={targets.waterMl} color="var(--water)" unit="ml" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWater(date, water - 250)}
              disabled={water <= 0}
              aria-label="Quitar un vaso de agua"
              className="grid size-11 place-items-center rounded-2xl bg-field ring-1 ring-border disabled:opacity-40"
            >
              <Minus className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setWater(date, water + 250)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-field font-semibold ring-1 ring-border hover:brightness-95"
            >
              <Plus className="size-5" /> 1 vaso (250 ml)
            </button>
          </div>
        </Card>
      </main>

      <Link
        href="/agregar?modo=foto"
        aria-label="Agregar comida con una foto"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-13rem))] z-20 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg shadow-black/20 hover:brightness-110"
      >
        <Camera className="size-6" />
      </Link>

      <FoodEditSheet entry={editingFood} onClose={() => setEditingFood(null)} />
      <ExerciseEditSheet entry={editingExercise} onClose={() => setEditingExercise(null)} />
      <BurnSheet
        open={editingBurn}
        onClose={() => setEditingBurn(false)}
        date={date}
        burn={burn}
        bmr={targets.hasProfile ? targets.bmr : null}
      />
    </>
  );
}

function DateNav({ date }: { date: string }) {
  const today = todayStr();
  const label = dateLabel(date);
  return (
    <header className="flex items-center gap-2 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => setSelectedDate(addDays(date, -1))}
        aria-label="Día anterior"
        className="grid size-10 place-items-center rounded-full hover:bg-card"
      >
        <ChevronLeft className="size-6" />
      </button>
      <div className="relative flex-1 text-center">
        <p className="text-xl font-bold tracking-tight">{label}</p>
        <p className="text-xs text-muted">{label === "Hoy" || label === "Ayer" ? longDate(date) : "Toca para elegir fecha"}</p>
        <input
          type="date"
          aria-label="Elegir fecha"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      <button
        type="button"
        onClick={() => setSelectedDate(addDays(date, 1))}
        disabled={date >= today}
        aria-label="Día siguiente"
        className="grid size-10 place-items-center rounded-full hover:bg-card disabled:opacity-30"
      >
        <ChevronRight className="size-6" />
      </button>
    </header>
  );
}

function ProfileCallout() {
  return (
    <Link
      href="/perfil"
      className="flex items-center gap-3 rounded-3xl bg-accent-soft p-4 ring-1 ring-border"
    >
      <Target className="size-6 shrink-0 text-accent-text" />
      <span className="text-sm">
        <span className="block font-semibold">Configura tu perfil</span>
        <span className="text-ink-2">
          Calcularemos tu meta diaria. Mientras tanto usamos 2000 kcal.
        </span>
      </span>
    </Link>
  );
}

function MealCard({
  meal,
  title,
  emoji,
  entries,
  onEdit,
}: {
  meal: MealType;
  title: string;
  emoji: string;
  entries: FoodEntry[];
  onEdit: (f: FoodEntry) => void;
}) {
  const total = entries.reduce((a, f) => a + f.calories, 0);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          <span aria-hidden>{emoji}</span> {title}
        </h2>
        <span className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{fmt(total)}</span> kcal
        </span>
      </div>
      {entries.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {entries.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onEdit(f)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {f.portion ? `${f.portion} · ` : ""}P {fmt1(f.protein)} · C {fmt1(f.carbs)} · G {fmt1(f.fat)}
                  </span>
                </span>
                <span className="tabular text-sm font-semibold">{fmt(f.calories)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <AddLink href={`/agregar?comida=${meal}`} label={`Agregar a ${title.toLowerCase()}`} bordered={entries.length > 0} />
    </Card>
  );
}

function ExerciseCard({
  entries,
  burned,
  appleActive,
  onEdit,
  onEditApple,
}: {
  entries: ExerciseEntry[];
  /** Total que cuenta para el día (Apple Fitness o suma de registros) */
  burned: number;
  appleActive: number | null;
  onEdit: (e: ExerciseEntry) => void;
  onEditApple: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          <span aria-hidden>🔥</span> Ejercicio
        </h2>
        <span className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{burned > 0 ? `+${fmt(burned)}` : "0"}</span> kcal
        </span>
      </div>
      {appleActive !== null || entries.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {appleActive !== null ? (
            <li>
              <button
                type="button"
                onClick={onEditApple}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <Watch className="size-5 shrink-0 text-ink-2" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">Calorías activas · Apple Fitness</span>
                  <span className="block text-xs text-muted">
                    {entries.length > 0
                      ? "Se usan en lugar de los registros de abajo (ya incluyen los entrenamientos del reloj)"
                      : "Incluyen los entrenamientos del reloj"}
                  </span>
                </span>
                <span className="tabular text-sm font-semibold">+{fmt(appleActive)}</span>
              </button>
            </li>
          ) : null}
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  {e.minutes ? <span className="block text-xs text-muted">{e.minutes} min</span> : null}
                </span>
                <span
                  className={cx("tabular text-sm font-semibold", appleActive !== null && "text-muted line-through")}
                >
                  +{fmt(e.calories)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <AddLink
        href="/ejercicio"
        label="Agregar ejercicio"
        bordered={appleActive !== null || entries.length > 0}
      />
    </Card>
  );
}

function AddLink({ href, label, bordered }: { href: string; label: string; bordered: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "mt-2 flex items-center gap-2 pt-2 text-sm font-semibold text-accent-text",
        bordered && "border-t border-border",
      )}
    >
      <Plus className="size-4" /> {label}
    </Link>
  );
}
