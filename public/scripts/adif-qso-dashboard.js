import { formatUtcTime, mergeParsedFiles, normaliseQso, parseAdi } from '/scripts/adif-core.js';

const pad2 = (n) => String(n).padStart(2, '0');
const safeUpper = (value) => String(value || '').trim().toUpperCase();
const safeLower = (value) => String(value || '').trim().toLowerCase();

const toAlpha = (colour, alpha) => {
  if (colour.startsWith('#')) {
    let hex = colour.slice(1);

    if (hex.length === 3) {
      hex = hex.split('').map((char) => char + char).join('');
    }

    if (hex.length === 6) {
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }

  return colour;
};

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const compareRows = (left, right) => {
  if (!left.dt && !right.dt) return 0;
  if (!left.dt) return 1;
  if (!right.dt) return -1;
  return left.dt - right.dt;
};

function drawRateChart(canvas, bins, labels) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const textColour = getComputedStyle(canvas).color || '#0f172a';
  const gridColour = toAlpha(textColour, 0.16);
  const barColour = toAlpha(textColour, 0.68);

  const padTop = 24;
  const padRight = 18;
  const padBottom = 34;
  const padLeft = 28;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const maxValue = Math.max(1, ...bins);
  const barWidth = graphWidth / Math.max(1, bins.length);

  context.strokeStyle = gridColour;
  for (let index = 0; index <= 4; index += 1) {
    const y = padTop + (graphHeight * index) / 4;
    context.beginPath();
    context.moveTo(padLeft, y);
    context.lineTo(padLeft + graphWidth, y);
    context.stroke();
  }

  context.fillStyle = barColour;
  bins.forEach((value, index) => {
    const barHeight = (value / maxValue) * graphHeight;
    const x = padLeft + index * barWidth;
    const y = padTop + graphHeight - barHeight;
    context.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
  });

  context.fillStyle = textColour;
  context.font = '12px system-ui, -apple-system, Roboto, Arial, sans-serif';
  context.fillText('QSOs/min', padLeft, 15);

  const step = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((label, index) => {
    if (index % step !== 0) return;
    context.fillText(label, padLeft + index * barWidth, height - 8);
  });
}

