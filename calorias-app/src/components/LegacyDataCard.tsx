"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { useSession } from "@/lib/session";
import { discardLegacyData, legacySummary, migrateLegacyData } from "@/lib/store";
import { toast } from "@/lib/toast";
import { Button } from "./ui";

/** Ofrece pasar a la cuenta lo que se registró en este celular antes de usar cuentas. */
export function LegacyDataCard() {
  const session = useSession();
  const [summary, setSummary] = useState(() => legacySummary());
  if (session.status !== "user" || !summary) return null;

  const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null);
  const parts = [
    count(summary.foods, "alimento", "alimentos"),
    count(summary.exercises, "ejercicio", "ejercicios"),
    count(summary.weights, "registro de peso", "registros de peso"),
    summary.profile ? "tu perfil" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3 rounded-3xl bg-accent-soft p-4 ring-1 ring-border">
      <p className="flex items-center gap-2 font-semibold">
        <Smartphone className="size-5 text-accent-text" /> Tienes registros en este celular
      </p>
      <p className="text-sm text-ink-2">
        Son de antes de crear tu cuenta: {parts.join(", ")}. ¿Los pasamos a tu cuenta para no
        perderlos?
      </p>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            migrateLegacyData();
            setSummary(null);
            toast("Registros pasados a tu cuenta");
          }}
        >
          Pasar a mi cuenta
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (confirm("¿Descartar esos registros? No se pasarán a tu cuenta.")) {
              discardLegacyData();
              setSummary(null);
            }
          }}
        >
          No, gracias
        </Button>
      </div>
    </div>
  );
}
