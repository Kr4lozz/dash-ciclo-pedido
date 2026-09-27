"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, LoaderCircle, Share2, Trash2, Users } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { Button, Card, PageHeader } from "@/components/ui";
import { accountApi, type FamilyMember } from "@/lib/api";
import { longDate, toDateStr } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { toast } from "@/lib/toast";

export default function FamiliaPage() {
  const session = useSession();
  const isAdmin = session.status === "user" && session.user.role === "admin";

  return (
    <>
      <PageHeader title="Familia" back="/perfil" />
      <main className="space-y-4 px-4">
        {isAdmin ? (
          <FamilyAdmin selfId={session.user.id} />
        ) : (
          <p className="rounded-3xl bg-card p-6 text-center text-sm text-ink-2 ring-1 ring-border">
            Solo quien administra la familia puede ver esta pantalla.
          </p>
        )}
      </main>
    </>
  );
}

function FamilyAdmin({ selfId }: { selfId: string }) {
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [familyCode, setFamilyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    accountApi.family().then(
      (res) => {
        if (!active) return;
        setMembers(res.members);
        setFamilyCode(res.familyCode);
        setError(null);
      },
      (e: Error) => {
        if (active) setError(e.message);
      },
    );
    return () => {
      active = false;
    };
  }, [version]);

  async function reset(m: FamilyMember) {
    if (!confirm(`¿Darle una contraseña nueva a ${m.name}? La actual dejará de funcionar.`)) return;
    setBusy(m.id);
    try {
      const { password } = await accountApi.resetPassword(m.id);
      setTemp({ name: m.name, password });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: FamilyMember) {
    if (!confirm(`¿Eliminar la cuenta de ${m.name} y todos sus registros? No se puede deshacer.`)) return;
    setBusy(m.id);
    try {
      await accountApi.removeMember(m.id);
      toast(`Cuenta de ${m.name} eliminada`);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  // El código va dentro del link: quien lo abre no tiene que escribirlo.
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/registro?codigo=${encodeURIComponent(familyCode)}`
      : "";
  const invitation = `¡Únete a Mis Calorías! Crea tu cuenta desde este link (el código familiar ya va incluido): ${link}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mis Calorías", text: invitation });
        return;
      }
      await navigator.clipboard.writeText(invitation);
      toast("Invitación copiada: pégala en WhatsApp");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("No se pudo compartir. Copia el texto a mano.", "error");
    }
  }

  return (
    <>
      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Share2 className="size-5" /> Invita a tu familia
        </h2>
        <p className="text-sm text-ink-2">
          Comparte este link: ya lleva el código familiar, así que solo tienen que elegir su usuario
          y contraseña. Cada persona ve solo sus registros.
        </p>
        <div className="rounded-2xl bg-field p-3 text-sm">
          <p className="text-ink-2">Link de invitación</p>
          <p className="break-all font-semibold">{familyCode ? link : "—"}</p>
          <p className="mt-2 text-ink-2">Código familiar</p>
          <p className="font-mono font-semibold">{familyCode || "—"}</p>
        </div>
        <Button className="w-full" onClick={() => void share()} disabled={!familyCode}>
          <Share2 className="size-5" /> Compartir invitación
        </Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="size-5" /> Miembros {members ? `(${members.length})` : ""}
        </h2>
        {error ? <p className="text-sm text-danger-text">{error}</p> : null}
        {!members && !error ? <LoaderCircle className="size-5 animate-spin text-muted" /> : null}
        <ul className="divide-y divide-border">
          {members?.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-text">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {m.name}
                  {m.id === selfId ? " (tú)" : ""}
                </span>
                <span className="block truncate text-xs text-muted">
                  @{m.username} · {m.role === "admin" ? "administra" : `desde ${longDate(toDateStr(new Date(m.createdAt)))}`}
                </span>
              </span>
              {m.id !== selfId ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void reset(m)}
                    disabled={busy === m.id}
                    aria-label={`Contraseña nueva para ${m.name}`}
                    className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-field disabled:opacity-40"
                  >
                    <KeyRound className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(m)}
                    disabled={busy === m.id}
                    aria-label={`Eliminar a ${m.name}`}
                    className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-field hover:text-danger-text disabled:opacity-40"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Con la llave le das una contraseña nueva a quien la olvidó; con la papelera eliminas su
          cuenta.
        </p>
      </Card>

      <Sheet open={temp !== null} onClose={() => setTemp(null)} title="Contraseña nueva">
        {temp ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              Dile a {temp.name} que entre con esta contraseña y la cambie en Perfil → Cambiar
              contraseña.
            </p>
            <p className="rounded-2xl bg-field p-4 text-center font-mono text-2xl font-bold tracking-wide">
              {temp.password}
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(temp.password);
                toast("Contraseña copiada");
              }}
            >
              <Copy className="size-5" /> Copiar
            </Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
