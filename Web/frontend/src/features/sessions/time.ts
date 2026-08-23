const TUNIS_TIME_ZONE = 'Africa/Tunis';

function localParts(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TUNIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === name)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export function tunisInputToUtc(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) throw new Error('Date locale invalide.');
  const [, year, month, day, hour, minute] = match;
  const desired = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const initial = new Date(desired);
  const shown = localParts(initial);
  const shownMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(shown);
  if (shownMatch === null) throw new Error('Conversion de date impossible.');
  const shownUtc = Date.UTC(
    Number(shownMatch[1]),
    Number(shownMatch[2]) - 1,
    Number(shownMatch[3]),
    Number(shownMatch[4]),
    Number(shownMatch[5]),
  );
  const result = new Date(desired - (shownUtc - desired));
  if (localParts(result) !== value) {
    throw new Error('Cette heure locale n’existe pas dans Africa/Tunis.');
  }
  return result.toISOString();
}

export function formatTunisDate(value: string): string {
  return new Intl.DateTimeFormat('fr-TN', {
    timeZone: TUNIS_TIME_ZONE,
    dateStyle: 'full',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(value));
}
