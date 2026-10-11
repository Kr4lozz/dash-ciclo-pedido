import { isValidDateStr } from "@/lib/dates";

// Una actividad como archivo de calendario (.ics) para agregarla al calendario del celular.
// No guarda nada ni pide sesión: arma el archivo con los datos del enlace.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** Escapa y parte las líneas como pide el formato (máx. ~75 bytes por línea). */
function line(name: string, value: string): string {
  const text = `${name}:${value}`;
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += 60) parts.push(text.slice(i, i + 60));
  return parts.join("\r\n ");
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const compactDate = (d: string) => d.replaceAll("-", "");

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = (q.get("title") ?? "").trim().slice(0, 100);
  const date = q.get("date");
  const time = q.get("time");
  const note = (q.get("note") ?? "").trim().slice(0, 300);
  const id = (q.get("id") ?? "").replace(/[^\w-]/g, "").slice(0, 64) || crypto.randomUUID();
  const minutes = Math.min(720, Math.max(5, Math.round(Number(q.get("min")) || 60)));
  if (!title || !isValidDateStr(date) || (time !== null && !TIME_RE.test(time))) {
    return new Response("Faltan el título o la fecha.", { status: 400 });
  }

  const [y, m, d] = date.split("-").map(Number);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const event = [
    "BEGIN:VEVENT",
    line("UID", `${id}@mis-calorias`),
    line("DTSTAMP", stamp),
  ];
  if (time) {
    // Hora «flotante»: el calendario la toma en la zona horaria del celular.
    const [hh, mm] = time.split(":").map(Number);
    const end = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
    const fmt = (x: Date) =>
      `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`;
    event.push(line("DTSTART", fmt(new Date(Date.UTC(y, m - 1, d, hh, mm)))), line("DTEND", fmt(end)));
  } else {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    event.push(
      line("DTSTART;VALUE=DATE", compactDate(date)),
      line("DTEND;VALUE=DATE", `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`),
    );
  }
  event.push(line("SUMMARY", esc(title)));
  if (note) event.push(line("DESCRIPTION", esc(note)));
  if (time) {
    // Un aviso 10 minutos antes.
    event.push("BEGIN:VALARM", "ACTION:DISPLAY", line("DESCRIPTION", esc(title)), "TRIGGER:-PT10M", "END:VALARM");
  }
  event.push("END:VEVENT");

  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mis Calorias//Agenda//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...event, "END:VCALENDAR", ""].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="actividad.ics"',
      "Cache-Control": "no-store",
    },
  });
}
