/**
 * Muhurat finder: windows on each panchang day where every inclusion rule of a
 * ceremony holds and no exclusion applies.
 *
 * Algorithm (per panchang day, sunrise → next sunrise):
 *  1. Skip the day if its vara (weekday) is not allowed.
 *  2. Collect every instant at which something relevant can change inside the
 *     search span: tithi / nakshatra / karana transitions, the start and end
 *     of each excluded period (Rahu Kaal etc.), sunrise and sunset.
 *  3. Between consecutive instants nothing changes, so test each piece once
 *     (at its midpoint) against the rules.
 *  4. Join adjacent qualifying pieces into windows. Each window records WHY it
 *     qualifies and WHAT event created each boundary, so a boundary always
 *     sits exactly on an element transition or period edge.
 *  5. Drop windows shorter than the rule's minimumWindowMinutes.
 */
import type { AyanamsaName } from './ayanamsa';
import { inauspiciousPeriods, type DayPeriodKey } from './dayTimings';
import type { KaranaInfo, NakshatraInfo, TithiInfo } from './elements';
import type { Name } from './names';
import { MUHURAT_RULES, type MuhuratRule } from './muhuratRules';
import { addDays, InvalidInputError } from './time';
import { dayTransitions, type DaySegment } from './transitions';
import type { GeoLocation, LocalDate } from './types';
import { varaForDate } from './vara';
import { DateTime } from 'luxon';

export const MAX_RANGE_DAYS = 366;

/** Events closer than this are treated as the same instant. */
const SNAP_MS = 10;

export interface BoundaryEvent {
  at: Date;
  /** Human-readable causes, e.g. "Rahu Kaal ends", "tithi Shukla Panchami begins", "sunrise". */
  causes: string[];
}

export interface MuhuratWindow {
  /** Panchang date (local date of the sunrise that starts the day). */
  date: LocalDate;
  start: Date;
  end: Date;
  weekday: { number: number; name: Name; english: string };
  tithis: { number: number; name: Name; paksha: string }[];
  nakshatras: { number: number; name: Name }[];
  karanas: { number: number; name: Name }[];
  /** Why the window qualifies. */
  reasons: string[];
  startBoundary: BoundaryEvent;
  endBoundary: BoundaryEvent;
}

export class UnknownCeremonyError extends Error {
  readonly code = 'UNKNOWN_CEREMONY';
  constructor(readonly ceremony: string) {
    super(`Unknown ceremony '${ceremony}'. Known: ${Object.keys(MUHURAT_RULES).join(', ')}`);
    this.name = 'UnknownCeremonyError';
  }
}

export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

/** Number of calendar days in an inclusive local-date range. */
export function rangeLengthDays(range: DateRange): number {
  const from = DateTime.fromISO(range.from, { zone: 'UTC' });
  const to = DateTime.fromISO(range.to, { zone: 'UTC' });
  if (!from.isValid || !to.isValid) throw new InvalidInputError('from/to must be dates in YYYY-MM-DD format');
  return Math.round(to.diff(from, 'days').days) + 1;
}

function tithiAllowed(rule: MuhuratRule, t: TithiInfo): boolean {
  return rule.allowedTithis[t.paksha].includes(t.numberInPaksha);
}

const PERIOD_LABEL: Record<DayPeriodKey, string> = { rahuKaal: 'Rahu Kaal', yamaganda: 'Yamaganda', gulika: 'Gulika Kaal' };

function find<T extends { start: Date; end: Date }>(segments: T[], t: number): T {
  const s = segments.find((x) => x.start.getTime() <= t && t < x.end.getTime());
  if (s === undefined) throw new Error('internal: no segment covers instant');
  return s;
}

function uniqueBy<T>(items: T[], key: (t: T) => number): T[] {
  const seen = new Set<number>();
  return items.filter((i) => (seen.has(key(i)) ? false : (seen.add(key(i)), true)));
}

