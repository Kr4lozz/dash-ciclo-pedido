"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button, Field, PageHeader, PasswordField, TextInput } from "@/components/ui";
import {
  nameError,
  normalizeUsername,
  passwordError,
  usernameError,
} from "@/lib/account";
import { ApiError, accountApi } from "@/lib/api";
import { signedIn } from "@/lib/session";
import { toast } from "@/lib/toast";

/** Sugerencia de usuario a partir del nombre: "María José" → "maria.jose". */
function suggestUsername(name: string) {
  return normalizeUsername(name).replace(/[^a-z0-9._-]/g, "").slice(0, 30);
}

export default function RegistroPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  // El link de invitación trae el código (?codigo=...): se completa solo.
  const [familyCode, setFamilyCode] = useState(
    () => new URLSearchParams(window.location.search).get("codigo")?.trim() ?? "",
  );
  const [codeFromLink, setCodeFromLink] = useState(() => familyCode !== "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = normalizeUsername(usernameTouched ? username : suggestUsername(name));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = nameError(name) ?? usernameError(user) ?? passwordError(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await accountApi.register({ name: name.trim(), username: user, password, familyCode });
      toast(`¡Hola, ${res.user.name}! Completa tu perfil para calcular tu meta.`);
      signedIn(res.user); // la app redirige a Perfil
    } catch (err) {
      setError((err as Error).message);
      // Si el código del link no sirve, se muestra el campo para escribirlo.
      if (err instanceof ApiError && err.status === 403) setCodeFromLink(false);
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Crear cuenta" back="/bienvenida" />
      <main className="space-y-4 px-4">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tu nombre">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              maxLength={40}
              required
              autoFocus
            />
          </Field>
          <Field label="Usuario" hint="Lo usarás para entrar. Solo letras, números y puntos.">
            <TextInput
              value={user}
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value);
              }}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              required
            />
          </Field>
          <PasswordField
            label="Contraseña"
            hint="Mínimo 6 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {codeFromLink ? (
            <p className="rounded-2xl bg-accent-soft p-3 text-sm text-ink-2">
              El código familiar ya viene en tu link de invitación.
            </p>
          ) : (
            <Field label="Código familiar" hint="Te lo da quien te compartió el link.">
              <TextInput
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </Field>
          )}
          {error ? (
            <p role="alert" className="flex gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !name.trim() || !user || !password || !familyCode.trim()}
          >
            {loading ? <LoaderCircle className="size-5 animate-spin" /> : null}
            Crear cuenta
          </Button>
        </form>
        <p className="text-center text-sm text-ink-2">
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="font-semibold text-accent-text">
            Entrar
          </Link>
        </p>
      </main>
    </>
  );
}
