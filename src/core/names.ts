/**
 * Names of panchanga elements in English transliteration (simplified, no
 * diacritics) and Sanskrit in Devanagari. Arrays are 0-indexed; element
 * numbers elsewhere are 1-indexed, so `TITHI_NAMES[tithi - 1]` etc.
 *
 * These are names, not religious rules, so they live in code. Regional
 * spellings vary (e.g. Ashvin/Ashwin, Shravana/Sawan); the transliteration
 * here is one common form.
 */
export interface Name {
  en: string;
  sa: string;
}

const n = (en: string, sa: string): Name => ({ en, sa });

/** Tithi names 1–15 (Shukla) and 16–30 (Krishna). 15 = Purnima, 30 = Amavasya. */
const TITHI_BASE: Name[] = [
  n('Pratipada', 'प्रतिपदा'),
  n('Dvitiya', 'द्वितीया'),
  n('Tritiya', 'तृतीया'),
  n('Chaturthi', 'चतुर्थी'),
  n('Panchami', 'पञ्चमी'),
  n('Shashthi', 'षष्ठी'),
  n('Saptami', 'सप्तमी'),
  n('Ashtami', 'अष्टमी'),
  n('Navami', 'नवमी'),
  n('Dashami', 'दशमी'),
  n('Ekadashi', 'एकादशी'),
  n('Dvadashi', 'द्वादशी'),
  n('Trayodashi', 'त्रयोदशी'),
  n('Chaturdashi', 'चतुर्दशी'),
];
export const TITHI_NAMES: readonly Name[] = [
  ...TITHI_BASE,
  n('Purnima', 'पूर्णिमा'),
  ...TITHI_BASE,
  n('Amavasya', 'अमावस्या'),
];

export const PAKSHA_NAMES = {
  shukla: n('Shukla', 'शुक्ल'),
  krishna: n('Krishna', 'कृष्ण'),
} as const;

export const NAKSHATRA_NAMES: readonly Name[] = [
  n('Ashwini', 'अश्विनी'),
  n('Bharani', 'भरणी'),
  n('Krittika', 'कृत्तिका'),
  n('Rohini', 'रोहिणी'),
  n('Mrigashira', 'मृगशिरा'),
  n('Ardra', 'आर्द्रा'),
  n('Punarvasu', 'पुनर्वसु'),
  n('Pushya', 'पुष्य'),
  n('Ashlesha', 'आश्लेषा'),
  n('Magha', 'मघा'),
  n('Purva Phalguni', 'पूर्वफाल्गुनी'),
  n('Uttara Phalguni', 'उत्तरफाल्गुनी'),
  n('Hasta', 'हस्त'),
  n('Chitra', 'चित्रा'),
  n('Swati', 'स्वाती'),
  n('Vishakha', 'विशाखा'),
  n('Anuradha', 'अनुराधा'),
  n('Jyeshtha', 'ज्येष्ठा'),
  n('Mula', 'मूल'),
  n('Purva Ashadha', 'पूर्वाषाढा'),
  n('Uttara Ashadha', 'उत्तराषाढा'),
  n('Shravana', 'श्रवण'),
  n('Dhanishtha', 'धनिष्ठा'),
  n('Shatabhisha', 'शतभिषा'),
  n('Purva Bhadrapada', 'पूर्वभाद्रपदा'),
  n('Uttara Bhadrapada', 'उत्तरभाद्रपदा'),
  n('Revati', 'रेवती'),
];

