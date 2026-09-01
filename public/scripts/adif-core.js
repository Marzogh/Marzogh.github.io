const ADIF_VERSION = '3.1.6';

const BAND_RANGES = [
  ['2190m', 0.1357, 0.1378],
  ['630m', 0.472, 0.479],
  ['160m', 1.8, 2.0],
  ['80m', 3.5, 4.0],
  ['60m', 5.0, 5.5],
  ['40m', 7.0, 7.3],
  ['30m', 10.0, 10.2],
  ['20m', 14.0, 14.4],
  ['17m', 18.068, 18.168],
  ['15m', 21.0, 21.45],
  ['12m', 24.89, 24.99],
  ['10m', 28.0, 29.7],
  ['6m', 50.0, 54.0],
  ['4m', 70.0, 71.0],
  ['2m', 144.0, 148.0],
  ['1.25m', 222.0, 225.0],
  ['70cm', 420.0, 450.0],
  ['33cm', 902.0, 928.0],
  ['23cm', 1240.0, 1300.0],
];

const VALID_TIME_PATTERN = /^\d{4}(\d{2})?$/;
const VALID_DATE_PATTERN = /^\d{8}$/;

function normaliseName(name) {
  return String(name || '').trim().toUpperCase();
}

function isMarker(name, expected) {
  return normaliseName(name) === expected;
}

function parseDataSpecifier(content) {
  const parts = String(content || '').split(':');
  if (parts.length < 2) return null;

  const name = parts[0].trim();
  if (!name) return null;

  const lengthRaw = parts[1].trim();
  if (!/^\d+$/.test(lengthRaw)) return null;

  return {
    name,
    normalisedName: normaliseName(name),
    length: Number(lengthRaw),
    type: parts[2] ? parts[2].trim() : '',
  };
}

function tokeniseAdi(sourceText) {
  const text = String(sourceText || '').replace(/^\uFEFF/, '');
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const open = text.indexOf('<', index);

    if (open === -1) {
      if (index < text.length) {
        tokens.push({ kind: 'text', value: text.slice(index) });
      }
      break;
    }

    if (open > index) {
      tokens.push({ kind: 'text', value: text.slice(index, open) });
    }

    const close = text.indexOf('>', open + 1);
    if (close === -1) {
      tokens.push({ kind: 'text', value: text.slice(open) });
      break;
    }

    const tagContent = text.slice(open + 1, close).trim();
    const markerName = normaliseName(tagContent);

    if (markerName === 'EOH' || markerName === 'EOR') {
      tokens.push({ kind: 'marker', name: markerName });
      index = close + 1;
      continue;
    }

    const spec = parseDataSpecifier(tagContent);
    if (!spec) {
      tokens.push({ kind: 'text', value: text.slice(open, close + 1) });
      index = close + 1;
      continue;
    }

    const valueStart = close + 1;
    const valueEnd = valueStart + spec.length;
    const value = text.slice(valueStart, valueEnd);

    tokens.push({
      kind: 'field',
      ...spec,
      value,
      rawTag: text.slice(open, close + 1),
    });

    index = valueEnd;
  }

  return tokens;
}

function parseUserDefDefinition(value) {
  const source = String(value || '').trim();
  const braceIndex = source.indexOf(',{');
  if (braceIndex === -1) {
    return { fieldName: source, spec: '' };
  }

  return {
    fieldName: source.slice(0, braceIndex).trim(),
    spec: source.slice(braceIndex + 1).trim(),
  };
}

function makeRecord() {
  return {
    fields: {},
    order: [],
  };
}

function setField(record, name, value, options = {}) {
  const normalisedName = normaliseName(name);
  if (!normalisedName) return record;

  const existing = record.fields[normalisedName];
  const nextField = {
    name: options.name || existing?.name || normalisedName,
    value: String(value ?? ''),
    type: options.type ?? existing?.type ?? '',
    source: options.source || existing?.source || 'standard',
  };

  if (!existing) {
    record.order.push(normalisedName);
  }

  record.fields[normalisedName] = nextField;
  return record;
}

