import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { deflateSync } from "node:zlib";
import { z } from "zod";
import type { AiReport, Attempt, ChainProbe, ProbeRow } from "@/lib/ai-shared";
import { AnalysisSchema } from "@/lib/analysis";

// Todo lo que habla con una IA: la cadena de modelos de Gemini, las IA alternativas (respaldo)
// y el diagnóstico. La ruta /api/analyze y la pantalla Familia → Estado de la IA lo comparten.

export const FOOD_PROMPT = `Eres un nutricionista que estima calorías y macronutrientes de comidas para el diario de alimentación personal de un usuario. Recibirás una foto de su comida, una descripción en texto, o ambas.

- Identifica cada alimento o bebida por separado (por ejemplo arroz, pollo a la plancha, ensalada, gaseosa) y estima su porción usando referencias visuales como el tamaño del plato, los cubiertos o las manos.
- Para cada elemento calcula kcal, proteína, carbohidratos y grasa en gramos con valores de referencia habituales (USDA o tablas de composición de alimentos latinoamericanas). Incluye lo que suele quedar oculto: aceite de cocción, mantequilla, salsas, azúcar en bebidas.
- Las calorías de cada elemento deben aproximarse a 4 × proteína + 4 × carbohidratos + 9 × grasa.
- Si el usuario indica cantidades, ingredientes o forma de preparación, dales prioridad sobre lo que infieras de la imagen.
- Reconoce platos típicos de Latinoamérica y España por su nombre y descomponlos en sus componentes principales cuando eso mejore la precisión.
- Si no hay comida ni bebida, responde con isFood = false, sin elementos, y explica en notes qué se ve.
- En portion usa una medida casera seguida del peso, por ejemplo "1 taza (160 g)". En notes escribe como máximo dos frases con los supuestos principales.

Escribe todo en español, con nombres de alimentos cortos y claros.`;

export const ACTIVITY_PROMPT = `Lees capturas de pantalla de apps de actividad física (Actividad o Fitness de Apple, Apple Watch, Samsung Health, Google Fit, Garmin, etc.) para registrar las calorías que un usuario quemó en el día.

- activeCalories: calorías activas del día. En los anillos de Apple es el anillo rojo "Moverse" / "Move" (por ejemplo "450/600 KCAL" → 450). Usa el valor alcanzado, no la meta, y no uses calorías en reposo ni totales si hay un dato de calorías activas.
- exerciseMinutes: valor alcanzado del anillo verde "Ejercicio" / "Exercise".
- steps: pasos del día, si aparecen.
- Si un dato no se lee con claridad, omítelo; no lo inventes.
- Si la imagen no es una captura de actividad física, usa isActivityScreenshot = false.

Escribe notes en español.`;

export interface AiInput {
  /** Lo que se pide en esta llamada (las instrucciones generales van aparte). */
  text: string;
  image?: { mediaType: string; data: string };
}

export class AiFailure extends Error {
  constructor(readonly attempts: Attempt[]) {
    super("La IA no respondió");
  }
}

class BlockedError extends Error {}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---------- Configuración ----------

/** Tope de tiempo de cada intento y de toda la solicitud (la función de Vercel dura 60 s). */
const GEMINI_CAP_MS = Number(process.env.AI_ATTEMPT_TIMEOUT_MS) || 30_000;
const COMPAT_CAP_MS = Number(process.env.AI_ATTEMPT_TIMEOUT_MS) || 25_000;
const BUDGET_MS = 55_000;
const MIN_ATTEMPT_MS = 2_000;

const geminiBase = () => process.env.GEMINI_BASE_URL?.trim().replace(/\/+$/, "") || undefined;