export const YOGA_NAMES: readonly Name[] = [
  n('Vishkambha', 'विष्कम्भ'),
  n('Priti', 'प्रीति'),
  n('Ayushman', 'आयुष्मान्'),
  n('Saubhagya', 'सौभाग्य'),
  n('Shobhana', 'शोभन'),
  n('Atiganda', 'अतिगण्ड'),
  n('Sukarma', 'सुकर्मा'),
  n('Dhriti', 'धृति'),
  n('Shula', 'शूल'),
  n('Ganda', 'गण्ड'),
  n('Vriddhi', 'वृद्धि'),
  n('Dhruva', 'ध्रुव'),
  n('Vyaghata', 'व्याघात'),
  n('Harshana', 'हर्षण'),
  n('Vajra', 'वज्र'),
  n('Siddhi', 'सिद्धि'),
  n('Vyatipata', 'व्यतीपात'),
  n('Variyan', 'वरीयान्'),
  n('Parigha', 'परिघ'),
  n('Shiva', 'शिव'),
  n('Siddha', 'सिद्ध'),
  n('Sadhya', 'साध्य'),
  n('Shubha', 'शुभ'),
  n('Shukla', 'शुक्ल'),
  n('Brahma', 'ब्रह्म'),
  n('Indra', 'इन्द्र'),
  n('Vaidhriti', 'वैधृति'),
];

/**
 * The 11 karanas. The first 7 repeat ("chara" karanas); the last 4 are fixed
 * ("sthira") and occur once per lunar month. See `karanaFromHalfTithi` for
 * where each one falls.
 */
export const KARANA_NAMES = {
  Bava: n('Bava', 'बव'),
  Balava: n('Balava', 'बालव'),
  Kaulava: n('Kaulava', 'कौलव'),
  Taitila: n('Taitila', 'तैतिल'),
  Gara: n('Gara', 'गर'),
  Vanija: n('Vanija', 'वणिज'),
  Vishti: n('Vishti', 'विष्टि'), // also called Bhadra
  Shakuni: n('Shakuni', 'शकुनि'),
  Chatushpada: n('Chatushpada', 'चतुष्पाद'),
  Naga: n('Naga', 'नाग'),
  Kimstughna: n('Kimstughna', 'किंस्तुघ्न'),
} as const;

export type KaranaName = keyof typeof KARANA_NAMES;

export const REPEATING_KARANAS: readonly KaranaName[] = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];

/** Varas indexed by weekday number 0 = Sunday … 6 = Saturday. */
export const VARA_NAMES: readonly Name[] = [
  n('Ravivara', 'रविवार'),
  n('Somavara', 'सोमवार'),
  n('Mangalavara', 'मङ्गलवार'),
  n('Budhavara', 'बुधवार'),
  n('Guruvara', 'गुरुवार'),
  n('Shukravara', 'शुक्रवार'),
  n('Shanivara', 'शनिवार'),
];

export const WEEKDAY_ENGLISH = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Lunar months, index 0 = Chaitra … 11 = Phalguna. */
export const LUNAR_MONTH_NAMES: readonly Name[] = [
  n('Chaitra', 'चैत्र'),
  n('Vaishakha', 'वैशाख'),
  n('Jyeshtha', 'ज्येष्ठ'),
  n('Ashadha', 'आषाढ'),
  n('Shravana', 'श्रावण'),
  n('Bhadrapada', 'भाद्रपद'),
  n('Ashvin', 'आश्विन'),
  n('Kartika', 'कार्तिक'),
  n('Margashirsha', 'मार्गशीर्ष'),
  n('Pausha', 'पौष'),
  n('Magha', 'माघ'),
  n('Phalguna', 'फाल्गुन'),
];

/** Sidereal zodiac signs (rashis), index 0 = Mesha (0°–30°) … 11 = Meena. */
export const RASHI_NAMES: readonly Name[] = [
  n('Mesha', 'मेष'),
  n('Vrishabha', 'वृषभ'),
  n('Mithuna', 'मिथुन'),
  n('Karka', 'कर्क'),
  n('Simha', 'सिंह'),
  n('Kanya', 'कन्या'),
  n('Tula', 'तुला'),
  n('Vrishchika', 'वृश्चिक'),
  n('Dhanu', 'धनु'),
  n('Makara', 'मकर'),
  n('Kumbha', 'कुम्भ'),
  n('Meena', 'मीन'),
];

/** Look up a 1-indexed entry; throws on out-of-range so bugs surface immediately. */
export function nameAt(table: readonly Name[], oneBasedIndex: number): Name {
  const v = table[oneBasedIndex - 1];
  if (v === undefined) throw new RangeError(`Index ${oneBasedIndex} out of range 1..${table.length}`);
  return v;
}
