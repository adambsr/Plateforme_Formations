export function formatTunisDateTime(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function formatTunisDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function formatPercent(value: number | null): string {
  return value === null ? 'Non calculable' : `${value.toFixed(1)} %`;
}
