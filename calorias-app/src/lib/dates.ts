// Las fechas se guardan como "YYYY-MM-DD" en hora local para que un registro
// hecho a las 23:30 no caiga en el día siguiente por la zona horaria.

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function isValidDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Los últimos `n` días terminando en `end` (incluido), en orden cronológico. */
export function lastNDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

const longFmt = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const shortFmt = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});
const weekdayFmt = new Intl.DateTimeFormat("es", { weekday: "narrow" });

/** "Hoy", "Ayer", "Mañana" o "sáb, 27 sept" */
export function dateLabel(s: string): string {
  const today = todayStr();
  if (s === today) return "Hoy";
  if (s === addDays(today, -1)) return "Ayer";
  if (s === addDays(today, 1)) return "Mañana";
  return longFmt.format(parseDateStr(s));
}

export function longDate(s: string): string {
  return longFmt.format(parseDateStr(s));
}

export function shortDate(s: string): string {
  return shortFmt.format(parseDateStr(s));
}

/** Inicial del día de la semana: "L", "M", "X"... */
export function weekdayInitial(s: string): string {
  return weekdayFmt.format(parseDateStr(s)).toUpperCase();
}
