// Tipos del diagnóstico de la IA (Familia → Estado de la IA), compartidos por servidor y pantalla.

/** Un intento (fallido) con un modelo o proveedor. */
export interface Attempt {
  provider: string;
  model: string;
  /** código HTTP, o null si no hubo respuesta utilizable */
  status: number | null;
  reason: string;
  ms: number;
  /** la llave de ese proveedor no sirve: otro modelo con la misma llave tampoco funcionará */
  badKey?: boolean;
}

export interface ProbeRow {
  provider: string;
  /** nombre para mostrar, p. ej. «Gemini» o «Groq» */
  label: string;
  model: string;
  ok: boolean;
  status: number | null;
  ms: number;
  detail: string;
}

export interface ChainProbe {
  test: "texto" | "foto";
  ok: boolean;
  /** quién respondió, p. ej. «Gemini · gemini-flash-lite-latest» */
  via: string | null;
  attempts: Attempt[];
}

export interface AiReport {
  geminiKey: boolean;
  /** modelos de Gemini que usa la app, en orden */
  models: string[];
  /** nombres de las IA alternativas configuradas */
  fallbacks: string[];
  /** modelos «flash» que ve la llave de Gemini */
  available: string[];
  rows: ProbeRow[];
  chains: ChainProbe[];
  verdict: string;
}

export interface AiStatus extends AiReport {
  database: { ok: boolean; ms: number };
}
