import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCity, cityToLocation } from '@/core/cities';
import { panchangReport } from '@/core/report';
import { buildPageModel, displayTime } from '@/web/pageModel';
import { PanchangView } from '@/web/PanchangView';

const NOW = new Date(Date.UTC(2026, 10, 7, 15));

describe('web page model', () => {
  it('defaults to Montreal and today in Montreal\'s timezone', () => {
    const m = buildPageModel({}, NOW);
    expect(m.city.id).toBe('montreal-ca');
    expect(m.date).toBe('2026-11-07');
    expect(m.report).not.toBeNull();
  });

  it('renders from the same core report as the API (identical output for the same inputs)', () => {
    const m = buildPageModel({ city: 'toronto-ca', date: '2026-03-08' }, NOW);
    const api = panchangReport('2026-03-08', cityToLocation(findCity('toronto-ca')!), { monthSystem: 'purnimanta', ayanamsa: 'lahiri' });
    expect(m.report).toEqual(api);
  });

  it('falls back with a notice for an unknown city or invalid date', () => {
    const m = buildPageModel({ city: 'nowhere', date: 'yesterday' }, NOW);
    expect(m.city.id).toBe('montreal-ca');
    expect(m.date).toBe('2026-11-07');
    expect(m.notices).toHaveLength(2);
  });

  it('displayTime shows HH:mm for the page date and adds the day otherwise', () => {
    expect(displayTime('2026-11-07T06:42:17-05:00', '2026-11-07')).toBe('06:42');
    expect(displayTime('2026-11-08T02:01:58-05:00', '2026-11-07')).toBe('Sun 8 Nov, 02:01');
    expect(displayTime(null, '2026-11-07')).toBe('—');
  });
});

describe('web page rendering (server-side HTML)', () => {
  const html = renderToStaticMarkup(createElement(PanchangView, { model: buildPageModel({ city: 'montreal-ca', date: '2026-11-07' }, NOW) }));

  it('contains the city picker defaulting to Montreal, and works without JavaScript (GET form)', () => {
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toMatch(/<option value="montreal-ca" selected="">/);
  });

  it('shows the panchang elements, timings and choghadiya with Devanagari names', () => {
    for (const s of ['Tithi', 'Nakshatra', 'Yoga', 'Karana', 'Rahu Kaal', 'Abhijit Muhurat', 'Brahma Muhurta', 'Choghadiya']) {
      expect(html).toContain(s);
    }
    expect(html).toMatch(/lang="sa"/);
    expect(html).toContain('UNVERIFIED');
  });

  it('the layout sets a mobile viewport', () => {
    const layout = readFileSync(join(__dirname, '..', 'src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/width: 'device-width'/);
  });
});
