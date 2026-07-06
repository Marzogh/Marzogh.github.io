(async () => {
  const root = document.querySelector('[data-astronomy-root]');
  if (!root) return;

  const yearSelect = root.querySelector('[data-year-select]');
  const siteSelect = root.querySelector('[data-site-select]');
  const status = root.querySelector('[data-status]');
  const monthNav = root.querySelector('[data-month-nav]');
  const plannerTitle = root.querySelector('[data-planner-title]');
  const plannerGrid = root.querySelector('[data-planner-grid]');
  const generatedAtEl = root.querySelector('[data-generated-at]');
  const upcomingOpenBtn = root.querySelector('[data-upcoming-open]');
  const upcomingModal = root.querySelector('[data-upcoming-modal]');
  const upcomingCloseBtn = root.querySelector('[data-upcoming-close]');
  const upcomingListEl = root.querySelector('[data-upcoming-list]');
  const upcomingRangeEl = root.querySelector('[data-upcoming-range]');
  const upcomingFiltersEl = root.querySelector('[data-upcoming-filters]');
  const upcomingState = { events: [], filter: 'all', startKey: null, endKey: null };
  let rerenderUpcoming = null;

  const el = (sel) => root.querySelector(sel);
  const map = {
    heroTitle: el('[data-hero-title]'),
    heroSubtitle: el('[data-hero-subtitle]'),
    tonightScore: el('[data-tonight-score]'),
    tonightLine: el('[data-tonight-line]'),
    moonMetric: el('[data-moon-metric]'),
    moonLine: el('[data-moon-line]'),
    mwMetric: el('[data-mw-metric]'),
    mwLine: el('[data-mw-line]'),
    valMetric: el('[data-val-metric]'),
    valLine: el('[data-val-line]'),
    navTonight: el('[data-nav-tonight]'),
    planetBody: el('[data-planet-body]'),
    moonTable: el('[data-moon-table]'),
  };

  const fmtDate = (iso) => {
    if (!iso) return 'TBC';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'TBC';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    return `${months[d.getMonth()]} ${dd}`;
  };
  const fmtDateLong = (iso) => {
    if (!iso) return 'TBC';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return 'TBC';
    return d.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  const fmtDayHeading = (iso) => {
    if (!iso) return 'Unknown day';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short' });
  };
  const eventKind = (title = '') => {
    const t = String(title).toLowerCase();
    if (t.includes('milky way')) return 'Milky Way';
    if (t.includes('dark-sky')) return 'Dark sky';
    if (t.includes('conjunction')) return 'Conjunction';
    if (t.includes('occultation')) return 'Occultation';
    if (t.includes('meteor')) return 'Meteor';
    if (t.includes('comet')) return 'Comet';
    if (t.includes('minor planet')) return 'Minor planet';
    if (t.includes('jupiter') || t.includes('saturn') || t.includes('mars') || t.includes('venus')) return 'Planet';
    return 'Event';
  };
  const eventIcon = (title = '') => {
    const t = String(title).toLowerCase();
    if (t.includes('milky way')) return 'milky-way';
    if (t.includes('dark-sky')) return 'dark-sky';
    if (t.includes('conjunction')) return 'conjunction';
    if (t.includes('occultation')) return 'occultation';
    if (t.includes('meteor')) return 'meteor';
    if (t.includes('comet')) return 'comet';
    if (t.includes('minor planet')) return 'minor-planet';
    if (t.includes('transit')) return 'solar-transit';
    if (t.includes('jupiter') || t.includes('saturn') || t.includes('mars') || t.includes('venus') || t.includes('mercury') || t.includes('neptune') || t.includes('uranus')) return 'planet';
    return 'check-badge';
  };
  const eventIconTone = (title = '') => {
    const t = String(title).toLowerCase();
    if (t.includes('venus observing window') || t.includes('mercury observing window')) return 'twilight';
    if (t.includes('milky way')) return 'mw';
    if (t.includes('dark-sky')) return 'dark';
    if (t.includes('conjunction')) return 'conj';
    if (t.includes('occultation')) return 'occult';
    if (t.includes('meteor')) return 'meteor';
    if (t.includes('comet')) return 'comet';
    if (t.includes('minor planet')) return 'minor';
    if (t.includes('transit')) return 'solar';
    if (t.includes('jupiter') || t.includes('saturn') || t.includes('mars') || t.includes('venus') || t.includes('mercury') || t.includes('neptune') || t.includes('uranus')) return 'planet';
    return 'default';
  };
  const isTwilightInnerPlanet = (title = '') => {
    const t = String(title).toLowerCase();
    return t.includes('venus observing window') || t.includes('mercury observing window');
  };
  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const eventIconSvg = (title = '') => `<span class="astro-ev-icon astro-ev-icon--${eventIconTone(title)}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><use href="/astronomy/icons.svg#icon-${eventIcon(title)}"></use></svg></span>`;
  const fmtTime = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const parseIso = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',');
    return lines.slice(1).map((line) => {
      const cols = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
    });
  }

  function localDateKey(date = new Date(), tz = 'Australia/Brisbane') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${g.year}-${g.month}-${g.day}`;
  }

  function localDateTimeLabel(date = new Date(), tz = 'Australia/Brisbane') {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }

  function generatedLabel(iso, tz = 'Australia/Brisbane') {
    if (!iso) return 'Data generated at: unknown';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Data generated at: unknown';
    const ts = localDateTimeLabel(d, tz);
    return `Data generated at: ${ts}`;
  }

  async function fetchText(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    return r.text();
  }

  async function fetchCsv(url) {
    const t = await fetchText(url);
    return t ? parseCsv(t) : [];
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    return r.json();
  }

  function notesById(notes) {
    const m = new Map();
    (notes || []).forEach((n) => m.set(n.note_id, n));
    return m;
  }

  function scorePill(score) {
    const s = String(score || 'Info').toLowerCase();
    if (s.includes('excellent')) return { cls: 'good', label: 'Excellent' };
    if (s.includes('good')) return { cls: 'good', label: 'Good' };
    if (s.includes('fair')) return { cls: 'fair', label: 'Fair' };
    if (s.includes('poor')) return { cls: 'poor', label: 'Poor' };
    return { cls: 'info', label: 'Info' };
  }

  function scoreLabel(illumFraction) {
    const ill = Number(illumFraction);
    if (!Number.isFinite(ill)) return 'Fair';
    if (ill <= 0.1) return 'Excellent';
    if (ill <= 0.35) return 'Good early';
    if (ill >= 0.7) return 'Poor';
    return 'Fair';
  }

  function normalizeEntries(manifest) {
    if (Array.isArray(manifest.entries)) return manifest.entries;
    const years = Array.isArray(manifest.years) ? manifest.years : [];
    return years.map((y) => ({ year: Number(y.year), site: y.site || 'Unknown', siteSlug: (y.site || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), basePath: y.basePath || `/astronomy/years/${y.year}` }));
  }

  function renderMonthNav(year, darkRows, onSelectMonth) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const byMonth = new Map();
    for (let m = 1; m <= 12; m += 1) byMonth.set(m, 0);
    darkRows.forEach((r) => {
      if (!r.date?.startsWith(`${year}-`)) return;
      const m = Number(r.date.slice(5, 7));
      if (Number.isFinite(m)) byMonth.set(m, (byMonth.get(m) || 0) + 1);
    });
    monthNav.innerHTML = '';
    monthNames.forEach((name, idx) => {
      const month = idx + 1;
      const count = byMonth.get(month) || 0;
      const a = document.createElement('a');
      a.href = '#';
      a.innerHTML = `<span>${name}</span>${count ? `<span class="astro-pill good">${Math.min(count, 9)} dark</span>` : ''}`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        onSelectMonth(month);
        [...monthNav.querySelectorAll('a')].forEach((x) => x.classList.remove('active'));
        a.classList.add('active');
      });
      if (month === 1) a.classList.add('active');
      monthNav.appendChild(a);
    });
  }

  function renderPlanner(year, month, moonPhase, darkRows, allEventNotes = [], sunRows = [], moonRsRows = []) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    plannerTitle.textContent = `${monthNames[month - 1]} planner`;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    plannerGrid.innerHTML = days.map((d) => `<div class="astro-day-name">${d}</div>`).join('');
    const first = new Date(Date.UTC(year, month - 1, 1));
    const firstWeekday = (first.getUTCDay() + 6) % 7; // Monday=0
    const monthLen = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = 0; i < firstWeekday; i += 1) plannerGrid.innerHTML += '<div class="astro-day astro-day-empty"></div>';
    for (let day = 1; day <= monthLen; day += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const mp = moonPhase.find((r) => r.date === key);
      const dw = darkRows.find((r) => r.date === key);
      const sw = sunRows.find((r) => r.date === key);
      const mr = moonRsRows.find((r) => r.date === key);
      const tags = [];
      const dayEvents = allEventNotes.filter((e) => e.date_local === key);
      const illum = Number(mp?.moon_illumination_fraction ?? dw?.moon_illumination_fraction ?? NaN);

      if (Number.isFinite(illum)) {
        const pct = Math.round(illum * 100);
        if (pct <= 3) tags.push(`<span class="astro-pill good">New Moon</span>`);
        else if (pct >= 97) tags.push(`<span class="astro-pill fair">Full Moon</span>`);
        else tags.push(`<span class="astro-pill fair">Moon ${pct}%</span>`);
      }

      if (Number.isFinite(illum)) {
        const dusk = parseIso(sw?.dusk_astronomical_local);
        const dawnRaw = parseIso(sw?.dawn_astronomical_local);
        const rise = parseIso(mr?.moonrise_local);
        const set = parseIso(mr?.moonset_local);
        const dawn = (dusk && dawnRaw && dawnRaw <= dusk) ? new Date(dawnRaw.getTime() + 24 * 3600 * 1000) : dawnRaw;

        let label = 'Fair';
        let cls = 'fair';

        if (illum <= 0.08) {
          label = 'Dark';
          cls = 'good';
        } else if (illum <= 0.15) {
          label = 'Excellent';
          cls = 'good';
        } else if (dusk && dawn && rise && rise >= dusk && rise <= dawn) {
          label = 'Good early';
          cls = 'good';
        } else if (dusk && dawn && set && set >= dusk && set <= dawn) {
          label = 'Good late';
          cls = 'good';
        } else if (illum >= 0.7) {
          label = 'Poor';
          cls = 'poor';
        }

        tags.push(`<span class="astro-pill ${cls}">${label}</span>`);
      }

      const hasMW = dayEvents.some((e) => String(e.title || '').toLowerCase().includes('milky way core window'));
      if (hasMW) tags.push('<span class="astro-pill soft">MW</span>');

      const planetEvent = dayEvents.find((e) => String(e.title || '').toLowerCase().includes('observing window'));
      if (planetEvent) {
        const raw = String(planetEvent.title || '').split(' observing window')[0].trim();
        if (raw) tags.push(`<span class="astro-pill info">${raw}</span>`);
      }

      const minor = dayEvents.find((e) => String(e.title || '').toLowerCase().startsWith('minor planet:'));
      if (minor) {
        const name = String(minor.title || '').split(':').slice(1).join(':').trim() || 'Minor';
        tags.push(`<span class="astro-pill fair">${name}</span>`);
      }

      const conj = dayEvents.find((e) => String(e.title || '').toLowerCase().includes('conjunction'));
      if (conj) tags.push('<span class="astro-pill soft">Conj</span>');

      const shown = tags.slice(0, 2);
      const hidden = tags.slice(2);
      const hiddenEvents = dayEvents.slice(0, 3).map((e) => `${e.title}: ${e.body}`);
      if (hidden.length > 0 || hiddenEvents.length > 0) {
        shown.push(`<button type="button" class="astro-pill soft astro-more-btn" data-day-key="${key}">+more</button>`);
      }

      const popoverHtml = `<div class="astro-day-popover" data-day-popover="${key}" hidden><strong>${fmtDate(key)}</strong><div class="astro-popover-tags">${tags.join('')}</div>${hiddenEvents.length ? `<ul class="astro-popover-events">${hiddenEvents.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`;
      plannerGrid.innerHTML += `<div class="astro-day" data-day-cell="${key}"><strong>${day}</strong><div class="astro-tags">${shown.join('')}</div>${popoverHtml}</div>`;
    }

    plannerGrid.onclick = (ev) => {
      const btn = ev.target instanceof Element ? ev.target.closest('.astro-more-btn') : null;
      if (btn) {
        ev.preventDefault();
        ev.stopPropagation();
        const key = btn.getAttribute('data-day-key');
        if (!key) return;
        const pop = plannerGrid.querySelector(`[data-day-popover="${key}"]`);
        if (!pop) return;
        const opening = pop.hasAttribute('hidden');
        plannerGrid.querySelectorAll('.astro-day-popover').forEach((p) => p.setAttribute('hidden', 'hidden'));
        if (opening) pop.removeAttribute('hidden');
        return;
      }
      if (ev.target instanceof Element && !ev.target.closest('.astro-day-popover')) {
        plannerGrid.querySelectorAll('.astro-day-popover').forEach((p) => p.setAttribute('hidden', 'hidden'));
      }
    };
  }

  async function hydrate(entry) {
    const base = entry.basePath;
    const [notes, sun, dark, moonPhase, moonRs, mwMonthly, planetMonthly] = await Promise.all([
      fetchJson(`${base}/data/ui_notes.json`),
      fetchCsv(`${base}/data/sun_twilight.csv`),
      fetchCsv(`${base}/data/moon_dark_windows.csv`),
      fetchCsv(`${base}/data/moon_phase.csv`),
      fetchCsv(`${base}/data/moonrise_moonset.csv`),
      fetchCsv(`${base}/data/milky_way_monthly_summary.csv`),
      fetchCsv(`${base}/data/planet_visibility_monthly_summary.csv`),
    ]);

    const notesMap = notesById(notes || []);
    const nHero = notesMap.get('hero_subtitle');
    const nMoon = notesMap.get('moon_summary');
    const nMW = notesMap.get('mw_summary');
    const nVal = notesMap.get('validation_summary');

    const tzMatch = (nHero?.body || '').match(/Times shown in ([^.]+)\./);
    const tz = tzMatch ? tzMatch[1] : 'Australia/Brisbane';
    if (generatedAtEl) generatedAtEl.textContent = generatedLabel(entry.generatedAt, tz);
    const todayKey = localDateKey(new Date(), tz);
    const todaySun = sun.find((r) => r.date === todayKey) || sun[0] || null;
    const todayMoon = moonPhase.find((r) => r.date === todayKey) || moonPhase[0] || null;
    const todayRise = moonRs.find((r) => r.date === todayKey) || moonRs[0] || null;
    const todayIll = todayMoon?.moon_illumination_fraction ? Math.round(Number(todayMoon.moon_illumination_fraction) * 100) : null;
    const tonightScore = scoreLabel(todayMoon?.moon_illumination_fraction);

    map.heroTitle.textContent = `${entry.year} observing cockpit`;
    map.heroSubtitle.textContent = nHero?.body || `Generated for ${entry.site}. Times shown in Australia/Brisbane.`;
    map.tonightScore.textContent = tonightScore;
    map.tonightLine.textContent = `Astronomical dark ${fmtTime(todaySun?.dusk_astronomical_local)} to ${fmtTime(todaySun?.dawn_astronomical_local)}. Moon illumination ${todayIll ?? '--'}%.`;
    map.moonMetric.textContent = nMoon?.title || map.moonMetric.textContent;
    map.moonLine.textContent = `Moon rises ${fmtTime(todayRise?.moonrise_local)}, sets ${fmtTime(todayRise?.moonset_local)}. Use moon-free windows first for deep sky.`;
    map.mwMetric.textContent = 'Pre-dawn';
    map.mwLine.textContent = nMW?.body || map.mwLine.textContent;
    map.valMetric.textContent = nVal?.title || map.valMetric.textContent;
    map.valLine.textContent = nVal?.body || map.valLine.textContent;
    map.navTonight.textContent = tonightScore;

    const htmlLink = el('[data-link-html]');
    const pdfLink = el('[data-link-pdf]');
    const csvLink = el('[data-link-csv]');
    htmlLink.href = `${base}/almanac.html`;
    pdfLink.href = `${base}/almanac.pdf`;
    csvLink.href = `${base}/data/`;

    const nowLocal = localDateKey(new Date(), tz);
    const monthFromNow = Number(nowLocal.slice(5, 7));
    const monthFromToday = nowLocal.startsWith(`${entry.year}-`) ? monthFromNow : 1;

    const allEventNotes = (notes || []).filter((n) => n.section === 'events' && n.date_local);
    const darkByDate = new Map((dark || []).map((r) => [String(r.date || ''), r]));
    const sunByDate = new Map((sun || []).map((r) => [String(r.date || ''), r]));

    function normalizeEventKey(title) {
      const t = String(title || '').toLowerCase();
      if (t.includes('jupiter observing window')) return 'planet:jupiter';
      if (t.includes('saturn observing window')) return 'planet:saturn';
      if (t.includes('mars observing window')) return 'planet:mars';
      if (t.includes('dark-sky window')) return 'dark-sky';
      if (t.includes('milky way core window')) return 'milky-way';
      if (t.includes('meteor shower')) return `meteor:${t}`;
      if (t.includes('lunar occultation')) return `occult:${t}`;
      if (t.includes('minor planet')) return `minor:${t}`;
      if (t.includes('comet:')) return `comet:${t}`;
      return `event:${t}`;
    }

    function dedupeEvents(events) {
      const seen = new Set();
      const out = [];
      for (const ev of events) {
        const key = normalizeEventKey(ev.title);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ev);
      }
      return out;
    }

    function withDarkWindowBody(ev) {
      if (!ev || String(ev.title || '').toLowerCase() !== 'dark-sky window') return ev;
      const d = darkByDate.get(String(ev.date_local || ''));
      if (!d) return ev;
      const start = fmtTime(d.start_local);
      const end = fmtTime(d.end_local);
      if (!start || !end || start === '--' || end === '--') return ev;
      const startDt = d.start_local ? new Date(d.start_local) : null;
      const endDt = d.end_local ? new Date(d.end_local) : null;
      const durMin = Number(d.duration_minutes || 0);
      const illumPct = Math.round((Number(d.moon_illumination_fraction || 0)) * 100);
      let windowLabel = `${start} to ${end} local`;
      if (
        startDt instanceof Date && endDt instanceof Date &&
        !Number.isNaN(startDt.getTime()) && !Number.isNaN(endDt.getTime())
      ) {
        const nextDay = endDt.getFullYear() !== startDt.getFullYear()
          || endDt.getMonth() !== startDt.getMonth()
          || endDt.getDate() !== startDt.getDate();
        if (nextDay) windowLabel = `${start} to ${end} (next day) local`;
      }
      const sunRow = sunByDate.get(String(ev.date_local || ''));
      const duskDt = sunRow?.dusk_astronomical_local ? new Date(sunRow.dusk_astronomical_local) : null;
      const dawnRaw = sunRow?.dawn_astronomical_local ? new Date(sunRow.dawn_astronomical_local) : null;
      let darkMinutes = NaN;
      if (duskDt instanceof Date && dawnRaw instanceof Date && !Number.isNaN(duskDt.getTime()) && !Number.isNaN(dawnRaw.getTime())) {
        const dawnDt = new Date(dawnRaw);
        if (dawnDt <= duskDt) dawnDt.setDate(dawnDt.getDate() + 1);
        darkMinutes = Math.max(0, (dawnDt - duskDt) / 60000);
      }
      const freeShare = Number.isFinite(darkMinutes) && darkMinutes > 0 ? Math.max(0, Math.min(1, durMin / darkMinutes)) : NaN;

      let interference = 'Moderate moon interference';
      if (Number.isFinite(freeShare)) {
        if (freeShare >= 0.75) interference = 'Low moon interference';
        else if (freeShare < 0.45) interference = 'High moon interference';
      }
      const body = `${Math.round(durMin)} moon-free minutes. ${interference}. Moon phase ${illumPct}%. Window: ${windowLabel}.`;
      return { ...ev, body };
    }

    function isValidMoonDarkWindow(dateLocal) {
      const d = darkByDate.get(String(dateLocal || ''));
      if (!d) return false;
      const illum = Number(d.moon_illumination_fraction || 1);
      const durMin = Number(d.duration_minutes || 0);
      const sunRow = sunByDate.get(String(dateLocal || ''));
      const duskDt = sunRow?.dusk_astronomical_local ? new Date(sunRow.dusk_astronomical_local) : null;
      const dawnRaw = sunRow?.dawn_astronomical_local ? new Date(sunRow.dawn_astronomical_local) : null;
      if (!(duskDt instanceof Date) || Number.isNaN(duskDt.getTime()) || !(dawnRaw instanceof Date) || Number.isNaN(dawnRaw.getTime())) return false;
      const dawnDt = new Date(dawnRaw);
      if (dawnDt <= duskDt) dawnDt.setDate(dawnDt.getDate() + 1);
      const darkMinutes = Math.max(0, (dawnDt - duskDt) / 60000);
      if (!(darkMinutes > 0)) return false;
      const freeShare = Math.max(0, Math.min(1, durMin / darkMinutes));

      // Strict imaging-oriented dark window gate:
      // - moon illumination must be faint enough
      // - and enough of astronomical darkness must be moon-free
      return illum <= 0.35 && freeShare >= 0.5;
    }

    function visibleEvent(ev) {
      if (!ev) return false;
      const title = String(ev.title || '').toLowerCase();
      if (title !== 'dark-sky window') return true;
      return isValidMoonDarkWindow(ev.date_local);
    }

    function renderUpcomingModal(events, todayKey, endKey) {
      if (!upcomingListEl || !upcomingRangeEl) return;
      upcomingState.events = events || [];
      upcomingState.startKey = todayKey;
      upcomingState.endKey = endKey;
      const f = upcomingState.filter;
      const filtered = upcomingState.events.filter((ev) => {
        const score = String(ev.score || '').toLowerCase();
        const t = String(ev.title || '').toLowerCase();
        const b = String(ev.body || '').toLowerCase();
        if (f === 'excellent') return score.includes('excellent');
        if (f === 'goodplus') return score.includes('excellent') || score.includes('good');
        if (f === 'imaging') return t.includes('planet') || t.includes('minor') || t.includes('comet') || b.includes('imaging');
        if (f === 'planetary') return t.includes('planet') || t.includes('jupiter') || t.includes('saturn') || t.includes('mars') || t.includes('conjunction');
        if (f === 'milkyway') return t.includes('milky way') || b.includes('galactic') || b.includes('core');
        return true;
      });

      upcomingRangeEl.textContent = `From ${fmtDateLong(todayKey)} to ${fmtDateLong(endKey)} (${filtered.length} of ${upcomingState.events.length} events).`;
      if (!filtered.length) {
        upcomingListEl.innerHTML = '<div class="astro-modal-empty">No events found in the next 30 days for this site.</div>';
        return;
      }
      const grouped = new Map();
      filtered.forEach((ev) => {
        const k = String(ev.date_local || 'unknown');
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k).push(ev);
      });
      upcomingListEl.innerHTML = [...grouped.entries()].map(([day, evs]) => {
        const rows = evs.map((rawEv) => {
          const ev = withDarkWindowBody(rawEv);
          const p = scorePill(ev.score);
          const tw = isTwilightInnerPlanet(ev.title) ? '<span class="astro-pill twilight">Twilight</span>' : '';
          return `<article class="astro-modal-event"><time>${eventKind(ev.title)}</time><div><h4>${eventIconSvg(ev.title)}${escapeHtml(ev.title)} ${tw}</h4><p>${escapeHtml(ev.body)}</p></div><span class="astro-pill ${p.cls}">${p.label}</span></article>`;
        }).join('');
        return `<section class="astro-modal-day"><h3>${fmtDayHeading(day)}</h3>${rows}</section>`;
      }).join('');
    }
    rerenderUpcoming = () => {
      renderUpcomingModal(
        upcomingState.events,
        upcomingState.startKey || localDateKey(new Date()),
        upcomingState.endKey || localDateKey(new Date()),
      );
    };

    function renderUpcomingForMonth(month) {
      const start = new Date(`${todayKey}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);
      const endKey = end.toISOString().slice(0, 10);
      const nextThirty = allEventNotes
        .filter((n) => String(n.date_local) >= todayKey && String(n.date_local) <= endKey)
        .filter((n) => visibleEvent(n))
        .sort((a, b) => String(a.date_local).localeCompare(String(b.date_local)));
      renderUpcomingModal(nextThirty, todayKey, endKey);

      const monthKey = `${entry.year}-${String(month).padStart(2, '0')}-`;
      const monthEvents = allEventNotes
        .filter((n) => String(n.date_local).startsWith(monthKey))
        .filter((n) => String(n.date_local) >= todayKey)
        .filter((n) => visibleEvent(n))
        .sort((a, b) => String(a.date_local).localeCompare(String(b.date_local)));
      let events = dedupeEvents(monthEvents).slice(0, 3);
      if (!events.length) {
        const rolling = nextThirty
          .sort((a, b) => String(a.date_local).localeCompare(String(b.date_local)));
        events = dedupeEvents(rolling).slice(0, 3);
      }
      events.forEach((rawEv, idx) => {
      const ev = withDarkWindowBody(rawEv);
      const i = idx + 1;
      const p = scorePill(ev.score);
      const d = root.querySelector(`[data-e${i}-date]`);
      const t = root.querySelector(`[data-e${i}-title]`);
      const b = root.querySelector(`[data-e${i}-note]`);
      const s = root.querySelector(`[data-e${i}-score]`);
      if (d) d.textContent = fmtDate(ev.date_local);
      if (t) {
        const tw = isTwilightInnerPlanet(ev.title) ? ' <span class="astro-pill twilight">Twilight</span>' : '';
        t.innerHTML = `${eventIconSvg(ev.title)}${escapeHtml(ev.title)}${tw}`;
      }
      if (b) b.textContent = ev.body;
      if (s) {
        s.className = `astro-pill ${p.cls}`;
        s.textContent = p.label;
      }
      });
      for (let i = events.length + 1; i <= 3; i += 1) {
        const d = root.querySelector(`[data-e${i}-date]`);
        const t = root.querySelector(`[data-e${i}-title]`);
        const b = root.querySelector(`[data-e${i}-note]`);
        const s = root.querySelector(`[data-e${i}-score]`);
        if (d) d.textContent = '--';
        if (t) t.textContent = 'No upcoming event';
        if (b) b.textContent = 'No future event in this month for the selected site/year.';
        if (s) {
          s.className = 'astro-pill info';
          s.textContent = 'Info';
        }
      }
    }

    renderMonthNav(entry.year, dark, (month) => {
      renderPlanner(entry.year, month, moonPhase, dark, allEventNotes, sun, moonRs);
      renderUpcomingForMonth(month);
      if (map.moonTable && sun.length && moonPhase.length && moonRs.length) {
        const monthKey = `${entry.year}-${String(month).padStart(2, '0')}-`;
        const rows = sun.filter((d) => String(d.date || '').startsWith(monthKey)).slice(0, 31).map((d) => {
          const m = moonPhase.find((x) => x.date === d.date) || {};
          const r = moonRs.find((x) => x.date === d.date) || {};
          const dw = dark.find((x) => x.date === d.date) || {};
          const pct = Math.round(Number(m.moon_illumination_fraction || 0) * 100);
          const score = scoreLabel(dw.moon_illumination_fraction ?? m.moon_illumination_fraction);
          const p = scorePill(score);
          return `<tr><td>${fmtDate(d.date)}</td><td class=\"num\">${fmtTime(d.dusk_astronomical_local)}</td><td class=\"num\">${fmtTime(d.dawn_astronomical_local)}</td><td>${pct}%</td><td class=\"num\">${fmtTime(r.moonrise_local)}</td><td class=\"num\">${fmtTime(r.moonset_local)}</td><td><span class=\"astro-pill ${p.cls}\">${score}</span></td></tr>`;
        });
        map.moonTable.innerHTML = rows.join('');
      }
    });

    renderPlanner(entry.year, monthFromToday || 1, moonPhase, dark, allEventNotes, sun, moonRs);
    renderUpcomingForMonth(monthFromToday || 1);
    const monthLinks = [...monthNav.querySelectorAll('a')];
    const activeIdx = (monthFromToday || 1) - 1;
    if (monthLinks[activeIdx]) {
      monthLinks.forEach((x) => x.classList.remove('active'));
      monthLinks[activeIdx].classList.add('active');
    }

    if (map.planetBody && planetMonthly.length) {
      const pick = ['jupiter', 'saturn', 'mars'].map((name) => planetMonthly.find((r) => String(r.planet || '').toLowerCase() === name)).filter(Boolean);
      if (pick.length) {
        map.planetBody.innerHTML = pick.map((r) => {
          const rating = String(r.rating || 'Fair');
          const p = scorePill(rating);
          const best = r.month || 'This year';
        return `<tr><td>${r.planet}</td><td>${best}</td><td class="num">${Math.round(Number(r.best_altitude_deg || 0))}°</td><td><span class="astro-pill ${p.cls}">${rating}</span></td></tr>`;
      }).join('');
      }
    }

    if (map.moonTable && sun.length && moonPhase.length && moonRs.length) {
      const monthKey = `${entry.year}-${String(monthFromToday || 1).padStart(2, '0')}-`;
      const rows = sun.filter((d) => String(d.date || '').startsWith(monthKey)).slice(0, 31).map((d) => {
        const m = moonPhase.find((x) => x.date === d.date) || {};
        const r = moonRs.find((x) => x.date === d.date) || {};
        const dw = dark.find((x) => x.date === d.date) || {};
        const pct = Math.round(Number(m.moon_illumination_fraction || 0) * 100);
        const score = scoreLabel(dw.moon_illumination_fraction ?? m.moon_illumination_fraction);
        const p = scorePill(score);
        return `<tr><td>${fmtDate(d.date)}</td><td class="num">${fmtTime(d.dusk_astronomical_local)}</td><td class="num">${fmtTime(d.dawn_astronomical_local)}</td><td>${pct}%</td><td class="num">${fmtTime(r.moonrise_local)}</td><td class="num">${fmtTime(r.moonset_local)}</td><td><span class="astro-pill ${p.cls}">${score}</span></td></tr>`;
      });
      map.moonTable.innerHTML = rows.join('');
    }
  }

  const manifest = await fetchJson('/astronomy/manifest.json');
  const entries = normalizeEntries(manifest || {});
  if (!entries.length) {
    status.textContent = 'No astronomy bundles found yet.';
    return;
  }

  const years = [...new Set(entries.map((e) => Number(e.year)))].sort((a, b) => a - b);
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');

  function fillSites() {
    const y = Number(yearSelect.value || years[0]);
    const sites = entries.filter((e) => Number(e.year) === y);
    const current = siteSelect.value;
    siteSelect.innerHTML = sites.map((s) => `<option value="${s.siteSlug}">${s.site}</option>`).join('');
    if (current && sites.some((s) => s.siteSlug === current)) siteSelect.value = current;
    const se = sites.find((s) => String(s.site).toLowerCase() === 'south east queensland, australia');
    if (se) siteSelect.value = se.siteSlug;
    return sites;
  }

  async function refresh() {
    const sites = fillSites();
    const selected = sites.find((s) => s.siteSlug === siteSelect.value) || sites[0];
    if (!selected) return;
    status.textContent = `Viewing ${selected.site} · ${selected.year}`;
    await hydrate(selected);
  }

  yearSelect.addEventListener('change', refresh);
  siteSelect.addEventListener('change', refresh);

  if (upcomingOpenBtn && upcomingModal) {
    const closeModal = () => {
      upcomingModal.setAttribute('hidden', 'hidden');
      document.body.style.overflow = '';
    };
    const openModal = () => {
      upcomingModal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    };
    upcomingOpenBtn.addEventListener('click', openModal);
    if (upcomingCloseBtn) upcomingCloseBtn.addEventListener('click', closeModal);
    upcomingModal.addEventListener('click', (ev) => {
      if (ev.target === upcomingModal) closeModal();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !upcomingModal.hasAttribute('hidden')) closeModal();
    });
  }

  if (upcomingFiltersEl) {
    upcomingFiltersEl.addEventListener('click', (ev) => {
      const targetEl = ev.target instanceof Element ? ev.target : ev.target?.parentElement || null;
      const btn = targetEl ? targetEl.closest('[data-filter]') : null;
      if (!btn) return;
      upcomingState.filter = btn.getAttribute('data-filter') || 'all';
      upcomingFiltersEl.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (typeof rerenderUpcoming === 'function') rerenderUpcoming();
    });
  }

  fillSites();
  await refresh();
})();
