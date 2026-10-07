"use client";

import { useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, Stethoscope } from "lucide-react";
import type { AiStatus as Status, Attempt, ChainProbe } from "@/lib/ai-shared";
import { accountApi } from "@/lib/api";
import { fmt1 } from "@/lib/format";
import { Button, Card, cx } from "./ui";

type State =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; report: Status }
  | { phase: "error"; message: string };

const seconds = (ms: number) => `${fmt1(ms / 1000)} s`;

/** Familia → Estado de la IA: prueba la IA de verdad para saber qué falla y dónde. */
export function AiStatus() {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function run() {
    setState({ phase: "running" });
    try {
      setState({ phase: "done", report: await accountApi.aiStatus() });
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message });
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Stethoscope className="size-5" /> Estado de la IA
      </h2>
      <p className="text-sm text-ink-2">
        Si el análisis de comidas falla, esta prueba muestra qué responde cada modelo y si el problema es de
        Gemini, de tu llave o de la app. Usa unas pocas solicitudes de la cuota.
      </p>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => void run()}
        disabled={state.phase === "running"}
      >
        {state.phase === "running" ? <LoaderCircle className="size-5 animate-spin" /> : null}
        {state.phase === "running" ? "Probando… puede tardar hasta 40 s" : state.phase === "done" ? "Probar de nuevo" : "Probar ahora"}
      </Button>
      {state.phase === "error" ? <p className="text-sm text-danger-text">{state.message}</p> : null}
      {state.phase === "done" ? <Report report={state.report} /> : null}
    </Card>
  );
}

function Report({ report }: { report: Status }) {
  const healthy = report.chains.every((c) => c.ok);
  return (
    <div className="space-y-3">
      <p
        role="status"
        className={cx(
          "flex gap-2 rounded-2xl p-3 text-sm",
          healthy ? "bg-accent-soft text-ink" : "bg-danger-soft text-danger-text",
        )}
      >
        {healthy ? (
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
        ) : (
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <span>{report.verdict}</span>
      </p>

      {!report.database.ok ? (
        <p className="text-sm text-danger-text">
          La base de datos no respondió: eso también puede hacer fallar la app.
        </p>
      ) : null}

      <div>
        <h3 className="mb-1 text-xs font-medium text-ink-2">Respuesta de cada modelo</h3>
        {report.rows.length === 0 ? (
          <p className="text-sm text-muted">No hay ninguna IA configurada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {report.rows.map((r) => (
              <Line key={`${r.provider}-${r.model}`} ok={r.ok}>
                <span className="break-all font-medium">
                  {r.label} · {r.model}
                </span>
                <span className="block text-xs text-muted">
                  {r.ok ? "Responde" : `Falla${r.status ? ` (${r.status})` : ""}`} · {seconds(r.ms)}
                  {r.detail ? ` · ${r.detail}` : ""}
                </span>
              </Line>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-xs font-medium text-ink-2">Lo que hace la app al analizar</h3>
        <ul className="divide-y divide-border">
          {report.chains.map((c) => (
            <Chain key={c.test} chain={c} />
          ))}
        </ul>
      </div>

      {report.available.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-accent-text">
            Modelos Flash que ve tu llave ({report.available.length})
          </summary>
          <p className="mt-2 break-words text-xs text-ink-2">{report.available.join(" · ")}</p>
          <p className="mt-1 text-xs text-muted">
            Para cambiar el principal, pon uno de estos en la variable GEMINI_MODEL de Vercel.
          </p>
        </details>
      ) : null}

      <p className="text-xs text-muted">
        {report.fallbacks.length > 0
          ? `IA de respaldo: ${report.fallbacks.join(", ")}.`
          : "Sin IA de respaldo: si Gemini cae, el análisis falla. Se configura con GROQ_API_KEY, MISTRAL_API_KEY u OPENAI_API_KEY en Vercel."}{" "}
        Base de datos: {report.database.ok ? `bien (${seconds(report.database.ms)})` : "sin respuesta"}.
      </p>
    </div>
  );
}

function Chain({ chain }: { chain: ChainProbe }) {
  return (
    <Line ok={chain.ok}>
      <span className="font-medium">{chain.test === "texto" ? "Análisis de texto" : "Análisis de foto"}</span>
      <span className="block text-xs text-muted">
        {chain.ok ? `Respondió ${chain.via}` : "Ninguna IA respondió"}
        {chain.attempts.length > 0 ? ` · antes falló: ${chain.attempts.map(describe).join(" · ")}` : ""}
      </span>
    </Line>
  );
}

const describe = (a: Attempt) => `${a.model} ${a.status ?? "sin respuesta"}`;

function Line({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      {ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent-text" aria-label="Bien" />
      ) : (
        <CircleX className="mt-0.5 size-4 shrink-0 text-danger-text" aria-label="Falla" />
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
