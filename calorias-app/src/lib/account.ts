// Tipos y reglas de las cuentas, compartidos por el cliente y el servidor.

export type Role = "admin" | "member";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export interface SessionInfo {
  /** true si el servidor tiene base de datos: la app funciona con cuentas */
  storage: boolean;
  user: SessionUser | null;
}

export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".");
}

export function usernameError(username: string): string | null {
  if (username.length < 3) return "El usuario debe tener al menos 3 caracteres.";
  if (!USERNAME_RE.test(username)) return "Usa solo letras, números, punto, guion o guion bajo.";
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
  if (password.length > 128) return "La contraseña es demasiado larga.";
  return null;
}

export function nameError(name: string): string | null {
  const n = name.trim();
  if (!n) return "Escribe tu nombre.";
  if (n.length > 40) return "El nombre es demasiado largo.";
  return null;
}
