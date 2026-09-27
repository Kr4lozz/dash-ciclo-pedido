"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={cx("rounded-3xl bg-card p-4 ring-1 ring-border", className)}>{children}</Tag>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 disabled:opacity-50",
  secondary: "bg-field text-ink ring-1 ring-border hover:brightness-95 disabled:opacity-50",
  ghost: "text-accent-text hover:bg-accent-soft disabled:opacity-50",
  danger: "bg-danger-soft text-danger-text hover:brightness-95 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variants[variant],
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl bg-field px-3.5 py-2.5 text-base text-ink ring-1 ring-border placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

/** Input numérico con teclado decimal en el celular; admite coma o punto. */
export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...props}
      className={cx(inputClass, "tabular", props.className)}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("flex gap-1 rounded-2xl bg-field p-1 ring-1 ring-border", className)}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cx(
              "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition",
              active ? "bg-card text-ink shadow-sm ring-1 ring-border" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({
  title,
  back = "/",
  right,
}: {
  title: string;
  back?: string | null;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-2 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
      {back ? (
        <Link
          href={back}
          aria-label="Volver"
          className="-ml-2 grid size-10 place-items-center rounded-full text-ink hover:bg-field"
        >
          <ChevronLeft className="size-6" />
        </Link>
      ) : null}
      <h1 className="flex-1 text-xl font-bold tracking-tight">{title}</h1>
      {right}
    </header>
  );
}

/** Punto de color que identifica una serie junto a su etiqueta de texto. */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: color }}
    />
  );
}