/** Modelos de Gemini en orden de preferencia. Cada uno tiene su propia cuota y capacidad. */
export function geminiModels(): string[] {
  if (!process.env.GEMINI_API_KEY) return [];
  return [...new Set([process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest", "gemini-flash-lite-latest"])];
}

/** IA alternativa con API compatible con OpenAI (chat/completions con imágenes). */
export interface Compat {
  id: string;
  label: string;
  baseURL: string;
  key: string;
  model: string;
}

const PRESETS = [
  { id: "groq", label: "Groq", baseURL: "https://api.groq.com/openai/v1", prefix: "GROQ", model: "meta-llama/llama-4-scout-17b-16e-instruct" },
  { id: "mistral", label: "Mistral", baseURL: "https://api.mistral.ai/v1", prefix: "MISTRAL", model: "mistral-small-latest" },
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", prefix: "OPENAI", model: "gpt-4o-mini" },
] as const;

/** Las IA de respaldo configuradas, en el orden en que se prueban. */
export function compatProviders(): Compat[] {
  const env = process.env;
  const list: Compat[] = [];
  const base = env.FALLBACK_AI_BASE_URL?.trim().replace(/\/+$/, "");
  const key = env.FALLBACK_AI_API_KEY?.trim();
  const model = env.FALLBACK_AI_MODEL?.trim();
  if (base && key && model) {
    list.push({ id: "alternativa", label: env.FALLBACK_AI_NAME?.trim() || "IA alternativa", baseURL: base, key, model });
  }
  for (const p of PRESETS) {
    const k = env[`${p.prefix}_API_KEY`]?.trim();
    if (k) {
      list.push({ id: p.id, label: p.label, baseURL: p.baseURL, key: k, model: env[`${p.prefix}_MODEL`]?.trim() || p.model });
    }
  }
  return list;
}

export const aiConfigured = () => geminiModels().length > 0 || compatProviders().length > 0;

/** Nombre del modelo principal (para mostrar). */
export const primaryModel = () => geminiModels()[0] ?? compatProviders()[0]?.model ?? "";

export function providerLabel(id: string): string {
  if (id === "gemini") return "Gemini";
  return compatProviders().find((p) => p.id === id)?.label ?? PRESETS.find((p) => p.id === id)?.label ?? id;
}

// ---------- Errores ----------

const redact = (s: string) =>
  s
    .replace(/\b(?:AIza|gsk_|sk-|sk_)[0-9A-Za-z_-]{16,}/g, "[clave]")
    .replace(/https?:\/\/\S+/g, "…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

/** Google responde con un JSON {error:{code,message,status}}; deja solo lo útil. */
function googleReason(message: string): string {
  try {
    const e = (JSON.parse(message) as { error?: { message?: string; status?: string } }).error;
    if (e?.message) return `${e.status ? `${e.status}: ` : ""}${e.message}`;
  } catch {
    // texto plano
  }
  return message;
}

const KEY_RE = /api key not valid|api_key_invalid|invalid api key|incorrect api key|unauthori[sz]ed/i;

function failed(provider: string, model: string, err: unknown, ms: number): Attempt {
  const base = { provider, model, ms };
  if (err instanceof ApiError || err instanceof HttpError) {
    const reason = redact(err instanceof ApiError ? googleReason(err.message) : err.message);
    return { ...base, status: err.status, reason, badKey: err.status === 401 || KEY_RE.test(reason) };
  }
  if (err instanceof BlockedError) return { ...base, status: null, reason: `Sin respuesta (${redact(err.message)})` };
  if (err instanceof SyntaxError || err instanceof z.ZodError) {
    return { ...base, status: null, reason: "Respuesta con formato inválido" };
  }
  if (err instanceof Error && /timeout|timed out|abort/i.test(`${err.name} ${err.message}`)) {
    return { ...base, status: 408, reason: "Tiempo agotado" };
  }
  return { ...base, status: null, reason: redact(err instanceof Error ? err.message : String(err)) };
}

/** Código y mensaje que se le devuelven a la app cuando ninguna IA respondió. */
export function failureResponse(attempts: Attempt[]): { status: number; error: string } {
  const all = (pred: (a: Attempt) => boolean) => attempts.length > 0 && attempts.every(pred);
  if (all((a) => a.badKey || a.status === 401 || a.status === 403)) {
    return { status: 502, error: "La llave de la IA (GEMINI_API_KEY) no es válida o no tiene permisos." };
  }
  if (all((a) => a.status === 429)) {
    return {
      status: 429,
      error: "Llegaste al límite gratuito de la IA. Espera un minuto (o hasta mañana si es el límite diario).",
    };
  }
  if (all((a) => a.status === 400)) {
    return { status: 400, error: "No se pudo procesar la imagen o el texto. Prueba con otra foto." };
  }
  const codes = [...new Set(attempts.map((a) => `${providerLabel(a.provider)} ${a.status ?? "sin respuesta"}`))].join(", ");
  if (all((a) => a.status === 503 || a.status === 429)) {
    return { status: 503, error: `La IA está saturada en este momento. Intenta de nuevo en un minuto. (${codes})` };
  }
  return { status: 502, error: `La IA no está disponible ahora. Intenta en unos segundos. (${codes})` };
}

// ---------- Llamadas ----------

function jsonSchemaOf(schema: z.ZodType) {
  const s = z.toJSONSchema(schema);
  delete s.$schema; // Gemini no admite esta clave
  return s;
}

type GeminiMode = "schema" | "json";

function geminiClient(timeout: number) {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout, ...(geminiBase() ? { baseUrl: geminiBase() } : {}) },
  });
}

/**
 * Llama a un modelo de Gemini. En modo «schema» la respuesta sale con el esquema forzado; en
 * «json» el esquema va en el texto (sirve si un modelo nuevo rechaza el esquema).
 */
async function callGemini<T extends z.ZodType>(
  model: string,
  schema: T,
  instruction: string,
  input: AiInput,
  mode: GeminiMode,
  timeout: number,
): Promise<z.infer<T>> {
  const responseJsonSchema = jsonSchemaOf(schema);
  const parts: Part[] = [];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mediaType, data: input.image.data } });
  parts.push({
    text:
      mode === "json"
        ? `${input.text}\n\nResponde solo con un objeto JSON que cumpla este esquema JSON:\n${JSON.stringify(responseJsonSchema)}`
        : input.text,
  });
  const res = await geminiClient(timeout).models.generateContent({
    model,
    contents: parts,
    config: {
      systemInstruction: instruction,
      responseMimeType: "application/json",
      ...(mode === "schema" ? { responseJsonSchema } : {}),
      temperature: 0.2,
    },
  });
  const text = res.text;
  if (!text) throw new BlockedError(res.promptFeedback?.blockReason ?? "sin respuesta");
  return schema.parse(JSON.parse(text));
}

