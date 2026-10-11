"use client";

import { useEffect, useState } from "react";
import { Copy, HeartPulse, LoaderCircle } from "lucide-react";
import { accountApi } from "@/lib/api";
import { addDays, longDate, toDateStr } from "@/lib/dates";
import type { FitnessStatus } from "@/lib/fitness-shared";
import { toast } from "@/lib/toast";
import { Button, Card } from "./ui";

const timeFmt = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit" });

/** «hoy, 14:32» · «ayer, 21:05» · «sáb, 3 oct, 8:10» — se calcula al recibir el estado (no al pintar). */
function whenLabel(at: number): string {
  const d = new Date(at);
  const day = toDateStr(d);
  const today = toDateStr(new Date());
  const time = timeFmt.format(d);
  if (day === today) return `hoy, ${time}`;
  if (day === addDays(today, -1)) return `ayer, ${time}`;
  return `${longDate(day)}, ${time}`;
}

type Loaded = { status: FitnessStatus; label: string | null };

/** Perfil → Fitness automático (iPhone): una llave personal para que un Atajo mande las calorías de Fitness. */
export function FitnessCard() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(false);

  function receive(status: FitnessStatus) {
    setLoaded({ status, label: status.lastSync ? whenLabel(status.lastSync.at) : null });
  }

  useEffect(() => {
    let active = true;
    accountApi.fitness().then(
      (status) => {
        if (active) receive(status);
      },
      (e: Error) => {
        if (active) setError(e.message);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    if (token && !confirm("Se creará una llave nueva y la anterior dejará de valer. ¿Continuar?")) return;
    if (!token && loaded?.status.connected && !confirm("Se creará una llave nueva y la del Atajo actual dejará de valer. ¿Continuar?")) return;
    setBusy(true);
    setError(null);
    try {
      const { token: t } = await accountApi.fitnessKey();
      setToken(t);
      setSteps(true);
      receive(await accountApi.fitness());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("¿Desconectar Fitness? El Atajo dejará de poder mandar datos.")) return;
    setBusy(true);
    try {
      await accountApi.fitnessOff();
      setToken(null);
      setSteps(false);
      receive(await accountApi.fitness());
      toast("Fitness desconectado");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const connected = loaded?.status.connected ?? false;
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/fitness` : "";
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    toast(`${what} copiado`);
  };

  return (
    <Card className="space-y-3" as="section">
      <h2 className="flex items-center gap-2 font-semibold">
        <HeartPulse className="size-5" /> Fitness automático (iPhone)
      </h2>
      <p className="text-sm text-ink-2">
        Un Atajo del iPhone manda a tu cuenta las calorías activas y totales que marca Fitness, sin
        subir capturas. Cada día de la app muestra los de esa fecha. En Android sigue subiendo la captura
        como siempre.
      </p>
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      {!loaded && !error ? <LoaderCircle className="size-5 animate-spin text-muted" aria-label="Cargando" /> : null}

      {loaded && connected ? (
        <p className="rounded-2xl bg-accent-soft p-3 text-sm text-ink">
          <span className="font-semibold">Conectado.</span>{" "}
          {loaded.status.lastSync
            ? `Última recepción: ${loaded.label} (${loaded.status.lastSync.days} ${loaded.status.lastSync.days === 1 ? "día" : "días"}).`
            : "Todavía no llegó nada: crea el Atajo y ábrelo una vez."}
        </p>
      ) : null}

      {token ? (
        <div className="space-y-2 rounded-2xl bg-field p-3 text-sm">
          <p className="font-semibold">Tu llave (se muestra solo ahora)</p>
          <p className="break-all font-mono text-[13px]" data-testid="fitness-token">
            {token}
          </p>
          <Button variant="secondary" className="w-full" onClick={() => copy(token, "Llave")}>
            <Copy className="size-4" /> Copiar llave
          </Button>
        </div>
      ) : null}

      {loaded ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => void connect()} disabled={busy}>
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : null}
            {connected ? "Crear llave nueva" : "Conectar con Fitness"}
          </Button>
          {connected ? (
            <Button variant="secondary" className="flex-1" onClick={() => void disconnect()} disabled={busy}>
              Desconectar
            </Button>
          ) : null}
        </div>
      ) : null}

      {loaded && (connected || token) ? (
        <details open={steps} onToggle={(e) => setSteps((e.target as HTMLDetailsElement).open)} className="text-sm">
          <summary className="cursor-pointer font-medium text-accent-text">Pasos del Atajo</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-ink-2">
            <li>
              Abre <b>Atajos</b> → pestaña <b>Atajos</b> → <b>+</b> y llámalo «Enviar Fitness».
            </li>
            <li>
              Agrega <b>Lista</b> con dos elementos: <code>0</code> y <code>1</code> (hoy y ayer; agrega{" "}
              <code>2</code>, <code>3</code>… para más días).
            </li>
            <li>
              Agrega <b>Repetir con cada</b> sobre esa lista. Los pasos 4 a 8 van dentro.
            </li>
            <li>
              <b>Ajustar fecha</b>: Fecha actual, <b>restar</b>, <i>Elemento de repetición</i>, <b>días</b>. Otra{" "}
              <b>Ajustar fecha</b> sobre ese resultado: <b>Obtener inicio del día</b> → llámalo <code>Inicio</code>. Otra:{" "}
              <code>Inicio</code> <b>sumar 1 día</b> → <code>Fin</code>.
            </li>
            <li>
              <b>Buscar muestras de salud</b>: Tipo <b>es</b> <i>Energía activa</i> y Fecha de inicio <b>está entre</b>{" "}
              <code>Inicio</code> y <code>Fin</code>. Luego <b>Calcular estadísticas</b> → <b>Suma</b> → <code>Activa</code>.
            </li>
            <li>
              Lo mismo con <i>Energía en reposo</i> → <code>Reposo</code>.
            </li>
            <li>
              <b>Formatear fecha</b>: <code>Inicio</code>, formato <b>Personalizado</b> <code>yyyy-MM-dd</code> →{" "}
              <code>Fecha</code>.
            </li>
            <li>
              <b>Obtener contenido de URL</b>: URL <code className="break-all">{endpoint}</code>{" "}
              <button
                type="button"
                className="font-semibold text-accent-text"
                onClick={() => copy(endpoint, "Dirección")}
              >
                (copiar)
              </button>
              , método <b>POST</b>, cuerpo <b>JSON</b> con 4 campos: <code>token</code> (Texto: tu llave),{" "}
              <code>fecha</code> (Texto: Fecha), <code>activa</code> (Número: Activa) y <code>reposo</code> (Número: Reposo).
            </li>
            <li>
              Corre el Atajo una vez a mano y toca <b>Permitir</b> (leer Salud y enviar datos).
            </li>
            <li>
              Pestaña <b>Automatización</b> → <b>+</b> → <b>App</b> → <b>Fitness</b> → <b>Está abierta</b> →{" "}
              <b>Ejecutar inmediatamente</b> → <b>Ejecutar atajo</b> «Enviar Fitness».
            </li>
          </ol>
          <p className="mt-2 text-xs text-muted">
            Cada vez que abras Fitness se mandan los días de la lista. El total es activas + reposo, igual que
            Fitness. Los nombres de las acciones pueden variar un poco según tu versión de iOS.
          </p>
        </details>
      ) : null}
    </Card>
  );
}
