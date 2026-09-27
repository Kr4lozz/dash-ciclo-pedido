"use client";

import type { ActivityReading, Analysis, AnalyzeRequest } from "./analysis";
import { getAccessCode } from "./store";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function headers(): HeadersInit {
  const code = getAccessCode();
  return {
    "Content-Type": "application/json",
    ...(code ? { "x-access-code": code } : {}),
  };
}

async function readError(res: Response): Promise<ApiError> {
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  const fallback =
    res.status === 413
      ? "La imagen es demasiado grande."
      : `Error del servidor (${res.status}).`;
  return new ApiError(payload?.error ?? fallback, res.status);
}

async function post<T>(input: AnalyzeRequest, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Sin conexión. Revisa tu internet e intenta de nuevo.", 0);
  }
  if (!res.ok) throw await readError(res);
  const payload = (await res.json()) as { result: T };
  return payload.result;
}

export function analyzeFood(input: Omit<AnalyzeRequest, "kind">, signal?: AbortSignal) {
  return post<Analysis>({ ...input, kind: "comida" }, signal);
}

export function readActivity(image: NonNullable<AnalyzeRequest["image"]>, signal?: AbortSignal) {
  return post<ActivityReading>({ kind: "actividad", image }, signal);
}

/** Verifica el código de acceso y la configuración del servidor sin gastar tokens. */
export async function checkConnection(): Promise<{ model: string }> {
  let res: Response;
  try {
    res = await fetch("/api/analyze", { headers: headers(), cache: "no-store" });
  } catch {
    throw new ApiError("Sin conexión. Revisa tu internet e intenta de nuevo.", 0);
  }
  if (!res.ok) throw await readError(res);
  return (await res.json()) as { model: string };
}
