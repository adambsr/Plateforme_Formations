export const RESOURCE_TYPES = ['FILE', 'EXTERNAL_URL'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export function normalizeOrder(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError('Content order must be a positive safe integer.');
  }
  return value;
}
