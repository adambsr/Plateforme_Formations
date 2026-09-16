import type { TrainingType } from './types.js';

export function formatPrice(priceMinor: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(priceMinor / 100);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours === 0
    ? `${remainder} min`
    : remainder === 0
      ? `${hours} h`
      : `${hours} h ${remainder} min`;
}

export function typeLabel(type: TrainingType): string {
  return type === 'SELF_PACED_ONLINE' ? 'En ligne autonome' : 'Présentiel';
}
