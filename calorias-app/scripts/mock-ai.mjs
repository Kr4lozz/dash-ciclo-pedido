// IA simulada para probar sin gastar cuota: imita la API de Gemini (generateContent) y una API
// compatible con OpenAI (chat/completions), con fallos que se activan en caliente.
//
//   node scripts/mock-ai.mjs                (puerto 8090)
//   GEMINI_BASE_URL=http://127.0.0.1:8090 \
//   FALLBACK_AI_BASE_URL=http://127.0.0.1:8090/v1 FALLBACK_AI_API_KEY=x FALLBACK_AI_MODEL=mock-vision \
//   GEMINI_API_KEY=falsa npm run dev
//
// Control: POST /__mode {"gemini":{"gemini-flash-latest":"500"},"compat":"ok"}, POST /__reset, GET /__log.
// Modos de Gemini por modelo: ok | 500 | 503 | 404 | 429 | 400 | badkey | schema500 | slow | empty | garbage.
// Modos de la IA compatible: ok | 500 | 503 | 429 | 401 | fences | strict400 | garbage | slow.

import http from "node:http";

const PORT = Number(process.env.PORT) || 8090;
const SLOW_MS = 4000;

const FOOD = {
  isFood: true,
  dishName: "Arroz con pollo",
  items: [{ name: "Arroz con pollo", portion: "1 plato (300 g)", grams: 300, calories: 520, protein: 28, carbs: 62, fat: 17 }],
  confidence: "media",
  notes: "Porción normal.",
};
const ACTIVITY = {
  isActivityScreenshot: true,
  source: "Fitness",
  activeCalories: 480,
  exerciseMinutes: 32,
  steps: 8000,
  notes: "Leído de la captura.",
};

const state = { gemini: {}, compat: "ok", log: [] };

const kindOf = (text) => (text.includes("Lees capturas") || text.includes("actividad de esta captura") ? "actividad" : text.includes("palabra ok") ? "ping" : "comida");
const payloadOf = (kind) => (kind === "actividad" ? ACTIVITY : kind === "ping" ? null : FOOD);

const GOOGLE_ERRORS = {
  500: ["INTERNAL", "An internal error has occurred. Please retry or report in https://developers.generativeai.google/guide/troubleshooting"],
  503: ["UNAVAILABLE", "The model is overloaded. Please try again later."],
  404: ["NOT_FOUND", "models/x is not found for API version v1beta, or is not supported for generateContent."],
  429: ["RESOURCE_EXHAUSTED", "You exceeded your current quota, please check your plan and billing details."],
  400: ["INVALID_ARGUMENT", "Request contains an invalid argument."],
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const send = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const url = new URL(req.url, "http://x");
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return send(400, { error: { code: 400, message: "invalid json", status: "INVALID_ARGUMENT" } });
      }

      // ----- control -----
      if (url.pathname === "/__mode") {
        if (body.gemini) state.gemini = body.gemini;
        if (body.compat) state.compat = body.compat;
        return send(200, state);
      }
      if (url.pathname === "/__reset") {
        state.gemini = {};
        state.compat = "ok";
        state.log = [];
        return send(200, state);
      }
      if (url.pathname === "/__log") return send(200, state.log);

      // ----- Gemini -----
      if (url.pathname === "/v1beta/models" && req.method === "GET") {
        return send(200, {
          models: [
            { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent"] },
            { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
            { name: "models/gemini-3.5-flash-image", supportedGenerationMethods: ["predict"] },
            { name: "models/gemini-3.5-pro", supportedGenerationMethods: ["generateContent"] },
          ],
        });
      }
      const g = url.pathname.match(/^\/v1beta\/models\/([^:]+):generateContent$/);
      if (g && req.method === "POST") {
        const model = decodeURIComponent(g[1]);
        const cfg = body.generationConfig ?? {};
        const schemaMode = Boolean(cfg.responseJsonSchema || cfg.responseSchema);
        const text = JSON.stringify([body.systemInstruction ?? "", body.contents ?? ""]);
        const kind = kindOf(text);
        const mode = state.gemini[model] ?? "ok";
        state.log.push({ api: "gemini", model, mode, schemaMode, kind, image: text.includes("inlineData") });
        const fail = (code, message) => {
          const [status, msg] = GOOGLE_ERRORS[code];
          return send(code, { error: { code, message: message ?? msg, status } });
        };
        if (mode === "badkey") return fail(400, "API key not valid. Please pass a valid API key.");
        if (mode === "schema500" && schemaMode) return fail(500);
        if (GOOGLE_ERRORS[mode]) return fail(Number(mode));
        if (mode === "slow") await wait(SLOW_MS);
        if (mode === "empty") return send(200, { promptFeedback: { blockReason: "SAFETY" } });
        const out = mode === "garbage" ? "esto no es json" : kind === "ping" ? "ok" : JSON.stringify(payloadOf(kind));
        return send(200, {
          candidates: [{ content: { role: "model", parts: [{ text: out }] }, finishReason: "STOP" }],
          modelVersion: `mock-${model}`,
        });
      }

      // ----- compatible con OpenAI -----
      if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
        const content = body.messages?.[0]?.content;
        const text = typeof content === "string" ? content : (content?.find((p) => p.type === "text")?.text ?? "");
        const kind = kindOf(text);
        const mode = state.compat;
        state.log.push({
          api: "compat",
          model: body.model,
          mode,
          auth: req.headers.authorization,
          responseFormat: Boolean(body.response_format),
          temperature: body.temperature !== undefined,
          image: Array.isArray(content) && content.some((p) => p.type === "image_url"),
          kind,
        });
        const err = (status, message) => send(status, { error: { message, type: "error" } });
        if (mode === "500") return err(500, "upstream exploded");
        if (mode === "429") return err(429, "Rate limit reached");
        if (mode === "503") return err(503, "The server is overloaded");
        if (mode === "401") return err(401, "Incorrect API key provided: sk-abcdefghijklmnopqrstuvwxyz");
        if (mode === "strict400" && (body.response_format || body.temperature !== undefined)) {
          return err(400, "Unsupported parameter: 'response_format'");
        }
        if (mode === "slow") await wait(SLOW_MS);
        const json = kind === "ping" ? "ok" : JSON.stringify(payloadOf(kind));
        const out = mode === "garbage" ? "no puedo ayudarte con eso" : mode === "fences" ? `Aquí tienes:\n\`\`\`json\n${json}\n\`\`\`` : json;
        return send(200, { choices: [{ index: 0, message: { role: "assistant", content: out } }] });
      }

      return send(404, { error: { code: 404, message: "not found", status: "NOT_FOUND" } });
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`IA simulada en http://127.0.0.1:${PORT}`));
