import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { festivalsReport, muhuratReport, panchangReport } from '@/core/report';
import { MONTREAL } from './helpers/locations';

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/** Collect every string value under keys that hold times. */
function timeStrings(obj: unknown, out: string[] = []): string[] {
  if (Array.isArray(obj)) obj.forEach((o) => timeStrings(o, out));
  else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && ['start', 'end', 'at', 'sunrise', 'sunset', 'nextSunrise', 'moonrise', 'moonset'].includes(k)) out.push(v);
      else timeStrings(v, out);
    }
  }
  return out;
}

describe('panchangReport (structural checks)', () => {
  const r = panchangReport('2026-07-15', MONTREAL, { monthSystem: 'amanta', ayanamsa: 'lahiri' });

  it('includes a conventions block naming ayanamsa, month system and rise definition', () => {
    expect(r.conventions.ayanamsa.id).toBe('lahiri');
    expect(r.conventions.ayanamsa.status).toBe('UNVERIFIED');
    expect(r.conventions.monthSystem).toBe('amanta');
    expect(r.conventions.riseSetDefinition).toMatch(/upper limb/i);
    expect(r.conventions.timeZone).toBe('America/Toronto');
  });

  it('every time is ISO 8601 with the zone offset in effect (EDT −04:00 in July)', () => {
    const times = timeStrings(r);
    expect(times.length).toBeGreaterThan(30);
    for (const t of times) {
      expect(t).toMatch(ISO_WITH_OFFSET);
      expect(t.endsWith('-04:00') || t.endsWith('-05:00')).toBe(true);
      expect(DateTime.fromISO(t, { setZone: true }).offset).toBe(DateTime.fromISO(t).setZone('America/Toronto').offset);
    }
  });

  it('includes every element, timings, choghadiya and the lunar month in both systems', () => {
    expect(r.transitions.tithi.length).toBeGreaterThanOrEqual(1);
    expect(r.transitions.nakshatra.length).toBeGreaterThanOrEqual(1);
    expect(r.transitions.yoga.length).toBeGreaterThanOrEqual(1);
    expect(r.transitions.karana.length).toBeGreaterThanOrEqual(2);
    expect(r.choghadiya.day).toHaveLength(8);
    expect(r.choghadiya.night).toHaveLength(8);
    expect(r.timings.rahuKaal.name.en).toBe('Rahu Kaal');
    expect(r.lunarMonth.amanta.name.en).toBeTruthy();
    expect(r.lunarMonth.purnimanta.name.sa).toBeTruthy();
    expect(r.vara.number).toBe(3); // 2026-07-15 is a Wednesday
  });

  it('is JSON-serialisable without loss', () => {
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe('festivalsReport and muhuratReport (structural checks)', () => {
  it('festivals carry provenance, verified:false and zoned times', () => {
    const f = festivalsReport(2026, MONTREAL);
    expect(f.festivals.length).toBe(10);
    for (const x of f.festivals) {
      expect(x.verified).toBe(false);
      expect(x.provenance).toBeDefined();
      expect(x.decidingWindow.start).toMatch(ISO_WITH_OFFSET);
    }
  });

  it('muhurat report has the UNVERIFIED disclaimer and zoned windows', () => {
    const m = muhuratReport('vivah', { from: '2026-05-01', to: '2026-05-31' }, MONTREAL);
    expect(m.disclaimer).toMatch(/^UNVERIFIED/);
    for (const w of m.windows) expect(w.start).toMatch(ISO_WITH_OFFSET);
  });
});
