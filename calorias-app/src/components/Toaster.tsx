"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { dismissToast, useToasts } from "@/lib/toast";
import { cx } from "./ui";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={cx(
            "pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium shadow-lg ring-1 ring-border",
            t.tone === "error" ? "bg-danger-soft text-danger-text" : "bg-card text-ink",
          )}
        >
          {t.tone === "error" ? (
            <TriangleAlert className="size-5 shrink-0" />
          ) : (
            <CircleCheck className="size-5 shrink-0 text-accent-text" />
          )}
          {t.message}
        </button>
      ))}
    </div>
  );
}