async function errorText(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const e = (JSON.parse(raw) as { error?: { message?: string } | string }).error;
    return typeof e === "string" ? e : (e?.message ?? raw);
  } catch {
    return raw || `HTTP ${res.status}`;
  }
}

/** Quita bloques ```json y texto alrededor del objeto. */
function extractJson(text: string): string {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

/** Pide un completado a una API compatible con OpenAI; devuelve el texto de la respuesta. */
async function chat(p: Compat, content: unknown, timeout: number, strict: boolean): Promise<string> {
  const send = (bare: boolean) =>
    fetch(`${p.baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "user", content }],
        ...(bare ? {} : { temperature: 0.2, ...(strict ? { response_format: { type: "json_object" } } : {}) }),
      }),
      signal: AbortSignal.timeout(timeout),
    });
  let res = await send(false);
  // Algunos modelos no aceptan temperature o response_format: se repite solo con lo básico.
  if (res.status === 400) res = await send(true);
  if (!res.ok) throw new HttpError(res.status, await errorText(res));
  const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new BlockedError("la IA no devolvió texto");
  return text;
}

async function callCompat<T extends z.ZodType>(
  p: Compat,
  schema: T,
  instruction: string,
  input: AiInput,
  timeout: number,
): Promise<z.infer<T>> {
  const prompt = [
    instruction,
    input.text,
    `Responde SOLO con un objeto JSON (sin texto extra ni bloques de código) que cumpla este esquema JSON:\n${JSON.stringify(jsonSchemaOf(schema))}`,
  ].join("\n\n");
  const content = input.image
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${input.image.mediaType};base64,${input.image.data}` } },
      ]
    : prompt;
  return schema.parse(JSON.parse(extractJson(await chat(p, content, timeout, true))));
}

// ---------- Cadena de intentos ----------

export interface AiResult<T> {
  value: T;
  /** id del proveedor que respondió: «gemini» o el de la IA alternativa */
  provider: string;
  model: string;
  /** intentos fallidos antes de la respuesta */
  attempts: Attempt[];
}

/** El fallo pudo venir del esquema forzado (no de una caída): vale repetir sin esquema. */
const schemaSuspect = (a: Attempt) =>
  a.status === 400 || a.status === 500 || (a.status === null && a.reason.startsWith("Respuesta"));

