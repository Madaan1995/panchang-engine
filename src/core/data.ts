/**
 * Loads and validates the editable rule data in /data.
 *
 * Religious and traditional rules (which day-part is Rahu Kaal, choghadiya
 * order, festival rules, muhurat rules) are DATA with a provenance record,
 * never hard-coded in logic. Every file is validated with zod when first
 * imported, so a typo in an edited JSON file fails loudly at startup and in
 * tests rather than producing wrong times.
 *
 * JSON imports are bundled at build time, so this is not I/O.
 */
import { z } from 'zod';
import choghadiyaJson from '../../data/choghadiya.json';
import dayTimingsJson from '../../data/day-timings.json';

export const provenanceSchema = z.object({
  verifiedBy: z.string(),
  source: z.string(),
  dateVerified: z.string(),
  notes: z.string().optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

const nameSchema = z.object({ en: z.string().min(1), sa: z.string().min(1) });
const weekdayTable = <T extends z.ZodTypeAny>(item: T) => z.array(item).length(7);

const dayPeriodSchema = z.object({
  name: nameSchema,
  nature: z.enum(['auspicious', 'inauspicious', 'neutral']),
  segmentByWeekday: weekdayTable(z.number().int().min(1).max(8)),
});

export const dayTimingsSchema = z.object({
  header: z.string().startsWith('UNVERIFIED'),
  provenance: provenanceSchema,
  description: z.string(),
  segmentsPerDay: z.literal(8),
  periods: z.object({
    rahuKaal: dayPeriodSchema,
    yamaganda: dayPeriodSchema,
    gulika: dayPeriodSchema,
  }),
  muhurtas: z.object({
    description: z.string(),
    muhurtasPerDayOrNight: z.literal(15),
    abhijit: z.object({ name: nameSchema, nature: z.literal('auspicious'), dayMuhurta: z.number().int().min(1).max(15) }),
    brahmaMuhurta: z.object({
      name: nameSchema,
      nature: z.literal('auspicious'),
      nightMuhurtasEndingAtSunrise: z.number().int().min(1).max(15),
    }),
  }),
});
export type DayTimingsData = z.infer<typeof dayTimingsSchema>;

export const DAY_TIMINGS: DayTimingsData = dayTimingsSchema.parse(dayTimingsJson);

const choghadiyaKey = z.enum(['Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog']);
export type ChoghadiyaKey = z.infer<typeof choghadiyaKey>;

export const choghadiyaSchema = z.object({
  header: z.string().startsWith('UNVERIFIED'),
  provenance: provenanceSchema,
  description: z.string(),
  choghadiyas: z.record(choghadiyaKey, z.object({ name: nameSchema, nature: z.enum(['auspicious', 'inauspicious', 'neutral']) })),
  day: weekdayTable(z.array(choghadiyaKey).length(8)),
  night: weekdayTable(z.array(choghadiyaKey).length(8)),
});
export type ChoghadiyaData = z.infer<typeof choghadiyaSchema>;

export const CHOGHADIYA: ChoghadiyaData = choghadiyaSchema.parse(choghadiyaJson);

/** True when a data file's provenance has been filled in by a human. */
export function isVerified(p: Provenance): boolean {
  return p.verifiedBy.trim() !== '' && p.source.trim() !== '' && p.dateVerified.trim() !== '';
}
