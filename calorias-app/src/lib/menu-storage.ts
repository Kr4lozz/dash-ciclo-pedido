import { DEFAULT_SETTINGS, SLOTS, type MenuPlan, type MenuSettings } from "./menu";
import { AVOID, SNACK_KINDS } from "./menu-data";
import { userScopedKey } from "./store";

// El menú y las respuestas se guardan solo en este dispositivo, por cuenta.

export interface MenuState {
  settings: MenuSettings;
  plan: MenuPlan | null;
}

const VERSION = 1;

function cleanSettings(raw: unknown): MenuSettings {
  const o = (raw ?? {}) as Partial<Record<keyof MenuSettings, unknown>>;
  const pickFrom = <T extends string>(valid: readonly T[], v: unknown) =>
    Array.isArray(v) ? valid.filter((id) => v.includes(id)) : null;
  const slots = pickFrom(
    SLOTS.map((s) => s.id),
    o.slots,
  );
  return {
    slots: slots && slots.length > 0 ? slots : DEFAULT_SETTINGS.slots,
    snacks: pickFrom(
      SNACK_KINDS.map((s) => s.id),
      o.snacks,
    ) ?? [],
    avoid: pickFrom(
      AVOID.map((a) => a.id),
      o.avoid,
    ) ?? [],
    discount: typeof o.discount === "boolean" ? o.discount : DEFAULT_SETTINGS.discount,
  };
}

function isPlan(p: unknown): p is MenuPlan {
  const o = p as MenuPlan | null;
  return (
    !!o &&
    typeof o.date === "string" &&
    Array.isArray(o.goal) &&
    Array.isArray(o.meals) &&
    o.meals.every((m) => typeof m?.slot === "string" && Array.isArray(m.items) && Array.isArray(m.total))
  );
}

export function loadMenu(): MenuState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(userScopedKey("menu")) ?? "null");
    if (raw?.v === VERSION) {
      const settings = cleanSettings(raw.settings);
      return { settings, plan: isPlan(raw.plan) ? { ...raw.plan, settings: cleanSettings(raw.plan.settings) } : null };
    }
  } catch {
    // sin almacenamiento o dato dañado
  }
  return { settings: DEFAULT_SETTINGS, plan: null };
}

export function saveMenu(state: MenuState) {
  try {
    window.localStorage.setItem(userScopedKey("menu"), JSON.stringify({ v: VERSION, ...state }));
  } catch {
    // sin espacio: el menú sigue en pantalla
  }
}
