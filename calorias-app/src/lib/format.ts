const intFmt = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

/** 1234.6 → "1235" (en español los miles se agrupan desde 10 000) */
export function fmt(n: number): string {
  return intFmt.format(Math.round(n));
}

/** 72.44 → "72,4" */
export function fmt1(n: number): string {
  return oneFmt.format(Math.round(n * 10) / 10);
}

/** Lee un número escrito con coma o punto decimal. */
export function parseNum(v: string): number {
  const n = Number(v.replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}
