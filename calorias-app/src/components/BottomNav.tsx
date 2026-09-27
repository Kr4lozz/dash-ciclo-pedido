"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, House, UserRound } from "lucide-react";
import { cx } from "./ui";

const HIDDEN = ["/agregar", "/ejercicio", "/bienvenida", "/entrar", "/registro", "/familia"];

const TABS = [
  { href: "/", label: "Hoy", Icon: House },
  { href: "/progreso", label: "Progreso", Icon: ChartColumn },
  { href: "/perfil", label: "Perfil", Icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  // Las pantallas de registro, de acceso y de familia tienen su propio botón de volver.
  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-md pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-accent-text" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
