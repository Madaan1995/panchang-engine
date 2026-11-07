/**
 * (c) Reference fixtures: values a human copied from an authoritative panchang.
 * Only entries marked `"verified": true` are compared. See
 * tests/fixtures/reference/README.md. The build itself ships no verified values.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { cityToLocation, findCity } from '@/core/cities';
import { panchangReport } from '@/core/report';

const DIR = join(__dirname, 'fixtures', 'reference');
const hhmm = z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/)]);

const fixtureSchema = z.object({
  source: z.string(),
  checkedBy: z.string(),
  dateChecked: z.string(),
  city: z.string(),
  monthSystem: z.enum(['amanta', 'purnimanta']),
  toleranceMinutes: z.number().min(0),
  entries: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      verified: z.boolean(),
      expected: z.object({
        sunrise: hhmm,
        sunset: hhmm,
        tithiAtSunrise: z.string(),
        tithiEnd: hhmm,
        nakshatraAtSunrise: z.string(),
        nakshatraEnd: hhmm,
        yogaAtSunrise: z.string(),
        karanaAtSunrise: z.string(),
        rahuKaalStart: hhmm,
        rahuKaalEnd: hhmm,
        lunarMonth: z.string(),
      }),
    }),
  ),
});

const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

/** Minutes between a computed ISO time and an expected local HH:mm, allowing for midnight wrap. */
function minutesApart(iso: string, expected: string): number {
  const dt = DateTime.fromISO(iso, { setZone: true });
  const [h, m] = expected.split(':').map(Number) as [number, number];
  const diff = Math.abs(dt.hour * 60 + dt.minute + dt.second / 60 - (h * 60 + m));
  return Math.min(diff, 1440 - diff);
}

describe('reference fixtures (c): schema', () => {
  it('there is at least the template', () => expect(files).toContain('_template.json'));
  for (const f of files) {
    it(`${f} is well-formed, names a bundled city, and verified files say who checked them`, () => {
      const fx = fixtureSchema.parse(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
      expect(findCity(fx.city), `unknown city ${fx.city}`).toBeDefined();
      if (fx.entries.some((e) => e.verified)) {
        expect(fx.source).not.toBe('');
        expect(fx.checkedBy).not.toBe('');
        expect(fx.dateChecked).not.toBe('');
      }
    });
  }
});

describe('reference fixtures (c): verified entries match the engine', () => {
  const verified = files.flatMap((f) => {
    const fx = fixtureSchema.parse(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
    return fx.entries.filter((e) => e.verified).map((e) => ({ file: f, fx, e }));
  });

  it(`compares ${verified.length} verified entries (0 until the human adds fixtures)`, () => {
    for (const { file, fx, e } of verified) {
      const r = panchangReport(e.date, cityToLocation(findCity(fx.city)!), { monthSystem: fx.monthSystem, ayanamsa: 'lahiri' });
      const ctx = `${file} ${e.date}`;
      const x = e.expected;
      const time = (label: string, iso: string | undefined, want: string) => {
        if (want === '' || iso === undefined) return;
        expect(minutesApart(iso, want), `${ctx} ${label}: engine ${iso}, reference ${want}`).toBeLessThanOrEqual(fx.toleranceMinutes);
      };
      time('sunrise', r.sun.sunrise, x.sunrise);
      time('sunset', r.sun.sunset, x.sunset);
      time('tithi end', r.transitions.tithi[0]?.end, x.tithiEnd);
      time('nakshatra end', r.transitions.nakshatra[0]?.end, x.nakshatraEnd);
      time('Rahu Kaal start', r.timings.rahuKaal.start, x.rahuKaalStart);
      time('Rahu Kaal end', r.timings.rahuKaal.end, x.rahuKaalEnd);
      const tithiName = `${r.atSunrise.tithi.paksha.en} ${r.atSunrise.tithi.name.en}`;
      if (x.tithiAtSunrise !== '') expect(tithiName, `${ctx} tithi`).toBe(x.tithiAtSunrise);
      if (x.nakshatraAtSunrise !== '') expect(r.atSunrise.nakshatra.name.en, `${ctx} nakshatra`).toBe(x.nakshatraAtSunrise);
      if (x.yogaAtSunrise !== '') expect(r.atSunrise.yoga.name.en, `${ctx} yoga`).toBe(x.yogaAtSunrise);
      if (x.karanaAtSunrise !== '') expect(r.atSunrise.karana.name.en, `${ctx} karana`).toBe(x.karanaAtSunrise);
      if (x.lunarMonth !== '') expect(r.lunarMonth.name.en, `${ctx} month`).toBe(x.lunarMonth);
    }
  });
});
