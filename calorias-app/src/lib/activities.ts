// Valores MET del Compendio de Actividades Físicas (Ainsworth et al.).
// kcal = MET × peso (kg) × horas

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  met: number;
}

export const ACTIVITIES: Activity[] = [
  { id: "caminar-suave", name: "Caminar suave (3 km/h)", emoji: "🚶", met: 2.8 },
  { id: "caminar", name: "Caminar (5 km/h)", emoji: "🚶", met: 3.5 },
  { id: "caminar-rapido", name: "Caminar rápido (6,5 km/h)", emoji: "🚶", met: 5.0 },
  { id: "correr-8", name: "Correr (8 km/h)", emoji: "🏃", met: 8.3 },
  { id: "correr-10", name: "Correr (10 km/h)", emoji: "🏃", met: 9.8 },
  { id: "correr-12", name: "Correr (12 km/h)", emoji: "🏃", met: 11.8 },
  { id: "bici-paseo", name: "Bicicleta paseo", emoji: "🚴", met: 4.0 },
  { id: "bici-moderada", name: "Bicicleta moderada", emoji: "🚴", met: 8.0 },
  { id: "bici-estatica", name: "Bicicleta estática", emoji: "🚴", met: 6.8 },
  { id: "spinning", name: "Spinning", emoji: "🚴", met: 8.5 },
  { id: "pesas", name: "Pesas (moderado)", emoji: "🏋️", met: 3.5 },
  { id: "pesas-intenso", name: "Pesas (intenso)", emoji: "🏋️", met: 6.0 },
  { id: "hiit", name: "HIIT / circuito", emoji: "🔥", met: 8.0 },
  { id: "natacion", name: "Natación moderada", emoji: "🏊", met: 5.8 },
  { id: "natacion-intensa", name: "Natación intensa", emoji: "🏊", met: 9.8 },
  { id: "futbol", name: "Fútbol", emoji: "⚽", met: 7.0 },
  { id: "basquet", name: "Básquet", emoji: "🏀", met: 6.5 },
  { id: "voley", name: "Vóley", emoji: "🏐", met: 4.0 },
  { id: "tenis", name: "Tenis", emoji: "🎾", met: 7.3 },
  { id: "baile", name: "Baile / zumba", emoji: "💃", met: 6.5 },
  { id: "yoga", name: "Yoga", emoji: "🧘", met: 2.5 },
  { id: "pilates", name: "Pilates", emoji: "🧘", met: 3.0 },
  { id: "eliptica", name: "Elíptica", emoji: "🏃", met: 5.0 },
  { id: "remo", name: "Remo (máquina)", emoji: "🚣", met: 7.0 },
  { id: "escaleras", name: "Subir escaleras", emoji: "🪜", met: 8.0 },
  { id: "cuerda", name: "Saltar la cuerda", emoji: "🪢", met: 11.8 },
  { id: "senderismo", name: "Senderismo", emoji: "🥾", met: 6.0 },
  { id: "boxeo", name: "Boxeo (saco)", emoji: "🥊", met: 5.5 },
  { id: "limpieza", name: "Limpieza de casa", emoji: "🧹", met: 3.3 },
];

export function activityCalories(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0 && weightKg > 0 && minutes > 0)) return 0;
  return Math.round(met * weightKg * (minutes / 60));
}

/** Aproximación: ~0,04 kcal por paso para 70 kg, proporcional al peso. */
export function stepsCalories(steps: number, weightKg: number): number {
  if (!(steps > 0 && weightKg > 0)) return 0;
  return Math.round(steps * weightKg * 0.0005);
}
