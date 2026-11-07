/**
 * Data for the public web page. Uses the SAME core report builder as the API
 * (`panchangReport`), so the page and the API can never disagree. The page is
 * not authenticated and not metered: it never touches the database.
 */
import { CITIES, DEFAULT_CITY_ID, cityToLocation, findCity, type City } from '@/core/cities';
import { addDays } from '@/core/time';
import { panchangReport, type PanchangReport } from '@/core/report';
import { NoSunriseSunsetError } from '@/core/riseSet';
import type { MonthSystem } from '@/core/lunarCalendar';
import { DateTime } from 'luxon';

export interface PageParams {
  city?: string | string[];
  date?: string | string[];
  monthSystem?: string | string[];
}

export interface PageModel {
  city: City;
  date: string;
  prevDate: string;
  nextDate: string;
  today: string;
  monthSystem: MonthSystem;
  cities: readonly City[];
  report: PanchangReport | null;
  notices: string[];
  error: string | null;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function buildPageModel(params: PageParams, now: Date): PageModel {
  const notices: string[] = [];
  const requestedCity = first(params.city);
  let city = findCity(requestedCity ?? DEFAULT_CITY_ID);
  if (city === undefined) {
    notices.push(`Unknown city "${requestedCity}"; showing Montreal instead.`);
    city = findCity(DEFAULT_CITY_ID) as City;
  }
  const today = DateTime.fromJSDate(now, { zone: city.timezone }).toISODate() as string;
  let date = first(params.date) ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DateTime.fromISO(date).isValid) {
    notices.push(`"${date}" is not a valid date; showing today instead.`);
    date = today;
  }
  const monthSystem: MonthSystem = first(params.monthSystem) === 'amanta' ? 'amanta' : 'purnimanta';

  let report: PanchangReport | null = null;
  let error: string | null = null;
  try {
    report = panchangReport(date, cityToLocation(city), { monthSystem, ayanamsa: 'lahiri' });
  } catch (e) {
    if (e instanceof NoSunriseSunsetError) error = e.message;
    else throw e;
  }
  return {
    city,
    date,
    prevDate: addDays(date, -1),
    nextDate: addDays(date, 1),
    today,
    monthSystem,
    cities: CITIES,
    report,
    notices,
    error,
  };
}

/** "06:42" for a time on the page's date; "Mon 9 Nov, 02:01" otherwise. */
export function displayTime(iso: string | null, pageDate: string): string {
  if (iso === null) return '—';
  const dt = DateTime.fromISO(iso, { setZone: true });
  return dt.toISODate() === pageDate ? dt.toFormat('HH:mm') : dt.toFormat('EEE d LLL, HH:mm');
}
