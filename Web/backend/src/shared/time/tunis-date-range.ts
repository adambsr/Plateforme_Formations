const TIME_ZONE = 'Africa/Tunis';
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface TunisDateRange {
  from: string;
  to: string;
  startAt: Date;
  endAtExclusive: Date;
  fullMonths: Array<{ year: number; month: number }>;
}

function parse(value: string): CivilDate | undefined {
  const match = datePattern.exec(value);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

export function isCalendarDate(value: string): boolean {
  return parse(value) !== undefined;
}

function nextDate(value: CivilDate): CivilDate {
  const result = new Date(Date.UTC(value.year, value.month - 1, value.day + 1));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

function nextMonth(value: { year: number; month: number }) {
  return value.month === 12
    ? { year: value.year + 1, month: 1 }
    : { year: value.year, month: value.month + 1 };
}

function civilKey(value: CivilDate): number {
  return Date.UTC(value.year, value.month - 1, value.day);
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function zonedMidnight(value: CivilDate): Date {
  const target = Date.UTC(value.year, value.month - 1, value.day);
  let candidate = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const values = new Map(
      formatter
        .formatToParts(new Date(candidate))
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value: part }) => [type, Number(part)]),
    );
    const displayed = Date.UTC(
      values.get('year') ?? 0,
      (values.get('month') ?? 1) - 1,
      values.get('day') ?? 1,
      values.get('hour') ?? 0,
      values.get('minute') ?? 0,
      values.get('second') ?? 0,
    );
    const difference = displayed - target;
    if (difference === 0) break;
    candidate -= difference;
  }
  return new Date(candidate);
}

export function tunisDateRange(from: string, to: string): TunisDateRange {
  const first = parse(from);
  const last = parse(to);
  if (
    first === undefined ||
    last === undefined ||
    civilKey(first) > civilKey(last)
  ) {
    throw new Error('Invalid Tunisia calendar date range.');
  }
  const end = nextDate(last);
  const fullMonths: Array<{ year: number; month: number }> = [];
  let month =
    first.day === 1
      ? { year: first.year, month: first.month }
      : nextMonth({ year: first.year, month: first.month });
  while (civilKey({ ...nextMonth(month), day: 1 }) <= civilKey(end)) {
    fullMonths.push(month);
    month = nextMonth(month);
  }
  return {
    from,
    to,
    startAt: zonedMidnight(first),
    endAtExclusive: zonedMidnight(end),
    fullMonths,
  };
}

export function toTunisCalendarDate(value: Date): string {
  const parts = new Map(
    formatter
      .formatToParts(value)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}