function cloneRecord(record) {
  const next = makeRecord();
  next.order = [...(record.order || [])];

  for (const key of next.order) {
    if (record.fields[key]) {
      next.fields[key] = { ...record.fields[key] };
    }
  }

  for (const [key, field] of Object.entries(record.fields || {})) {
    if (!next.fields[key]) {
      next.fields[key] = { ...field };
      next.order.push(key);
    }
  }

  if (record._source) next._source = { ...record._source };
  if (record._manualId) next._manualId = record._manualId;
  if (record._modifiedFields) next._modifiedFields = [...record._modifiedFields];

  return next;
}

function parseAdi(text) {
  const tokens = tokeniseAdi(text);
  const firstHeaderEnd = tokens.findIndex((token) => token.kind === 'marker' && token.name === 'EOH');
  const firstRecordEnd = tokens.findIndex((token) => token.kind === 'marker' && token.name === 'EOR');
  const hasHeader = firstHeaderEnd !== -1 && (firstRecordEnd === -1 || firstHeaderEnd < firstRecordEnd);

  const headerTokens = hasHeader ? tokens.slice(0, firstHeaderEnd) : [];
  const bodyTokens = hasHeader ? tokens.slice(firstHeaderEnd + 1) : tokens;

  const header = {
    text: '',
    fields: [],
    userDefs: [],
    appFieldTypes: {},
  };

  header.text = headerTokens
    .filter((token) => token.kind === 'text')
    .map((token) => token.value)
    .join('');

  headerTokens
    .filter((token) => token.kind === 'field')
    .forEach((token) => {
      header.fields.push({
        name: token.name,
        normalisedName: token.normalisedName,
        value: token.value,
        type: token.type,
      });

      const match = token.normalisedName.match(/^USERDEF(\d+)$/);
      if (match) {
        const definition = parseUserDefDefinition(token.value);
        header.userDefs.push({
          index: Number(match[1]),
          name: definition.fieldName,
          normalisedName: normaliseName(definition.fieldName),
          type: token.type || '',
          spec: definition.spec || '',
        });
      }
    });

  const records = [];
  let current = makeRecord();

  for (const token of bodyTokens) {
    if (token.kind === 'field') {
      const source = token.normalisedName.startsWith('APP_') ? 'application' : 'standard';
      setField(current, token.name, token.value, { type: token.type, name: token.name, source });

      if (source === 'application' && token.type && !header.appFieldTypes[token.normalisedName]) {
        header.appFieldTypes[token.normalisedName] = token.type;
      }
    } else if (token.kind === 'marker' && token.name === 'EOR') {
      if (current.order.length > 0) {
        records.push(current);
      }
      current = makeRecord();
    }
  }

  if (current.order.length > 0) {
    records.push(current);
  }

  return { header, records };
}

function escapeHeaderText(text) {
  return String(text || '').replace(/\r/g, '');
}

function buildDataSpecifier(name, value, type = '') {
  const stringValue = String(value ?? '');
  const prefix = `<${normaliseName(name)}:${stringValue.length}${type ? `:${String(type).toUpperCase()}` : ''}>`;
  return `${prefix}${stringValue}`;
}

function serialiseUserDefs(userDefs) {
  return [...userDefs]
    .sort((a, b) => a.index - b.index)
    .map((def) => {
      const value = def.spec ? `${def.name},${def.spec}` : def.name;
      return buildDataSpecifier(`USERDEF${def.index}`, value, def.type || '');
    });
}

function serialiseHeader(parsed, options = {}) {
  const headerText = escapeHeaderText(options.headerText ?? parsed.header?.text ?? '');
  const existingFields = parsed.header?.fields || [];
  const keepFields = existingFields.filter((field) => {
    const name = field.normalisedName;
    return !['ADIF_VER', 'PROGRAMID', 'PROGRAMVERSION', 'CREATED_TIMESTAMP'].includes(name) && !/^USERDEF\d+$/.test(name);
  });

  const headerParts = [];
  if (headerText) {
    headerParts.push(headerText.trimEnd());
  }

  headerParts.push(buildDataSpecifier('ADIF_VER', options.adifVersion || ADIF_VERSION));
  headerParts.push(buildDataSpecifier('PROGRAMID', options.programId || 'ChipsnCode ADIF Tool'));
  headerParts.push(buildDataSpecifier('PROGRAMVERSION', options.programVersion || '1.0'));

  const timestamp = options.createdTimestamp || makeCreatedTimestamp();
  headerParts.push(buildDataSpecifier('CREATED_TIMESTAMP', timestamp));

  keepFields.forEach((field) => {
    headerParts.push(buildDataSpecifier(field.name, field.value, field.type));
  });

  const userDefs = options.userDefs || parsed.header?.userDefs || [];
  serialiseUserDefs(userDefs).forEach((part) => headerParts.push(part));
  headerParts.push('<EOH>');

  return headerParts.join('\n');
}