/** Muhurat windows for one panchang day. Exported for testing. */
export function muhuratsForDay(
  rule: MuhuratRule,
  date: LocalDate,
  location: GeoLocation,
  ayanamsa: AyanamsaName = 'lahiri',
): MuhuratWindow[] {
  const vara = varaForDate(date);
  if (!rule.allowedWeekdays.includes(vara.english)) return [];

  const d = dayTransitions(date, location, ayanamsa);
  const spanStart = d.sunrise.getTime();
  const spanEnd = (rule.timeOfDay === 'day' ? d.sunset : d.nextSunrise).getTime();

  // Excluded clock periods (all are daytime eighths).
  const periods = inauspiciousPeriods(d.sunrise, d.sunset, vara.number);
  const excludedPeriods = rule.excluded.periods.map((key) => ({ ...periods[key], key, label: PERIOD_LABEL[key] }));

  // Step 2: every instant where something can change, with its causes.
  const events = new Map<number, string[]>();
  const addEvent = (t: number, cause: string) => {
    if (t < spanStart || t > spanEnd) return;
    events.set(t, [...(events.get(t) ?? []), cause]);
  };
  addEvent(spanStart, 'sunrise');
  addEvent(spanEnd, rule.timeOfDay === 'day' ? 'sunset' : 'next sunrise');
  const addTransitions = <I>(label: string, segs: DaySegment<I>[], nameOf: (i: I) => string) => {
    for (const s of segs) {
      addEvent(s.start.getTime(), `${label} ${nameOf(s.info)} begins`);
      addEvent(s.end.getTime(), `${label} ${nameOf(s.info)} ends`);
    }
  };
  addTransitions<TithiInfo>('tithi', d.tithi, (i) => `${i.pakshaName.en} ${i.name.en}`);
  addTransitions<NakshatraInfo>('nakshatra', d.nakshatra, (i) => i.name.en);
  addTransitions<KaranaInfo>('karana', d.karana, (i) => i.name.en);
  for (const p of excludedPeriods) {
    addEvent(p.start.getTime(), `${p.label} begins`);
    addEvent(p.end.getTime(), `${p.label} ends`);
  }
  // Tithi and karana boundaries are the same physical event found by two
  // separate 1 ms-tolerance searches; snap instants within SNAP_MS together so
  // they form one boundary instead of a sliver of a few milliseconds.
  const instants: number[] = [];
  for (const t of [...events.keys()].sort((a, b) => a - b)) {
    const prev = instants.at(-1);
    if (prev !== undefined && t - prev <= SNAP_MS) {
      events.set(prev, [...(events.get(prev) ?? []), ...(events.get(t) ?? [])]);
      events.delete(t);
    } else {
      instants.push(t);
    }
  }

  // Steps 3–4: test each piece; join qualifying neighbours.
  const windows: MuhuratWindow[] = [];
  let open: { start: number; tithis: TithiInfo[]; naks: NakshatraInfo[]; karanas: KaranaInfo[] } | null = null;
  const close = (end: number) => {
    if (open === null) return;
    const durationMin = (end - open.start) / 60_000;
    if (durationMin >= rule.minimumWindowMinutes) {
      const tithis = uniqueBy(open.tithis, (t) => t.number);
      const naks = uniqueBy(open.naks, (n) => n.number);
      const karanas = uniqueBy(open.karanas, (k) => k.number);
      windows.push({
        date,
        start: new Date(open.start),
        end: new Date(end),
        weekday: { number: vara.number, name: vara.name, english: vara.english },
        tithis: tithis.map((t) => ({ number: t.number, name: t.name, paksha: t.pakshaName.en })),
        nakshatras: naks.map((n) => ({ number: n.number, name: n.name })),
        karanas: karanas.map((k) => ({ number: k.number, name: k.name })),
        reasons: [
          `Weekday ${vara.english} (${vara.name.en}) is allowed`,
          ...tithis.map((t) => `Tithi ${t.pakshaName.en} ${t.name.en} is allowed`),
          ...naks.map((n) => `Nakshatra ${n.name.en} is allowed`),
          ...(excludedPeriods.length > 0 ? [`Outside ${excludedPeriods.map((p) => p.label).join(', ')}`] : []),
          ...(rule.excluded.karanas.length > 0 ? [`Karana is not ${rule.excluded.karanas.join(' or ')}`] : []),
        ],
        startBoundary: { at: new Date(open.start), causes: events.get(open.start) ?? [] },
        endBoundary: { at: new Date(end), causes: events.get(end) ?? [] },
      });
    }
    open = null;
  };

  for (let i = 0; i + 1 < instants.length; i++) {
    const a = instants[i] as number;
    const b = instants[i + 1] as number;
    const mid = (a + b) / 2;
    const tithi = find(d.tithi, mid).info;
    const nak = find(d.nakshatra, mid).info;
    const karana = find(d.karana, mid).info;
    const ok =
      tithiAllowed(rule, tithi) &&
      rule.allowedNakshatras.includes(nak.name.en) &&
      !rule.excluded.karanas.includes(karana.key) &&
      !excludedPeriods.some((p) => p.start.getTime() <= mid && mid < p.end.getTime());
    if (ok) {
      if (open === null) open = { start: a, tithis: [], naks: [], karanas: [] };
      open.tithis.push(tithi);
      open.naks.push(nak);
      open.karanas.push(karana);
    } else {
      close(a);
    }
  }
  close(spanEnd);
  return windows;
}

/**
 * All muhurat windows for `ceremony` between `range.from` and `range.to`
 * (inclusive local dates, at most 366 days).
 */
export function findMuhurats(
  ceremony: string,
  range: DateRange,
  location: GeoLocation,
  ayanamsa: AyanamsaName = 'lahiri',
): MuhuratWindow[] {
  const rule = MUHURAT_RULES[ceremony];
  if (rule === undefined) throw new UnknownCeremonyError(ceremony);
  const days = rangeLengthDays(range);
  if (days < 1) throw new InvalidInputError('`to` must not be before `from`');
  if (days > MAX_RANGE_DAYS) throw new InvalidInputError(`Date range is ${days} days; the maximum is ${MAX_RANGE_DAYS}`);
  const out: MuhuratWindow[] = [];
  for (let i = 0; i < days; i++) out.push(...muhuratsForDay(rule, addDays(range.from, i), location, ayanamsa));
  return out;
}
