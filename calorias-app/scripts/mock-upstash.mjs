// Servidor que imita la API REST de Upstash Redis (solo los comandos que usa la app),
// para probar las cuentas en local sin crear una base real:
//
//   node scripts/mock-upstash.mjs            # escucha en http://127.0.0.1:8079
//   KV_REST_API_URL=http://127.0.0.1:8079 KV_REST_API_TOKEN=dev APP_ACCESS_CODE=familia npm run dev
//
// Los datos viven en memoria y se pierden al detenerlo.

import http from "node:http";

const PORT = Number(process.env.MOCK_UPSTASH_PORT ?? 8079);
const TOKEN = process.env.MOCK_UPSTASH_TOKEN ?? "dev";
const store = new Map(); // clave → { type: "string" | "hash", value, expiresAt }

function entry(key) {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt && e.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return e;
}

function hash(key, create = false) {
  const e = entry(key);
  if (e) {
    if (e.type !== "hash") throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
    return e.value;
  }
  if (!create) return null;
  const value = new Map();
  store.set(key, { type: "hash", value, expiresAt: 0 });
  return value;
}

const str = (v) => String(v);

const commands = {
  ping: () => "PONG",
  flushall: () => (store.clear(), "OK"),
  get: ([k]) => {
    const e = entry(k);
    if (e && e.type !== "string") throw new Error("WRONGTYPE");
    return e ? e.value : null;
  },
  mget: (ks) => ks.map((k) => commands.get([k])),
  set: ([k, v, ...opts]) => {
    let expiresAt = 0;
    let nx = false;
    for (let i = 0; i < opts.length; i++) {
      const o = String(opts[i]).toLowerCase();
      if (o === "ex") expiresAt = Date.now() + Number(opts[++i]) * 1000;
      else if (o === "px") expiresAt = Date.now() + Number(opts[++i]);
      else if (o === "nx") nx = true;
    }
    if (nx && entry(k)) return null;
    store.set(k, { type: "string", value: str(v), expiresAt });
    return "OK";
  },
  keys: ([pattern]) => {
    const re = new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    return [...store.keys()].filter((k) => entry(k) && re.test(k));
  },
  del: (ks) => ks.reduce((n, k) => n + (entry(k) && store.delete(k) ? 1 : 0), 0),
  exists: (ks) => ks.reduce((n, k) => n + (entry(k) ? 1 : 0), 0),
  expire: ([k, s]) => {
    const e = entry(k);
    if (!e) return 0;
    e.expiresAt = Date.now() + Number(s) * 1000;
    return 1;
  },
  ttl: ([k]) => {
    const e = entry(k);
    if (!e) return -2;
    return e.expiresAt ? Math.ceil((e.expiresAt - Date.now()) / 1000) : -1;
  },
  incr: ([k]) => {
    const e = entry(k);
    const n = (e ? Number(e.value) : 0) + 1;
    if (e) e.value = str(n);
    else store.set(k, { type: "string", value: str(n), expiresAt: 0 });
    return n;
  },
  decr: ([k]) => {
    const e = entry(k);
    const n = (e ? Number(e.value) : 0) - 1;
    if (e) e.value = str(n);
    else store.set(k, { type: "string", value: str(n), expiresAt: 0 });
    return n;
  },
  hget: ([k, f]) => hash(k)?.get(str(f)) ?? null,
  hset: ([k, ...fv]) => {
    const h = hash(k, true);
    let added = 0;
    for (let i = 0; i < fv.length; i += 2) {
      if (!h.has(str(fv[i]))) added++;
      h.set(str(fv[i]), str(fv[i + 1]));
    }
    return added;
  },
  hsetnx: ([k, f, v]) => {
    const h = hash(k, true);
    if (h.has(str(f))) return 0;
    h.set(str(f), str(v));
    return 1;
  },
  hgetall: ([k]) => {
    const h = hash(k);
    return h ? [...h].flat() : [];
  },
  hdel: ([k, ...fs]) => {
    const h = hash(k);
    if (!h) return 0;
    const n = fs.reduce((c, f) => c + (h.delete(str(f)) ? 1 : 0), 0);
    if (h.size === 0) store.delete(k);
    return n;
  },
  hlen: ([k]) => hash(k)?.size ?? 0,
};

function run([name, ...args]) {
  const fn = commands[String(name).toLowerCase()];
  if (!fn) return { error: `ERR unknown command '${name}'` };
  try {
    return { result: fn(args) };
  } catch (err) {
    return { error: `ERR ${err.message}` };
  }
}

function encode(value) {
  if (typeof value === "string") return value === "OK" ? value : Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map(encode);
  return value;
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const send = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "Unauthorized" });
      let body;
      try {
        body = JSON.parse(raw || "null");
      } catch {
        return send(400, { error: "ERR invalid json" });
      }
      const base64 = req.headers["upstash-encoding"] === "base64";
      const out = (r) => (base64 && "result" in r ? { result: encode(r.result) } : r);
      if (req.url?.startsWith("/pipeline") || req.url?.startsWith("/multi-exec")) {
        return send(200, body.map((cmd) => out(run(cmd))));
      }
      const r = run(body);
      return send(r.error ? 400 : 200, out(r));
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock upstash en http://127.0.0.1:${PORT}`));