/**
 * Prueba los modelos de Gemini uno tras otro (cada uno con su cuota y su capacidad) y, si ninguno
 * responde, las IA alternativas configuradas. Lanza AiFailure con todos los intentos si falla todo.
 */
export async function runAi<T extends z.ZodType>(
  schema: T,
  instruction: string,
  input: AiInput,
  budgetMs = BUDGET_MS,
): Promise<AiResult<z.infer<T>>> {
  const attempts: Attempt[] = [];
  const deadline = Date.now() + budgetMs;

  async function step(
    provider: string,
    model: string,
    cap: number,
    call: (timeout: number) => Promise<z.infer<T>>,
  ): Promise<{ value: z.infer<T> } | Attempt> {
    const left = deadline - Date.now() - 200;
    const timeout = Math.min(cap, left);
    if (left < MIN_ATTEMPT_MS) {
      const a: Attempt = { provider, model, status: null, reason: "Sin tiempo para intentarlo", ms: 0 };
      attempts.push(a);
      return a;
    }
    const t0 = Date.now();
    try {
      return { value: await call(timeout) };
    } catch (err) {
      const a = failed(provider, model, err, Date.now() - t0);
      attempts.push(a);
      return a;
    }
  }

  let geminiKeyBad = false;
  for (const model of geminiModels()) {
    if (geminiKeyBad) break;
    for (const mode of ["schema", "json"] as const) {
      const label = mode === "json" ? `${model} (sin esquema)` : model;
      const r = await step("gemini", label, GEMINI_CAP_MS, (t) => callGemini(model, schema, instruction, input, mode, t));
      if ("value" in r) return { value: r.value, provider: "gemini", model: label, attempts };
      if (r.badKey) {
        geminiKeyBad = true;
        break;
      }
      if (!schemaSuspect(r)) break;
    }
  }
  for (const p of compatProviders()) {
    const r = await step(p.id, p.model, COMPAT_CAP_MS, (t) => callCompat(p, schema, instruction, input, t));
    if ("value" in r) return { value: r.value, provider: p.id, model: p.model, attempts };
  }
  throw new AiFailure(attempts);
}

// ---------- Diagnóstico ----------

const PROBE_MS = 15_000;
const PROBE_CHAIN_BUDGET_MS = 20_000;

let pngCache: string | undefined;

/** Una imagen PNG válida y diminuta (degradado) para probar el camino de las fotos. */
function tinyPng(): string {
  if (pngCache) return pngCache;
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const size = 48;
  const row = size * 3 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * row + 1 + x * 3;
      raw[i] = 200 + Math.round((x / size) * 40);
      raw[i + 1] = 120 + Math.round((y / size) * 80);
      raw[i + 2] = 60;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  pngCache = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
  return pngCache;
}

async function probeGemini(model: string): Promise<ProbeRow> {
  const t0 = Date.now();
  try {
    const res = await geminiClient(PROBE_MS).models.generateContent({
      model,
      contents: "Responde solo con la palabra ok.",
      config: { maxOutputTokens: 32, temperature: 0 },
    });
    return {
      provider: "gemini",
      label: "Gemini",
      model,
      ok: true,
      status: 200,
      ms: Date.now() - t0,
      detail: res.modelVersion ? `Responde con ${res.modelVersion}` : "",
    };
  } catch (err) {
    const a = failed("gemini", model, err, Date.now() - t0);
    return { provider: "gemini", label: "Gemini", model, ok: false, status: a.status, ms: a.ms, detail: a.reason };
  }
}

async function probeCompat(p: Compat): Promise<ProbeRow> {
  const t0 = Date.now();
  try {
    await chat(p, "Responde solo con la palabra ok.", PROBE_MS, false);
    return { provider: p.id, label: p.label, model: p.model, ok: true, status: 200, ms: Date.now() - t0, detail: "" };
  } catch (err) {
    const a = failed(p.id, p.model, err, Date.now() - t0);
    return { provider: p.id, label: p.label, model: p.model, ok: false, status: a.status, ms: a.ms, detail: a.reason };
  }
}

async function listGeminiModels(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${geminiBase() ?? "https://generativelanguage.googleapis.com"}/v1beta/models?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    return (body.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /flash/i.test(m.name ?? ""))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .sort();
  } catch {
    return [];
  }
}

