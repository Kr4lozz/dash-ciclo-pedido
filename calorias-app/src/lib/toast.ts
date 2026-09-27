"use client";

import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "ok" | "error";
}

const EMPTY: Toast[] = [];
let toasts: Toast[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(message: string, tone: Toast["tone"] = "ok") {
  const t = { id: nextId++, message, tone };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => dismissToast(t.id), tone === "error" ? 5000 : 2600);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}
