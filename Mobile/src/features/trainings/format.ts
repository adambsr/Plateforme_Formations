import type { Training, TrainingType } from './types';

export function formatEur(priceMinor: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(priceMinor / 100);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

export function trainingTypeLabel(type: TrainingType): string {
  return type === 'SELF_PACED_ONLINE' ? 'En ligne autonome' : 'Présentiel';
}

export function trainerName(training: Training): string {
  return (
    [training.ownerTrainer.firstName, training.ownerTrainer.lastName]
      .filter(Boolean)
      .join(' ') || 'Formateur du centre'
  );
}
