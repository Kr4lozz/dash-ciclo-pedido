"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button, Field, PageHeader, PasswordField, TextInput } from "@/components/ui";
import { accountApi } from "@/lib/api";
import { signedIn, useSession } from "@/lib/session";

export default function EntrarPage() {
  const session = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user } = await accountApi.login({ username, password });
      signedIn(user); // la app redirige a Hoy
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Entrar" back="/bienvenida" />
      <main className="space-y-4 px-4">
        {session.status === "anon" && session.expired ? (
          <p className="rounded-2xl bg-field p-3 text-sm text-ink-2">
            Tu sesión terminó. Vuelve a entrar para seguir; tus datos están guardados en tu cuenta.
          </p>
        ) : null}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Usuario">
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
            />
          </Field>
          <PasswordField
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? (
            <p role="alert" className="flex gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading || !username || !password}>
            {loading ? <LoaderCircle className="size-5 animate-spin" /> : null}
            Entrar
          </Button>
        </form>
        <p className="text-center text-sm text-ink-2">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-accent-text">
            Crear cuenta
          </Link>
        </p>
        <p className="text-center text-xs text-muted">
          ¿Olvidaste tu contraseña? Pídele a quien administra la familia que te dé una nueva desde
          la app.
        </p>
      </main>
    </>
  );
}
