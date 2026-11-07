/**
 * Presentational component for the panchang page. Pure function of the page
 * model (no data fetching), so it can be rendered in tests with
 * react-dom/server.
 */
import type { PageModel } from './pageModel';
import { displayTime } from './pageModel';

type Named = { name: { en: string; sa: string } };

function Name({ n }: { n: { en: string; sa: string } }) {
  return (
    <>
      {n.en} <span className="sa" lang="sa">{n.sa}</span>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

export function PanchangView({ model }: { model: PageModel }) {
  const { report: r, date, city } = model;
  const t = (iso: string | null) => displayTime(iso, date);
  const segments = (list: (Named & { start: string; end: string })[]) => (
    <ul className="segments">
      {list.map((s) => (
        <li key={s.start}>
          <Name n={s.name} />
          <span className="when">
            {t(s.start)} → {t(s.end)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <main>
      <header>
        <h1>Panchang</h1>
        <p className="sub">
          {city.name}, {city.region} · {date} · <span className="tz">{city.timezone}</span>
        </p>
      </header>

      <form method="get" className="picker" aria-label="Choose city and date">
        <label>
          City
          <select name="city" defaultValue={city.id}>
            {model.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.region} ({c.country})
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" name="date" defaultValue={date} />
        </label>
        <label>
          Months
          <select name="monthSystem" defaultValue={model.monthSystem}>
            <option value="purnimanta">Purnimanta</option>
            <option value="amanta">Amanta</option>
          </select>
        </label>
        <button type="submit">Show</button>
      </form>

      <nav className="daynav">
        <a href={`?city=${city.id}&date=${model.prevDate}&monthSystem=${model.monthSystem}`}>← {model.prevDate}</a>
        <a href={`?city=${city.id}&monthSystem=${model.monthSystem}`}>Today</a>
        <a href={`?city=${city.id}&date=${model.nextDate}&monthSystem=${model.monthSystem}`}>{model.nextDate} →</a>
      </nav>

      {model.notices.map((n) => (
        <p key={n} className="notice">
          {n}
        </p>
      ))}

      {model.error !== null && <p className="notice error">{model.error}</p>}

      {r !== null && (
        <>
          <section>
            <h2>Day</h2>
            <table>
              <tbody>
                <Row label="Vara">
                  <Name n={r.vara.name} /> ({r.vara.english})
                </Row>
                <Row label="Sunrise / Sunset">
                  {t(r.sun.sunrise)} / {t(r.sun.sunset)}
                </Row>
                <Row label="Moonrise / Moonset">
                  {t(r.moon.moonrise)} / {t(r.moon.moonset)}
                </Row>
                <Row label={`Month (${r.lunarMonth.system})`}>
                  <Name n={r.lunarMonth.name} />
                  {r.lunarMonth.isAdhik ? ' (Adhik)' : ''} · {r.lunarMonth.paksha === 'shukla' ? 'Shukla' : 'Krishna'} paksha
                </Row>
                <Row label="Amanta / Purnimanta">
                  {r.lunarMonth.amanta.name.en} / {r.lunarMonth.purnimanta.name.en}
                </Row>
                <Row label="Sun / Moon rashi">
                  <Name n={r.atSunrise.sunRashi.name} /> / <Name n={r.atSunrise.moonRashi.name} />
                </Row>
              </tbody>
            </table>
          </section>

          <section>
            <h2>Panchanga</h2>
            <h3>Tithi</h3>
            {segments(r.transitions.tithi.map((s) => ({ ...s, name: { en: `${s.paksha.en} ${s.name.en}`, sa: `${s.paksha.sa} ${s.name.sa}` } })))}
            <h3>Nakshatra</h3>
            {segments(r.transitions.nakshatra)}
            <h3>Yoga</h3>
            {segments(r.transitions.yoga)}
            <h3>Karana</h3>
            {segments(r.transitions.karana)}
          </section>

          <section>
            <h2>Timings</h2>
            <table>
              <tbody>
                {[r.timings.rahuKaal, r.timings.yamaganda, r.timings.gulika, r.timings.abhijit, r.timings.brahmaMuhurta].map((p) => (
                  <Row key={p.name.en} label={p.name.en}>
                    {t(p.start)} – {t(p.end)}
                  </Row>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Choghadiya</h2>
            <div className="chogh">
              {(['day', 'night'] as const).map((period) => (
                <table key={period}>
                  <caption>{period === 'day' ? 'Day' : 'Night'}</caption>
                  <tbody>
                    {r.choghadiya[period].map((c) => (
                      <tr key={c.start} className={c.nature}>
                        <th scope="row">{c.name.en}</th>
                        <td>
                          {t(c.start)} – {t(c.end)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </section>

          <footer>
            <p>
              Astronomical calculations under stated conventions: Lahiri ayanamsa (<strong>{r.conventions.ayanamsa.status}</strong>),{' '}
              {r.conventions.monthSystem} months, sunrise-to-sunrise day, upper-limb sunrise with 34′ refraction. Times are local to{' '}
              {city.timezone} including daylight saving. Traditional rules are editable data and have not been verified by a priest.
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
