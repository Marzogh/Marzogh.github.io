import {
  ADIF_VERSION,
  applyExportPreset,
  dedupeRecords,
  detectDuplicateRecords,
  formatUtcTime,
  makeCreatedTimestamp,
  makeDownload,
  mergeParsedFiles,
  normaliseQso,
  parseAdi,
  serialiseAdi,
  serialiseCsv,
  serialiseJson,
  setField,
  validateParsedAdi,
} from '/scripts/adif-core.js';

const BAND_ORDER = ['2190m', '630m', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '4m', '2m', '1.25m', '70cm', '33cm', '23cm'];

const pad2 = (n) => String(n).padStart(2, '0');

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

  const rgbMatch = colour.match(/^rgb\(([^)]+)\)$/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${alpha})`;
  }

  return colour;
};

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  }

  return `${minutes}m ${pad2(seconds)}s`;
};

const safeUpper = (value) => String(value || '').trim().toUpperCase();
const safeLower = (value) => String(value || '').trim().toLowerCase();

const compareBands = (a, b) => {
  const aIndex = BAND_ORDER.indexOf(a);
  const bIndex = BAND_ORDER.indexOf(b);

  if (aIndex !== -1 || bIndex !== -1) {
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  }

  return a.localeCompare(b, undefined, { numeric: true });
};

function countBy(items, key) {
  const counts = new Map();

  for (const item of items) {
    const value = String(item[key] || '').trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return counts;
}

function pickBinSize(start, end) {
  const span = Math.max(1, end - start);

  if (span > 1000 * 60 * 60 * 24 * 2) return 1000 * 60 * 60;
  if (span > 1000 * 60 * 60 * 10) return 1000 * 60 * 15;
  if (span > 1000 * 60 * 60 * 3) return 1000 * 60 * 5;
  return 1000 * 60;
}

function drawRateChart(canvas, bins, labels) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = Math.round(width * 0.34);

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const computed = getComputedStyle(canvas);
  const textColour = computed.color || '#0f172a';
  const lineColour = toAlpha(textColour, 0.14);
  const fillColour = toAlpha(textColour, 0.7);

  const padTop = 24;
  const padRight = 18;
  const padBottom = 34;
  const padLeft = 32;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const maxValue = Math.max(1, ...bins);

  context.strokeStyle = lineColour;
  context.lineWidth = 1;

  for (let index = 0; index <= 4; index += 1) {
    const y = padTop + (graphHeight * index) / 4;
    context.beginPath();
    context.moveTo(padLeft, y);
    context.lineTo(padLeft + graphWidth, y);
    context.stroke();
  }

  const barWidth = graphWidth / Math.max(1, bins.length);
  context.fillStyle = fillColour;

  bins.forEach((value, index) => {
    const barHeight = (value / maxValue) * graphHeight;
    const x = padLeft + index * barWidth;
    const y = padTop + graphHeight - barHeight;
    context.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
  });

  context.fillStyle = textColour;
  context.font = '12px system-ui, -apple-system, Roboto, Arial, sans-serif';
  context.globalAlpha = 0.82;
  context.fillText('QSOs / bin', padLeft, 14);

  const labelStep = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((label, index) => {
    if (index % labelStep !== 0) return;
    const x = padLeft + index * barWidth;
    context.fillText(label, x, height - 10);
  });

  context.globalAlpha = 1;
}

function makeCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text || '—';
  return cell;
}

function populateBreakdownTable(tbody, counts, total, sortFn, emptyMessage) {
  if (!tbody) return;

  tbody.innerHTML = '';
  const entries = [...counts.entries()].sort(sortFn);

  if (!entries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = emptyMessage;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  entries.forEach(([label, count]) => {
    const row = document.createElement('tr');
    row.appendChild(makeCell(label));
    row.appendChild(makeCell(String(count)));
    row.appendChild(makeCell(`${Math.round((count / total) * 100)}%`));
    tbody.appendChild(row);
  });
}

function renderFileList(target, files) {
  if (!target) return;

  target.innerHTML = '';
  if (!files.length) {
    target.hidden = true;
    return;
  }

  files.forEach((file) => {
    const pill = document.createElement('span');
    pill.className = 'adifFilePill';
    pill.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
    target.appendChild(pill);
  });

  target.hidden = false;
}

function populateSelect(select, values, placeholder) {
  if (!select) return;

  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = placeholder;
  select.appendChild(blank);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderTableRows(tbody, rows) {
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.textContent = 'No QSOs match the current filters.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  rows.forEach((record) => {
    const row = document.createElement('tr');
    row.appendChild(makeCell(record.utc));
    row.appendChild(makeCell(record.call));
    row.appendChild(makeCell(record.band));
    row.appendChild(makeCell(record.mode));
    row.appendChild(makeCell(record.rstSent));
    row.appendChild(makeCell(record.rstReceived));
    row.appendChild(makeCell(record.grid));
    row.appendChild(makeCell(record.ref));
    tbody.appendChild(row);
  });
}

async function parseFiles(files) {
  const fileTexts = await Promise.all(files.map(async (file) => ({
    file,
    text: await file.text(),
  })));

  const parsedFiles = fileTexts.map(({ text }) => parseAdi(text));
  const merged = mergeParsedFiles(parsedFiles);
  const rows = merged.records
    .map((record) => normaliseQso(record))
    .filter((row) => row.call || row.dt)
    .sort((left, right) => {
      if (!left.dt && !right.dt) return 0;
      if (!left.dt) return 1;
      if (!right.dt) return -1;
      return left.dt - right.dt;
    });

  return { merged, rows };
}

function initialiseTool(root) {
  const input = root.querySelector('[data-adif-input]');
  const dropzone = root.querySelector('[data-adif-dropzone]');
  const status = root.querySelector('[data-adif-status]');
  const fileList = root.querySelector('[data-adif-files]');
  const empty = root.querySelector('[data-adif-empty]');
  const results = root.querySelector('[data-adif-results]');
  const exportPanel = root.querySelector('[data-adif-export]');
  const warningsPanel = root.querySelector('[data-adif-warnings-panel]');
  const warningSummary = root.querySelector('[data-adif-warning-summary]');
  const warningList = root.querySelector('[data-adif-warning-list]');
  const manualForm = root.querySelector('[data-adif-manual-form]');
  const manualStatus = root.querySelector('[data-adif-manual-status]');

  const chart = root.querySelector('[data-adif-chart]');
  const rateMeta = root.querySelector('[data-adif-rate-meta]');
  const bandTable = root.querySelector('[data-adif-band-table]');
  const modeTable = root.querySelector('[data-adif-mode-table]');
  const qsoTable = root.querySelector('[data-adif-qso-table]');
  const filterInput = root.querySelector('[data-adif-filter]');
  const bandSelect = root.querySelector('[data-adif-band]');
  const modeSelect = root.querySelector('[data-adif-mode]');
  const exportPreset = root.querySelector('[data-adif-export-preset]');
  const exportStation = root.querySelector('[data-adif-export-station]');
  const exportOperator = root.querySelector('[data-adif-export-operator]');
  const exportMyRef = root.querySelector('[data-adif-export-my-ref]');
  const exportContactRef = root.querySelector('[data-adif-export-contact-ref]');
  const exportFilename = root.querySelector('[data-adif-export-filename]');
  const exportOverwrite = root.querySelector('[data-adif-export-overwrite]');
  const exportButtons = [...root.querySelectorAll('[data-adif-export-download]')];
  const dedupeMode = root.querySelector('[data-adif-dedupe-mode]');
  const exportStatus = root.querySelector('[data-adif-export-status]');
  const kpi = (key) => root.querySelector(`[data-kpi="${key}"]`);

  let allRows = [];
  let parsedBundle = null;
  let duplicateInfo = { mode: 'fuzzy', duplicateCount: 0, duplicateGroupCount: 0, groups: [], duplicateIndexes: new Set() };
  let validationWarnings = [];
  let sourceFileCount = 0;

  const setStatus = (message, state = 'info') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  const setExportStatus = (message) => {
    if (!exportStatus) return;
    exportStatus.textContent = message;
  };

  const setManualStatus = (message) => {
    if (!manualStatus) return;
    manualStatus.textContent = message;
  };

  const ensureBundle = () => {
    if (parsedBundle) return parsedBundle;

    parsedBundle = {
      header: {
        text: 'Manually entered log built in-browser.',
        fields: [],
        userDefs: [],
        appFieldTypes: {},
      },
      records: [],
    };

    return parsedBundle;
  };

  const updateFilters = () => {
    const query = safeUpper(filterInput ? filterInput.value : '');
    const band = safeLower(bandSelect ? bandSelect.value : '');
    const mode = safeUpper(modeSelect ? modeSelect.value : '');

    const filteredRows = allRows.filter((row) => {
      if (band && row.band !== band) return false;
      if (mode && row.mode !== mode) return false;
      if (!query) return true;

      const haystack = [row.utc, row.call, row.band, row.mode, row.grid, row.ref].join(' ').toUpperCase();
      return haystack.includes(query);
    });

    renderTableRows(qsoTable, filteredRows);
  };

  const renderSummary = (rows, files) => {
    const total = rows.length;
    const datedRows = rows.filter((row) => row.dt);
    const first = datedRows[0]?.dt || null;
    const last = datedRows[datedRows.length - 1]?.dt || null;
    const duration = first && last ? last - first : 0;

    const bands = [...new Set(rows.map((row) => row.band).filter(Boolean))].sort(compareBands);
    const modes = [...new Set(rows.map((row) => row.mode).filter(Boolean))].sort();
    const uniqueCalls = new Set(rows.map((row) => row.call).filter(Boolean)).size;

    if (kpi('total')) kpi('total').textContent = String(total);
    if (kpi('files')) kpi('files').textContent = String(files.length);
    if (kpi('duration')) kpi('duration').textContent = first && last ? formatDuration(duration) : '—';
    if (kpi('first')) kpi('first').textContent = first ? formatUtcTime(first) : '—';
    if (kpi('last')) kpi('last').textContent = last ? formatUtcTime(last) : '—';
    if (kpi('bands')) kpi('bands').textContent = bands.length ? bands.join(', ') : '—';
    if (kpi('modes')) kpi('modes').textContent = modes.length ? modes.join(', ') : '—';
    if (kpi('calls')) kpi('calls').textContent = String(uniqueCalls || 0);
    if (kpi('duplicates')) {
      kpi('duplicates').textContent = duplicateInfo.duplicateCount
        ? `${duplicateInfo.duplicateCount} in ${duplicateInfo.duplicateGroupCount} group${duplicateInfo.duplicateGroupCount === 1 ? '' : 's'}`
        : 'None spotted';
    }
    if (kpi('warnings')) {
      kpi('warnings').textContent = validationWarnings.length ? String(validationWarnings.length) : 'None';
    }

    populateBreakdownTable(
      bandTable,
      countBy(rows, 'band'),
      total,
      (a, b) => b[1] - a[1] || compareBands(a[0], b[0]),
      'No band data found in these logs.'
    );

    populateBreakdownTable(
      modeTable,
      countBy(rows, 'mode'),
      total,
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      'No mode data found in these logs.'
    );

    populateSelect(bandSelect, bands, 'All bands');
    populateSelect(modeSelect, modes, 'All modes');

    if (chart && first && last) {
      const startMs = first.getTime();
      const endMs = last.getTime();
      const binMs = pickBinSize(startMs, endMs);
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

      if (rateMeta) {
        const peak = Math.max(...bins);
        const average = total / Math.max(1, binCount);
        const binLabel =
          binMs >= 1000 * 60 * 60 ? '1 hour bins' :
          binMs >= 1000 * 60 * 15 ? '15 minute bins' :
          binMs >= 1000 * 60 * 5 ? '5 minute bins' :
          '1 minute bins';

        rateMeta.textContent = `Peak: ${peak} QSOs/bin. Average: ${average.toFixed(2)}. Chart using ${binLabel}.`;
      }
    } else if (rateMeta) {
      rateMeta.textContent = 'Not enough timing information in the log to draw a proper rate chart.';
    }
  };

  const sortRows = (rows) => rows.slice().sort((left, right) => {
    if (!left.dt && !right.dt) return 0;
    if (!left.dt) return 1;
    if (!right.dt) return -1;
    return left.dt - right.dt;
  });

  const refreshFromBundle = (statusMessage) => {
    if (!parsedBundle) return;

    allRows = sortRows(
      parsedBundle.records
        .map((record) => normaliseQso(record))
        .filter((row) => row.call || row.dt)
    );

    duplicateInfo = detectDuplicateRecords(parsedBundle.records, { mode: 'fuzzy', thresholdMs: 90 * 1000 });
    validationWarnings = validateParsedAdi(parsedBundle);

    if (!allRows.length) {
      results.hidden = true;
      if (exportPanel) exportPanel.hidden = true;
      if (warningsPanel) warningsPanel.hidden = true;
      empty.hidden = false;
      return;
    }

    results.hidden = false;
    if (exportPanel) exportPanel.hidden = false;
    empty.hidden = true;

    renderSummary(allRows, new Array(sourceFileCount).fill(null));
    renderWarnings();
    updateFilters();
    syncExportHints();

    if (statusMessage) {
      setStatus(statusMessage);
    }
  };

  const renderWarnings = () => {
    if (!warningsPanel || !warningList || !warningSummary) return;

    warningList.innerHTML = '';
    const items = [...validationWarnings];

    if (duplicateInfo.duplicateCount) {
      items.unshift({
        level: 'warning',
        code: 'duplicate-qsos',
        message: `${duplicateInfo.duplicateCount} records appear to be duplicates, spread across ${duplicateInfo.duplicateGroupCount} group${duplicateInfo.duplicateGroupCount === 1 ? '' : 's'}.`,
      });
    }

    if (!items.length) {
      warningsPanel.hidden = true;
      return;
    }

    warningsPanel.hidden = false;
    warningSummary.textContent = `${items.length} thing${items.length === 1 ? '' : 's'} worth checking before you trust the export with your whole heart.`;

    items.slice(0, 18).forEach((warning) => {
      const item = document.createElement('li');
      item.textContent = warning.message;
      warningList.appendChild(item);
    });

    if (items.length > 18) {
      const item = document.createElement('li');
      item.textContent = `...and ${items.length - 18} more in the same general spirit.`;
      warningList.appendChild(item);
    }
  };

  const syncExportHints = () => {
    if (!exportPreset) return;

    const preset = exportPreset.value;
    const needsMyRef = preset === 'pota-activator' || preset === 'sota-activator';
    const needsContactRef = preset === 'pota-hunter' || preset === 'sota-chaser' || preset === 'pota-activator' || preset === 'sota-activator';

    if (exportMyRef) {
      exportMyRef.disabled = !needsMyRef;
      exportMyRef.placeholder = preset.startsWith('sota') ? 'VK/XX-000' : 'VK-1234';
    }

    if (exportContactRef) {
      exportContactRef.disabled = !needsContactRef;
      exportContactRef.placeholder = preset.startsWith('sota') ? 'Other summit ref (optional for S2S)' : 'Park reference';
    }

    setExportStatus(
      preset === 'generic'
        ? `Exports a clean ADI file with an ADIF ${ADIF_VERSION} header and your parsed records intact.`
        : `Exports a clean ADI file and stamps the records with ${preset.replace('-', ' ')} fields without sending anything anywhere.`
    );
  };

  const handleFiles = async (fileListLike) => {
    const files = [...fileListLike].filter((file) => /\.(adi|adif)$/i.test(file.name));

    renderFileList(fileList, files);
    sourceFileCount = files.length;

    if (!files.length) {
      allRows = [];
      parsedBundle = null;
      sourceFileCount = 0;
      results.hidden = true;
      if (exportPanel) exportPanel.hidden = true;
      empty.hidden = false;
      setStatus('Those do not look like ADIF files. I am being fussy on purpose.', 'error');
      return;
    }

    setStatus(`Reading ${files.length} file${files.length === 1 ? '' : 's'}...`);

      try {
      const parsed = await parseFiles(files);
      parsedBundle = parsed.merged;
    } catch (error) {
      console.error(error);
      allRows = [];
      parsedBundle = null;
      results.hidden = true;
      if (exportPanel) exportPanel.hidden = true;
      if (warningsPanel) warningsPanel.hidden = true;
      empty.hidden = false;
      setStatus('The files loaded, but the parser tripped over something unpleasant.', 'error');
      return;
    }

    if (!parsedBundle) {
      results.hidden = true;
      if (exportPanel) exportPanel.hidden = true;
      if (warningsPanel) warningsPanel.hidden = true;
      empty.hidden = false;
      setStatus('No QSO records turned up in those files. Either the logs are empty or the export is doing something extremely creative.', 'error');
      return;
    }

    refreshFromBundle(`Parsed ${parsedBundle.records.length} QSO${parsedBundle.records.length === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}.`);

    if (exportFilename && !exportFilename.value) {
      exportFilename.value = files.length === 1
        ? files[0].name.replace(/\.(adi|adif)$/i, '')
        : 'combined-log';
    }
  };

  if (filterInput) filterInput.addEventListener('input', updateFilters);
  if (bandSelect) bandSelect.addEventListener('change', updateFilters);
  if (modeSelect) modeSelect.addEventListener('change', updateFilters);
  if (exportPreset) exportPreset.addEventListener('change', syncExportHints);

  manualForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const call = form.querySelector('[data-manual-call]')?.value?.trim() || '';
    const date = form.querySelector('[data-manual-date]')?.value || '';
    const time = form.querySelector('[data-manual-time]')?.value || '';
    const band = form.querySelector('[data-manual-band]')?.value?.trim() || '';
    const mode = form.querySelector('[data-manual-mode]')?.value?.trim() || '';
    const grid = form.querySelector('[data-manual-grid]')?.value?.trim() || '';
    const rstSent = form.querySelector('[data-manual-rst-sent]')?.value?.trim() || '';
    const rstReceived = form.querySelector('[data-manual-rst-received]')?.value?.trim() || '';
    const ref = form.querySelector('[data-manual-ref]')?.value?.trim() || '';
    const station = form.querySelector('[data-manual-station]')?.value?.trim() || '';

    if (!call || !date || !time) {
      setManualStatus('Need at least a callsign, date, and time before I can pretend this is a log entry.');
      return;
    }

    const bundle = ensureBundle();
    const record = { fields: {}, order: [] };

    const qsoDate = date.replace(/-/g, '');
    const timeOn = time.replace(/:/g, '');

    setField(record, 'CALL', call.toUpperCase());
    setField(record, 'QSO_DATE', qsoDate);
    setField(record, 'TIME_ON', timeOn);
    if (band) setField(record, 'BAND', band.toLowerCase());
    if (mode) setField(record, 'MODE', mode.toUpperCase());
    if (grid) setField(record, 'GRIDSQUARE', grid.toUpperCase());
    if (rstSent) setField(record, 'RST_SENT', rstSent);
    if (rstReceived) setField(record, 'RST_RCVD', rstReceived);
    if (station) setField(record, 'STATION_CALLSIGN', station.toUpperCase());
    if (ref) setField(record, 'SIG_INFO', ref);

    bundle.records.push(record);
    refreshFromBundle(`Built ${bundle.records.length} QSO${bundle.records.length === 1 ? '' : 's'} in-browser.`);
    setManualStatus(`Added ${call.toUpperCase()} at ${qsoDate} ${timeOn} UTC.`);
    manualForm.reset();
  });

  exportButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!parsedBundle) return;

      const preset = exportPreset?.value || 'generic';
      const baseRecords = preset === 'generic'
        ? parsedBundle.records
        : applyExportPreset(parsedBundle.records, preset, {
            stationCallsign: exportStation?.value,
            operator: exportOperator?.value,
            myRef: exportMyRef?.value,
            contactRef: exportContactRef?.value,
            overwrite: exportOverwrite?.checked,
          });
      const strategy = dedupeMode?.value || 'keep-all';
      const records = dedupeRecords(baseRecords, strategy, { thresholdMs: 90 * 1000 });
      const format = button.dataset.exportFormat || 'adi';

      let output = '';
      let extension = 'adi';

      if (format === 'csv') {
        output = serialiseCsv(records);
        extension = 'csv';
      } else if (format === 'json') {
        output = serialiseJson(records);
        extension = 'json';
      } else {
        output = serialiseAdi(parsedBundle, {
          records,
          adifVersion: ADIF_VERSION,
          programId: 'ChipsnCode ADIF Tool',
          programVersion: '1.2',
          createdTimestamp: makeCreatedTimestamp(),
        });
        extension = 'adi';
      }

      const baseName = (exportFilename?.value || 'adif-export').trim() || 'adif-export';
      const suffix = preset === 'generic' ? '' : `-${preset}`;
      const dedupeSuffix =
        strategy === 'keep-first-fuzzy'
          ? '-fuzzy-deduped'
          : strategy === 'keep-first-exact'
            ? '-deduped'
            : '';
      makeDownload(`${baseName}${suffix}${dedupeSuffix}.${extension}`, output);
      setExportStatus(`Downloaded ${baseName}${suffix}${dedupeSuffix}.${extension}`);
    });
  });

  if (input) {
    input.addEventListener('change', (event) => {
      const files = event.target?.files;
      if (files) handleFiles(files);
    });
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', (event) => {
      const files = event.dataTransfer?.files;
      if (files) handleFiles(files);
    });
  }

  window.addEventListener('resize', () => {
    if (!allRows.length || !chart) return;
    const datedRows = allRows.filter((row) => row.dt);
    const first = datedRows[0]?.dt;
    const last = datedRows[datedRows.length - 1]?.dt;
    if (!first || !last) return;

    const startMs = first.getTime();
    const endMs = last.getTime();
    const binMs = pickBinSize(startMs, endMs);
    const binCount = Math.max(1, Math.ceil((endMs - startMs + 1) / binMs));
    const bins = new Array(binCount).fill(0);

    allRows.forEach((row) => {
      if (!row.dt) return;
      const index = Math.min(binCount - 1, Math.max(0, Math.floor((row.dt.getTime() - startMs) / binMs)));
      bins[index] += 1;
    });

    const labels = bins.map((_, index) => {
      const stamp = new Date(startMs + index * binMs);
      return `${pad2(stamp.getUTCHours())}:${pad2(stamp.getUTCMinutes())}`;
    });

    drawRateChart(chart, bins, labels);
  });

  syncExportHints();
}

function init() {
  document.querySelectorAll('[data-adif-tool]').forEach(initialiseTool);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