function populateSelect(select, values) {
  if (!select) return;

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderRows(tableBody, rows) {
  if (!tableBody) return;

  tableBody.innerHTML = '';
  for (const rowData of rows) {
    const row = document.createElement('tr');
    row.innerHTML =
      `<td>${rowData.utc || '—'}</td>` +
      `<td>${rowData.call || '—'}</td>` +
      `<td>${rowData.band || '—'}</td>` +
      `<td>${rowData.mode || '—'}</td>` +
      `<td>${rowData.rstSent || '—'}</td>` +
      `<td>${rowData.rstReceived || '—'}</td>` +
      `<td>${rowData.grid || '—'}</td>` +
      `<td>${rowData.ref || '—'}</td>`;
    tableBody.appendChild(row);
  }

  if (!rows.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8">No QSOs match the current filters.</td>';
    tableBody.appendChild(row);
  }
}

async function initDash() {
  const dash = document.querySelector('.qsoDash');
  if (!dash) return;

  const aUrl = dash.getAttribute('data-adif-a');
  const bUrl = dash.getAttribute('data-adif-b');
  const errBox = dash.querySelector('[data-qso-error]');
  const setErr = (message) => {
    if (!errBox) return;
    errBox.hidden = false;
    errBox.textContent = message;
  };

  let rows = [];
  try {
    const [aRes, bRes] = await Promise.all([fetch(aUrl), fetch(bUrl)]);
    if (!aRes.ok || !bRes.ok) throw new Error('ADIF fetch failed');

    const parsed = mergeParsedFiles([
      parseAdi(await aRes.text()),
      parseAdi(await bRes.text()),
    ]);

    rows = parsed.records
      .map((record) => normaliseQso(record))
      .filter((row) => row.call || row.dt)
      .sort(compareRows);
  } catch (error) {
    console.error(error);
    setErr('Could not load ADIF logs. Place the two .adi files in /public/logs/ using the filenames shown in the note above.');
    return;
  }

  const total = rows.length;
  const first = rows.find((row) => row.dt)?.dt || null;
  const last = rows.slice().reverse().find((row) => row.dt)?.dt || null;
  const duration = first && last ? last - first : 0;
  const bands = [...new Set(rows.map((row) => row.band).filter(Boolean))];
  const modes = [...new Set(rows.map((row) => row.mode).filter(Boolean))];

  const kpi = (key) => dash.querySelector(`[data-kpi="${key}"]`);
  if (kpi('total')) kpi('total').textContent = String(total);
  if (kpi('duration')) kpi('duration').textContent = first && last ? formatDuration(duration) : '—';
  if (kpi('first')) kpi('first').textContent = first ? formatUtcTime(first) : '—';
  if (kpi('last')) kpi('last').textContent = last ? formatUtcTime(last) : '—';
  if (kpi('bands')) kpi('bands').textContent = bands.length ? bands.join(', ') : '—';
  if (kpi('modes')) kpi('modes').textContent = modes.length ? modes.join(', ') : '—';

  const bandCounts = new Map();
  rows.forEach((row) => {
    if (!row.band) return;
    bandCounts.set(row.band, (bandCounts.get(row.band) || 0) + 1);
  });

  const bandTable = dash.querySelector('[data-band-table]');
  if (bandTable) {
    bandTable.innerHTML = '';
    [...bandCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([band, count]) => {
        const tr = document.createElement('tr');
        const percentage = total ? Math.round((count / total) * 100) : 0;
        tr.innerHTML = `<td>${band}</td><td>${count}</td><td>${percentage}%</td>`;
        bandTable.appendChild(tr);
      });
  }

  const chart = dash.querySelector('#qsoRateChart');
  if (chart && first && last) {
    const startMs = first.getTime();
    const endMs = last.getTime();
    const binMs = 60 * 1000;
    const binCount = Math.max(1, Math.ceil((endMs - startMs + 1) / binMs));
    const bins = new Array(binCount).fill(0);

    rows.forEach((row) => {
      if (!row.dt) return;
      const index = Math.min(binCount - 1, Math.max(0, Math.floor((row.dt.getTime() - startMs) / binMs)));
      bins[index] += 1;
    });

    const labels = bins.map((_, index) => {
      const stamp = new Date(startMs + index * binMs);
      return `${pad2(stamp.getUTCHours())}:${pad2(stamp.getUTCMinutes())}`;
    });

    drawRateChart(chart, bins, labels);

    const meta = dash.querySelector('[data-rate-meta]');
    if (meta) {
      const peak = Math.max(...bins);
      const average = total / Math.max(1, binCount);
      meta.textContent = `Peak: ${peak} QSOs/min • Avg: ${average.toFixed(2)} QSOs/min • Bins: ${binCount}`;
    }
  }

  const tableBody = dash.querySelector('[data-qso-table]');
  const filterInput = dash.querySelector('[data-qso-filter]');
  const bandSelect = dash.querySelector('[data-qso-band]');
  const modeSelect = dash.querySelector('[data-qso-mode]');

  populateSelect(bandSelect, bands.sort());
  populateSelect(modeSelect, modes.sort());

  const update = () => {
    const query = safeUpper(filterInput?.value);
    const band = safeLower(bandSelect?.value);
    const mode = safeUpper(modeSelect?.value);

    const filtered = rows.filter((row) => {
      if (band && row.band !== band) return false;
      if (mode && row.mode !== mode) return false;
      if (!query) return true;

      return [row.utc, row.call, row.band, row.mode, row.grid, row.ref]
        .join(' ')
        .toUpperCase()
        .includes(query);
    });

    renderRows(tableBody, filtered);
  };

  filterInput?.addEventListener('input', update);
  bandSelect?.addEventListener('change', update);
  modeSelect?.addEventListener('change', update);
  update();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDash, { once: true });
} else {
  initDash();
}