function serialiseRecord(record, appFieldTypes = {}) {
  const parts = [];

  record.order.forEach((key) => {
    const field = record.fields[key];
    if (!field) return;

    const type = field.type || appFieldTypes[key] || '';
    parts.push(buildDataSpecifier(field.name || key, field.value, type));
  });

  parts.push('<EOR>');
  return parts.join('');
}

function serialiseAdi(parsed, options = {}) {
  const header = serialiseHeader(parsed, options);
  const appFieldTypes = {
    ...(parsed.header?.appFieldTypes || {}),
    ...(options.appFieldTypes || {}),
  };

  const records = (options.records || parsed.records || []).map((record) => serialiseRecord(record, appFieldTypes));
  return `${header}\n${records.join('\n')}\n`;
}

function makeCreatedTimestamp(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd} ${hh}${min}${ss}`;
}

function toUtcDate(record) {
  const fieldRecord = record.fields ? record.fields : {};
  const dateString = normaliseName(fieldRecord.QSO_DATE?.value || fieldRecord.QSO_DATE_OFF?.value);
  const timeString = normaliseName(fieldRecord.TIME_ON?.value || fieldRecord.TIME_OFF?.value);

  if (!/^\d{8}$/.test(dateString)) return null;

  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(4, 6)) - 1;
  const day = Number(dateString.slice(6, 8));

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (/^\d{6}$/.test(timeString)) {
    hours = Number(timeString.slice(0, 2));
    minutes = Number(timeString.slice(2, 4));
    seconds = Number(timeString.slice(4, 6));
  } else if (/^\d{4}$/.test(timeString)) {
    hours = Number(timeString.slice(0, 2));
    minutes = Number(timeString.slice(2, 4));
  }

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

function deriveBandFromFrequency(freqValue) {
  const frequency = Number(freqValue);
  if (!Number.isFinite(frequency)) return '';

  for (const [label, start, end] of BAND_RANGES) {
    if (frequency >= start && frequency < end) {
      return label;
    }
  }

  return '';
}

function normaliseQso(record) {
  const fields = record.fields || {};
  const dt = toUtcDate(record);
  const band = String(fields.BAND?.value || '').trim().toLowerCase() || deriveBandFromFrequency(fields.FREQ?.value);
  const mode = String(fields.SUBMODE?.value || fields.MODE?.value || '').trim().toUpperCase();

  return {
    record,
    source: record._source?.name || 'Manual entry',
    sourceIndex: record._source?.index ?? -1,
    sourceRecordIndex: record._source?.recordIndex ?? -1,
    dt,
    utc: dt ? formatUtcTime(dt) : '',
    dateRaw: String(fields.QSO_DATE?.value || fields.QSO_DATE_OFF?.value || '').trim(),
    timeRaw: String(fields.TIME_ON?.value || fields.TIME_OFF?.value || '').trim(),
    call: String(fields.CALL?.value || '').trim().toUpperCase(),
    station: String(fields.STATION_CALLSIGN?.value || '').trim().toUpperCase(),
    operator: String(fields.OPERATOR?.value || '').trim().toUpperCase(),
    band,
    mode,
    frequency: String(fields.FREQ?.value || '').trim(),
    rstSent: String(fields.RST_SENT?.value || '').trim(),
    rstReceived: String(fields.RST_RCVD?.value || '').trim(),
    grid: String(fields.GRIDSQUARE?.value || fields.VUCC_GRIDS?.value || '').trim().toUpperCase(),
    myGrid: String(fields.MY_GRIDSQUARE?.value || '').trim().toUpperCase(),
    propagation: String(fields.PROP_MODE?.value || '').trim().toUpperCase(),
    satellite: String(fields.SAT_NAME?.value || '').trim().toUpperCase(),
    satelliteMode: String(fields.SAT_MODE?.value || '').trim().toUpperCase(),
    ref: String(
      fields.SIG_INFO?.value ||
      fields.POTA_REF?.value ||
      fields.SOTA_REF?.value ||
      fields.WWFF_REF?.value ||
      ''
    ).trim(),
    myRef: String(
      fields.MY_SIG_INFO?.value ||
      fields.MY_POTA_REF?.value ||
      fields.MY_SOTA_REF?.value ||
      fields.MY_WWFF_REF?.value ||
      ''
    ).trim(),
  };
}

function recordToObject(record) {
  const object = {};

  (record.order || []).forEach((key) => {
    const field = record.fields[key];
    if (!field) return;
    object[field.name || key] = field.value;
  });

  return object;
}

function makeDuplicateKey(record) {
  const fields = record.fields || {};
  const call = String(fields.CALL?.value || '').trim().toUpperCase();
  const date = String(fields.QSO_DATE?.value || fields.QSO_DATE_OFF?.value || '').trim();
  const time = String(fields.TIME_ON?.value || fields.TIME_OFF?.value || '').trim();
  const band = String(fields.BAND?.value || '').trim().toLowerCase() || deriveBandFromFrequency(fields.FREQ?.value);
  const mode = String(fields.SUBMODE?.value || fields.MODE?.value || '').trim().toUpperCase();
  const station = String(fields.STATION_CALLSIGN?.value || '').trim().toUpperCase();

  if (!call || !date || !time) return '';
  return [station, call, date, time, band, mode].join('|');
}

function makeFuzzyDuplicateKey(record) {
  const fields = record.fields || {};
  const call = String(fields.CALL?.value || '').trim().toUpperCase();
  const date = String(fields.QSO_DATE?.value || fields.QSO_DATE_OFF?.value || '').trim();
  const band = String(fields.BAND?.value || '').trim().toLowerCase() || deriveBandFromFrequency(fields.FREQ?.value);
  const mode = String(fields.SUBMODE?.value || fields.MODE?.value || '').trim().toUpperCase();
  const station = String(fields.STATION_CALLSIGN?.value || '').trim().toUpperCase();

  if (!call || !date) return '';
  return [station, call, date, band, mode].join('|');
}

function groupExactDuplicates(records) {
  const groups = new Map();

  records.forEach((record, index) => {
    const key = makeDuplicateKey(record);
    if (!key) return;
    const entry = groups.get(key) || [];
    entry.push(index);
    groups.set(key, entry);
  });

  const duplicateGroups = [...groups.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([key, indices]) => ({ key, indices }));

  return duplicateGroups;
}

function groupFuzzyDuplicates(records, options = {}) {
  const thresholdMs = Number(options.thresholdMs || 90 * 1000);
  const buckets = new Map();

  records.forEach((record, index) => {
    const key = makeFuzzyDuplicateKey(record);
    if (!key) return;
    const bucket = buckets.get(key) || [];
    bucket.push({
      index,
      time: toUtcDate(record)?.getTime() ?? null,
    });
    buckets.set(key, bucket);
  });

  const duplicateGroups = [];

  for (const [key, entries] of buckets.entries()) {
    if (entries.length < 2) continue;

    entries.sort((a, b) => {
      if (a.time === null && b.time === null) return a.index - b.index;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });

    let current = [];

    for (const entry of entries) {
      if (current.length === 0) {
        current.push(entry);
        continue;
      }

      const previous = current[current.length - 1];
      const canCluster =
        entry.time !== null &&
        previous.time !== null &&
        Math.abs(entry.time - previous.time) <= thresholdMs;

      if (canCluster) {
        current.push(entry);
      } else {
        if (current.length > 1) {
          duplicateGroups.push({ key, indices: current.map((item) => item.index) });
        }
        current = [entry];
      }
    }

    if (current.length > 1) {
      duplicateGroups.push({ key, indices: current.map((item) => item.index) });
    }
  }

  return duplicateGroups;
}

function buildDuplicateResult(duplicateGroups, mode) {
  const duplicateIndexes = new Set(duplicateGroups.flatMap((group) => group.indices));

  return {
    mode,
    groups: duplicateGroups,
    duplicateIndexes,
    duplicateCount: duplicateIndexes.size,
    duplicateGroupCount: duplicateGroups.length,
  };
}

function detectDuplicateRecords(records, options = {}) {
  const mode = options.mode || 'exact';
  const duplicateGroups =
    mode === 'fuzzy'
      ? groupFuzzyDuplicates(records, options)
      : groupExactDuplicates(records);

  return buildDuplicateResult(duplicateGroups, mode);
}

function dedupeRecords(records, strategy = 'keep-first-exact', options = {}) {
  if (strategy === 'keep-all') {
    return records.map((record) => cloneRecord(record));
  }

  const mode = strategy === 'keep-first-fuzzy' ? 'fuzzy' : 'exact';
  const duplicateResult = detectDuplicateRecords(records, { ...options, mode });
  const duplicateIndexes = duplicateResult.duplicateIndexes;
  const firstIndexes = new Set(duplicateResult.groups.map((group) => group.indices[0]));
  const kept = [];

  records.forEach((record, index) => {
    if (!duplicateIndexes.has(index) || firstIndexes.has(index)) {
      kept.push(cloneRecord(record));
    }
  });

  return kept;
}

function validateRecord(record, index = 0) {
  const warnings = [];
  const fields = record.fields || {};
  const call = String(fields.CALL?.value || '').trim();
  const date = String(fields.QSO_DATE?.value || fields.QSO_DATE_OFF?.value || '').trim();
  const time = String(fields.TIME_ON?.value || fields.TIME_OFF?.value || '').trim();
  const mode = String(fields.MODE?.value || fields.SUBMODE?.value || '').trim();
  const band = String(fields.BAND?.value || '').trim().toLowerCase();
  const freq = String(fields.FREQ?.value || '').trim();

  if (!call) {
    warnings.push({ level: 'warning', code: 'missing-call', recordIndex: index, message: `Record ${index + 1} has no CALL field.` });
  }

  if (!date) {
    warnings.push({ level: 'warning', code: 'missing-date', recordIndex: index, message: `Record ${index + 1} has no QSO_DATE.` });
  } else if (!VALID_DATE_PATTERN.test(date)) {
    warnings.push({ level: 'warning', code: 'bad-date', recordIndex: index, message: `Record ${index + 1} has a QSO_DATE that is not YYYYMMDD.` });
  }

  if (!time) {
    warnings.push({ level: 'warning', code: 'missing-time', recordIndex: index, message: `Record ${index + 1} has no TIME_ON or TIME_OFF.` });
  } else if (!VALID_TIME_PATTERN.test(time)) {
    warnings.push({ level: 'warning', code: 'bad-time', recordIndex: index, message: `Record ${index + 1} has a time field that is not HHMM or HHMMSS.` });
  }

  if (!mode) {
    warnings.push({ level: 'warning', code: 'missing-mode', recordIndex: index, message: `Record ${index + 1} has no MODE or SUBMODE.` });
  }

  if (!band && !freq) {
    warnings.push({ level: 'warning', code: 'missing-band', recordIndex: index, message: `Record ${index + 1} has neither BAND nor FREQ.` });
  }

  if (freq && !Number.isFinite(Number(freq))) {
    warnings.push({ level: 'warning', code: 'bad-freq', recordIndex: index, message: `Record ${index + 1} has a FREQ value that is not numeric.` });
  }

  if (band && freq) {
    const derived = deriveBandFromFrequency(freq);
    if (derived && derived !== band) {
      warnings.push({
        level: 'warning',
        code: 'band-mismatch',
        recordIndex: index,
        message: `Record ${index + 1} says ${band} but FREQ looks like ${derived}.`,
      });
    }
  }

  return warnings;
}

function validateParsedAdi(parsed) {
  const warnings = [];

  if (!parsed.header || (!parsed.header.fields?.length && !String(parsed.header.text || '').trim())) {
    warnings.push({
      level: 'info',
      code: 'no-header',
      message: 'No ADIF header was found. That is legal enough in practice, but a proper export usually has one.',
    });
  }

  (parsed.records || []).forEach((record, index) => {
    warnings.push(...validateRecord(record, index));
  });

  return warnings;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function serialiseCsv(records) {
  const headers = [];
  const seen = new Set();

  records.forEach((record) => {
    (record.order || []).forEach((key) => {
      const field = record.fields[key];
      const name = field?.name || key;
      if (seen.has(name)) return;
      seen.add(name);
      headers.push(name);
    });
  });

  const lines = [headers.map(escapeCsv).join(',')];
  records.forEach((record) => {
    const object = recordToObject(record);
    lines.push(headers.map((header) => escapeCsv(object[header] || '')).join(','));
  });
  return `${lines.join('\n')}\n`;
}

function serialiseJson(records) {
  return `${JSON.stringify(records.map((record) => {
    const normalised = normaliseQso(record);
    const { record: _ignored, ...summary } = normalised;
    return {
      ...recordToObject(record),
      _normalised: summary,
    };
  }), null, 2)}\n`;
}

function formatUtcTime(date) {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function applyExportPreset(records, preset, options = {}) {
  return records.map((record) => {
    const next = cloneRecord(record);
    const overwrite = Boolean(options.overwrite);

    const upsert = (name, value, meta = {}) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      const key = normaliseName(name);
      if (!overwrite && next.fields[key]?.value) return;
      setField(next, name, String(value).trim(), meta);
    };

    if (options.stationCallsign) {
      upsert('STATION_CALLSIGN', options.stationCallsign);
    }

    if (options.operator) {
      upsert('OPERATOR', options.operator);
    }

    switch (preset) {
      case 'pota-activator':
        upsert('MY_SIG', 'POTA');
        upsert('MY_SIG_INFO', options.myRef);
        upsert('MY_POTA_REF', options.myRef);
        if (options.contactRef) {
          upsert('SIG', 'POTA');
          upsert('SIG_INFO', options.contactRef);
          upsert('POTA_REF', options.contactRef);
        }
        break;
      case 'pota-hunter':
        upsert('SIG', 'POTA');
        upsert('SIG_INFO', options.contactRef);
        upsert('POTA_REF', options.contactRef);
        break;
      case 'sota-activator':
        upsert('MY_SIG', 'SOTA');
        upsert('MY_SIG_INFO', options.myRef);
        upsert('MY_SOTA_REF', options.myRef);
        if (options.contactRef) {
          upsert('SIG', 'SOTA');
          upsert('SIG_INFO', options.contactRef);
          upsert('SOTA_REF', options.contactRef);
        }
        break;
      case 'sota-chaser':
        upsert('SIG', 'SOTA');
        upsert('SIG_INFO', options.contactRef);
        upsert('SOTA_REF', options.contactRef);
        break;
      default:
        break;
    }

    return next;
  });
}

function mergeParsedFiles(files) {
  const header = {
    text: '',
    fields: [],
    userDefs: [],
    appFieldTypes: {},
  };
  const records = [];
  const seenHeaderFields = new Set();
  const seenUserDefs = new Set();

  files.forEach((parsed, index) => {
    if (!header.text && parsed.header?.text) {
      header.text = parsed.header.text;
    }

    (parsed.header?.fields || []).forEach((field) => {
      const key = `${field.normalisedName}:${field.value}:${field.type || ''}`;
      if (seenHeaderFields.has(key)) return;
      seenHeaderFields.add(key);
      header.fields.push({ ...field });
    });

    (parsed.header?.userDefs || []).forEach((def) => {
      const key = `${def.index}:${def.normalisedName}:${def.spec || ''}:${def.type || ''}`;
      if (seenUserDefs.has(key)) return;
      seenUserDefs.add(key);
      header.userDefs.push({ ...def });
    });

    Object.assign(header.appFieldTypes, parsed.header?.appFieldTypes || {});

    (parsed.records || []).forEach((record, recordIndex) => {
      const cloned = cloneRecord(record);
      cloned._source = {
        name: parsed.source?.name || `File ${index + 1}`,
        size: parsed.source?.size || 0,
        index,
        recordIndex,
      };
      records.push(cloned);
    });
  });

  return { header, records };
}

function makeDownload(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export {
  ADIF_VERSION,
  applyExportPreset,
  cloneRecord,
  dedupeRecords,
  detectDuplicateRecords,
  formatUtcTime,
  makeCreatedTimestamp,
  makeDownload,
  mergeParsedFiles,
  normaliseQso,
  parseAdi,
  recordToObject,
  serialiseAdi,
  serialiseCsv,
  serialiseJson,
  setField,
  toUtcDate,
  validateParsedAdi,
};