async function probeChain(test: ChainProbe["test"]): Promise<ChainProbe> {
  const input: AiInput =
    test === "texto"
      ? { text: "Estima las calorías y macros de esta comida: 1 manzana mediana." }
      : { text: "Analiza la comida de la foto.", image: { mediaType: "image/png", data: tinyPng() } };
  try {
    const r = await runAi(AnalysisSchema, FOOD_PROMPT, input, PROBE_CHAIN_BUDGET_MS);
    return { test, ok: true, via: `${providerLabel(r.provider)} · ${r.model}`, attempts: r.attempts };
  } catch (err) {
    if (err instanceof AiFailure) return { test, ok: false, via: null, attempts: err.attempts };
    throw err;
  }
}

function verdictOf(r: Omit<AiReport, "verdict">): string {
  const gem = r.rows.filter((x) => x.provider === "gemini");
  const chainsOk = r.chains.every((c) => c.ok);
  const gemOk = gem.filter((x) => x.ok).length;
  const codes = [...new Set(gem.filter((x) => !x.ok).map((x) => x.status ?? "sin respuesta"))].join(", ");
  if (!r.geminiKey) {
    return r.fallbacks.length > 0
      ? `Falta GEMINI_API_KEY: la app usa solo la IA de respaldo (${r.fallbacks.join(", ")}).`
      : "No hay ninguna IA configurada: falta GEMINI_API_KEY en las variables de Vercel.";
  }
  if (chainsOk && r.chains.every((c) => c.via?.startsWith("Gemini"))) {
    return gemOk === gem.length
      ? "Todo funciona: Gemini responde con todos sus modelos. Si falló antes, fue algo pasajero de Google."
      : "Gemini responde con algunos modelos y la app usa esos; los demás están fallando ahora.";
  }
  if (chainsOk) {
    return gemOk === gem.length
      ? "Gemini responde a una pregunta simple pero no a las consultas de la app (formato o foto); la IA de respaldo respondió y la app sigue funcionando."
      : `Gemini está fallando ahora (${codes}), pero la IA de respaldo respondió: la app sigue funcionando.`;
  }
  if (gem.length > 0 && gem.every((x) => !x.ok && (x.status === 401 || KEY_RE.test(x.detail)))) {
    return "La llave de Gemini no es válida o no tiene permisos: crea otra en aistudio.google.com/apikey y cámbiala en Vercel.";
  }
  if (gem.length > 0 && gem.every((x) => !x.ok && x.status === 429)) {
    return "Gemini no tiene cuota ahora (límite por minuto o por día). Se renueva solo; con una IA de respaldo la app sigue funcionando.";
  }
  if (gemOk > 0) {
    return "Gemini responde a una pregunta simple, pero falla con el formato o la foto que usa la app: mira el detalle de abajo.";
  }
  if (gem.length > 0 && gem.every((x) => !x.ok && x.status === 404)) {
    return "Los modelos que usa la app ya no existen para tu llave (404). Pon en GEMINI_MODEL uno de la lista de abajo.";
  }
  const backup = r.rows.filter((x) => x.provider !== "gemini");
  if (backup.length > 0) {
    const backupCodes = [...new Set(backup.map((x) => x.status ?? "sin respuesta"))].join(", ");
    return `Gemini (Google) está fallando ahora (${codes}) y la IA de respaldo tampoco responde (${backupCodes}). Espera unos minutos o revisa la llave del respaldo.`;
  }
  return `Gemini (Google) está fallando ahora (${codes}). No depende de tu llave ni de la app. Configura una IA de respaldo o espera unos minutos.`;
}

/** Prueba cada modelo y la cadena real (texto y foto). Gasta unas pocas solicitudes de la cuota. */
export async function probeAi(): Promise<AiReport> {
  const models = geminiModels();
  const compat = compatProviders();
  const [rows, textChain, available] = await Promise.all([
    Promise.all([...models.map(probeGemini), ...compat.map(probeCompat)]),
    probeChain("texto"),
    listGeminiModels(),
  ]);
  const photoChain = await probeChain("foto");
  const report = {
    geminiKey: Boolean(process.env.GEMINI_API_KEY),
    models,
    fallbacks: compat.map((p) => `${p.label} · ${p.model}`),
    available,
    rows,
    chains: [textChain, photoChain],
  };
  return { ...report, verdict: verdictOf(report) };
}
