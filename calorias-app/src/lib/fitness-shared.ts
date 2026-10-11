// Estado de la conexión automática con Fitness (iPhone), compartido por servidor y pantalla.

export interface FitnessStatus {
  connected: boolean;
  /** última vez que el Atajo mandó datos */
  lastSync: { at: number; days: number; last: string } | null;
}
