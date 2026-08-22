export const SESSION_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export function schedulesOverlap(
  first: { startAt: Date; endAt: Date },
  second: { startAt: Date; endAt: Date },
): boolean {
  return first.startAt < second.endAt && second.startAt < first.endAt;
}

export function normalizePlace(value: string): string {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, ' ').toLowerCase();
}

export function normalizedRoomKey(
  location: string,
  room: string | undefined,
): string | undefined {
  if (room === undefined || room.trim() === '') return undefined;
  return `${normalizePlace(location)}\u0000${normalizePlace(room)}`;
}
