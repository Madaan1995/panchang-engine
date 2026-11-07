/**
 * Muhurat rule sets (data/muhurat-rules/*.json), validated with zod.
 *
 * Each file must be registered in RULE_FILES below: JSON is bundled at build
 * time, so the list is explicit (a test checks that every file in the
 * directory is registered).
 */
import { z } from 'zod';
import grihaPravesh from '../../data/muhurat-rules/griha-pravesh.json';
import mundan from '../../data/muhurat-rules/mundan.json';
import namkaran from '../../data/muhurat-rules/namkaran.json';
import vivah from '../../data/muhurat-rules/vivah.json';
import { provenanceSchema } from './data';
import { KARANA_NAMES, NAKSHATRA_NAMES, WEEKDAY_ENGLISH } from './names';

const nakshatraName = z.enum(NAKSHATRA_NAMES.map((n) => n.en) as [string, ...string[]]);
const weekdayName = z.enum(WEEKDAY_ENGLISH);
const karanaName = z.enum(Object.keys(KARANA_NAMES) as [string, ...string[]]);
const tithiInPaksha = z.number().int().min(1).max(15);

export const muhuratRuleSchema = z.object({
  header: z.literal('UNVERIFIED — rules must be reviewed by a priest'),
  ceremony: z.string().regex(/^[a-z0-9-]+$/),
  name: z.object({ en: z.string(), sa: z.string() }),
  provenance: provenanceSchema,
  description: z.string(),
  notes: z.string(),
  /** 'day' = sunrise→sunset only; 'anytime' = sunrise→next sunrise. */
  timeOfDay: z.enum(['day', 'anytime']),
  /** Windows shorter than this are dropped as impractical. */
  minimumWindowMinutes: z.number().min(0),
  allowedTithis: z.object({ shukla: z.array(tithiInPaksha), krishna: z.array(tithiInPaksha) }),
  allowedNakshatras: z.array(nakshatraName).min(1),
  allowedWeekdays: z.array(weekdayName).min(1),
  excluded: z.object({
    periods: z.array(z.enum(['rahuKaal', 'yamaganda', 'gulika'])),
    karanas: z.array(karanaName),
  }),
});
export type MuhuratRule = z.infer<typeof muhuratRuleSchema>;

const RULE_FILES: Record<string, unknown> = {
  'griha-pravesh': grihaPravesh,
  vivah,
  namkaran,
  mundan,
};

export const MUHURAT_RULES: Record<string, MuhuratRule> = Object.fromEntries(
  Object.entries(RULE_FILES).map(([key, json]) => {
    const rule = muhuratRuleSchema.parse(json);
    if (rule.ceremony !== key) throw new Error(`muhurat rule file '${key}' declares ceremony '${rule.ceremony}'`);
    return [key, rule];
  }),
);

export const CEREMONIES = Object.keys(MUHURAT_RULES);
