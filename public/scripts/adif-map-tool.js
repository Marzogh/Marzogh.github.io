import { mergeParsedFiles, normaliseQso, parseAdi } from '/scripts/adif-core.js';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

const PREFIX_CENTROIDS = [
  [/^VK1/i, { lat: -35.3, lon: 149.1, label: 'VK1 / ACT' }],
  [/^VK2/i, { lat: -32.2, lon: 147.0, label: 'VK2 / NSW' }],
  [/^VK3/i, { lat: -36.8, lon: 144.4, label: 'VK3 / Victoria' }],
  [/^VK4/i, { lat: -22.8, lon: 144.4, label: 'VK4 / Queensland' }],
  [/^VK5/i, { lat: -32.1, lon: 135.7, label: 'VK5 / South Australia' }],
  [/^VK6/i, { lat: -25.6, lon: 122.3, label: 'VK6 / Western Australia' }],
  [/^VK7/i, { lat: -42.0, lon: 146.7, label: 'VK7 / Tasmania' }],
  [/^VK8/i, { lat: -19.5, lon: 133.4, label: 'VK8 / Northern Territory' }],
  [/^ZL/i, { lat: -41.2, lon: 174.7, label: 'ZL / New Zealand' }],
  [/^JA/i, { lat: 36.2, lon: 138.3, label: 'JA / Japan' }],
  [/^(?:F|TM|TK)/i, { lat: 46.4, lon: 2.4, label: 'France' }],
  [/^(?:G|M|2E)/i, { lat: 54.0, lon: -2.8, label: 'United Kingdom' }],
  [/^DL/i, { lat: 51.0, lon: 10.4, label: 'Germany' }],
  [/^(?:K|N|W)[0-9]/i, { lat: 39.8, lon: -98.6, label: 'United States' }],
  [/^VE/i, { lat: 56.1, lon: -106.3, label: 'Canada' }],
];

const REGION_CENTROIDS = {
  AU: { lat: -25.3, lon: 133.8, label: 'Australia' },
  VKFF: { lat: -25.3, lon: 133.8, label: 'Australia (VKFF/POTA)' },
  VK: { lat: -25.3, lon: 133.8, label: 'Australia' },
  ZL: { lat: -41.2, lon: 174.7, label: 'New Zealand' },
  JA: { lat: 36.2, lon: 138.3, label: 'Japan' },
  F: { lat: 46.4, lon: 2.4, label: 'France' },
  G: { lat: 54.0, lon: -2.8, label: 'United Kingdom' },
  K: { lat: 39.8, lon: -98.6, label: 'United States' },
  W: { lat: 39.8, lon: -98.6, label: 'United States' },
  VE: { lat: 56.1, lon: -106.3, label: 'Canada' },
};

const DXCC_CENTROIDS = {
  150: { lat: -25.3, lon: 133.8, label: 'Australia' },
  170: { lat: -41.2, lon: 174.7, label: 'New Zealand' },
  227: { lat: 46.4, lon: 2.4, label: 'France' },
  291: { lat: 39.8, lon: -98.6, label: 'United States' },
};

const safeUpper = (value) => String(value || '').trim().toUpperCase();

let leafletPromise;

function filePill(container, files) {
  if (!container) return;
  container.innerHTML = '';
  if (!files.length) {
    container.hidden = true;
    return;
  }

  files.forEach((file) => {
    const pill = document.createElement('span');
    pill.className = 'mapFilePill';
    pill.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
    container.appendChild(pill);
  });

  container.hidden = false;
}

function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L), { once: true });
      existing.addEventListener('error', () => reject(new Error('Leaflet failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.crossOrigin = '';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Leaflet failed to load.'));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

function maidenheadToLatLon(grid) {
  const clean = safeUpper(grid).replace(/[^A-Z0-9]/g, '');
  if (!/^[A-R]{2}\d{2}([A-X]{2})?([0-9]{2})?$/.test(clean)) return null;

  let lon = -180;
  let lat = -90;

  lon += (clean.charCodeAt(0) - 65) * 20;
  lat += (clean.charCodeAt(1) - 65) * 10;
  lon += Number(clean[2]) * 2;
  lat += Number(clean[3]) * 1;

  let lonSize = 2;
  let latSize = 1;

  if (clean.length >= 6) {
    lon += (clean.charCodeAt(4) - 65) * (5 / 60);
    lat += (clean.charCodeAt(5) - 65) * (2.5 / 60);
    lonSize = 5 / 60;
    latSize = 2.5 / 60;
  }

  if (clean.length >= 8) {
    lon += Number(clean[6]) * (0.5 / 60);
    lat += Number(clean[7]) * (0.25 / 60);
    lonSize = 0.5 / 60;
    latSize = 0.25 / 60;
  }

  return {
    lat: lat + latSize / 2,
    lon: lon + lonSize / 2,
  };
}

function getField(record, ...names) {
  const fields = record.record?.fields || record.fields || {};
  for (const name of names) {
    const value = fields[safeUpper(name)]?.value;
    if (value) return String(value).trim();
  }
  return '';
}

function resolveFromGrid(qso) {
  const grid = qso.grid || '';
  if (!grid) return null;
  const point = maidenheadToLatLon(grid);
  if (!point) return null;
  return {
    lat: point.lat,
    lon: point.lon,
    source: 'grid square',
    confidence: 'high',
    clue: grid,
  };
}

function resolveFromReference(qso) {
  const refs = [
    getField(qso.record, 'POTA_REF'),
    getField(qso.record, 'SOTA_REF'),
    getField(qso.record, 'SIG_INFO'),
    getField(qso.record, 'WWFF_REF'),
  ].filter(Boolean);

  for (const ref of refs) {
    const upper = safeUpper(ref);
    const sotaMatch = upper.match(/^([A-Z0-9/]+)-\d+$/);
    const potaMatch = upper.match(/^([A-Z0-9]+)-\d+$/);
    const prefix = sotaMatch?.[1] || potaMatch?.[1] || '';

    const candidates = [prefix, prefix.split('/')[0], prefix.match(/^(VK[1-8])/i)?.[1] || ''].filter(Boolean);

    for (const candidate of candidates) {
      const point = REGION_CENTROIDS[candidate];
      if (!point) continue;
      return {
        lat: point.lat,
        lon: point.lon,
        source: 'reference',
        confidence: 'medium',
        clue: ref,
      };
    }
  }

  return null;
}

function resolveFromCallsign(qso) {
  const call = qso.call || '';
  if (!call) return null;

  for (const [pattern, point] of PREFIX_CENTROIDS) {
    if (pattern.test(call)) {
      return {
        lat: point.lat,
        lon: point.lon,
        source: 'callsign',
        confidence: 'low',
        clue: call,
      };
    }
  }

  return null;
}

function resolveFromDxcc(qso) {
  const dxcc = Number(getField(qso.record, 'DXCC'));
  if (!Number.isFinite(dxcc)) return null;
  const point = DXCC_CENTROIDS[dxcc];
  if (!point) return null;
  return {
    lat: point.lat,
    lon: point.lon,
    source: 'dxcc region',
    confidence: 'low',
    clue: `DXCC ${dxcc}`,
  };
}

function resolvePoint(qso) {
  return resolveFromGrid(qso) || resolveFromReference(qso) || resolveFromCallsign(qso) || resolveFromDxcc(qso);
}

function parseAdifCoordinate(value, axis) {
  const source = String(value || '').trim().toUpperCase();
  if (!source) return null;

  const decimal = Number(source);
  if (Number.isFinite(decimal)) return decimal;

  const compact = source.replace(/[^\dNSEW+\-. ]/g, ' ').replace(/\s+/g, ' ').trim();
  const hemiMatch = compact.match(/^([NSEW])\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)$/);
  if (hemiMatch) {
    const [, hemi, degreesRaw, minutesRaw] = hemiMatch;
    const degrees = Number(degreesRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(degrees) || !Number.isFinite(minutes)) return null;
    const sign = hemi === 'S' || hemi === 'W' ? -1 : 1;
    return sign * (degrees + minutes / 60);
  }

  const signedMatch = compact.match(/^([+-]?\d+(?:\.\d+)?)$/);
  if (signedMatch) return Number(signedMatch[1]);

  if (axis === 'lat') {
    const alt = compact.match(/^([NS])\s*(\d{2})(\d{2}\.\d+)$/);
    if (alt) {
      const sign = alt[1] === 'S' ? -1 : 1;
      return sign * (Number(alt[2]) + Number(alt[3]) / 60);
    }
  }

  if (axis === 'lon') {
    const alt = compact.match(/^([EW])\s*(\d{3})(\d{2}\.\d+)$/);
    if (alt) {
      const sign = alt[1] === 'W' ? -1 : 1;
      return sign * (Number(alt[2]) + Number(alt[3]) / 60);
    }
  }

  return null;
}

function resolveOrigin(qso) {
  const lat = parseAdifCoordinate(getField(qso.record, 'MY_LAT', 'STATION_LAT'), 'lat');
  const lon = parseAdifCoordinate(getField(qso.record, 'MY_LON', 'STATION_LON'), 'lon');
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      lat,
      lon,
      source: 'station coordinates',
      clue: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    };
  }

  const stationGrid = getField(qso.record, 'MY_GRIDSQUARE', 'STATION_GRIDSQUARE');
  if (stationGrid) {
    const point = maidenheadToLatLon(stationGrid);
    if (point) {
      return {
        lat: point.lat,
        lon: point.lon,
        source: 'station grid square',
        clue: stationGrid,
      };
    }
  }

  const refs = [
    getField(qso.record, 'MY_POTA_REF'),
    getField(qso.record, 'MY_SOTA_REF'),
    getField(qso.record, 'MY_SIG_INFO'),
  ].filter(Boolean);

  for (const ref of refs) {
    const upper = safeUpper(ref);
    const match = upper.match(/^([A-Z0-9/]+)-\d+$/);
    const prefix = match?.[1] || '';
    const candidates = [prefix, prefix.split('/')[0], prefix.match(/^(VK[1-8])/i)?.[1] || ''].filter(Boolean);
    for (const candidate of candidates) {
      const point = REGION_CENTROIDS[candidate];
      if (!point) continue;
      return {
        lat: point.lat,
        lon: point.lon,
        source: 'station reference',
        clue: ref,
      };
    }
  }

  return null;
}

function makeKml(points) {
  const placemarks = points
    .map(
      (point) => `
    <Placemark>
      <name>${escapeXml(point.call || point.clue || 'QSO')}</name>
      <description>${escapeXml(`${point.source} • ${point.confidence} • ${point.clue || ''}`)}</description>
      <Point>
        <coordinates>${point.lon},${point.lat},0</coordinates>
      </Point>
    </Placemark>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ADIF Contact Footprint</name>
    ${placemarks}
  </Document>
</kml>
`;
}

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderResolvedTable(tbody, points) {
  if (!tbody) return;
  tbody.innerHTML = '';
  const slice = points.slice(0, 40);
  slice.forEach((point) => {
    const row = document.createElement('tr');
    row.innerHTML =
      `<td>${point.call || '—'}</td>` +
      `<td>${point.band || '—'}</td>` +
      `<td>${point.source}</td>` +
      `<td>${point.confidence}</td>` +
      `<td>${point.locator || point.clue || '—'}</td>` +
      `<td>${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}</td>`;
    tbody.appendChild(row);
  });
}

function renderUnresolved(list, rows) {
  if (!list) return;
  list.innerHTML = '';
  const slice = rows.slice(0, 20);
  if (!slice.length) {
    const item = document.createElement('li');
    item.textContent = 'Everything that could be placed, was.';
    list.appendChild(item);
    return;
  }
  slice.forEach((row) => {
    const item = document.createElement('li');
    item.textContent = `${row.call || 'Unknown call'} on ${row.band || 'unknown band'} had no grid, usable ref, or sensible regional clue.`;
    list.appendChild(item);
  });
}

async function parseFiles(files) {
  const fileTexts = await Promise.all(
    files.map(async (file) => ({
      file,
      text: await file.text(),
    }))
  );

  const parsedFiles = fileTexts.map(({ text }) => parseAdi(text));
  const merged = mergeParsedFiles(parsedFiles);

  return merged.records
    .map((record) => normaliseQso(record))
    .filter((row) => row.call || row.dt)
    .sort((left, right) => {
      if (!left.dt && !right.dt) return 0;
      if (!left.dt) return 1;
      if (!right.dt) return -1;
      return left.dt - right.dt;
    });
}

async function createLeafletMap(host) {
  const L = await ensureLeaflet();
  const map = L.map(host, {
    worldCopyJump: true,
    zoomControl: true,
    minZoom: 2,
  }).setView([18, 133], 2);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: LEAFLET_ATTRIBUTION,
    maxZoom: 19,
  }).addTo(map);

  const arcLayer = L.layerGroup().addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  const originLayer = L.layerGroup().addTo(map);
  return { L, map, arcLayer, markerLayer, originLayer };
}

function buildArcLatLngs(start, end) {
  const startLon = start.lon;
  let endLon = end.lon;
  let deltaLon = endLon - startLon;
  if (Math.abs(deltaLon) > 180) {
    endLon += deltaLon > 0 ? -360 : 360;
    deltaLon = endLon - startLon;
  }

  const deltaLat = end.lat - start.lat;
  const approxDistance = Math.hypot(deltaLat, deltaLon * Math.cos(((start.lat + end.lat) / 2) * Math.PI / 180));
  const lift = Math.min(18, Math.max(3, approxDistance * 0.12));
  const points = [];

  for (let step = 0; step <= 24; step += 1) {
    const t = step / 24;
    const lon = startLon + deltaLon * t;
    const lat = start.lat + deltaLat * t + Math.sin(Math.PI * t) * lift;
    const wrappedLon = ((lon + 540) % 360) - 180;
    points.push([lat, wrappedLon]);
  }

  return points;
}

function plotPointsOnMap(mapState, points) {
  if (!mapState) return;
  const { L, map, arcLayer, markerLayer, originLayer } = mapState;

  arcLayer.clearLayers();
  markerLayer.clearLayers();
  originLayer.clearLayers();
  if (!points.length) {
    map.setView([18, 133], 2);
    return;
  }

  const bounds = [];
  const seenOrigins = new Set();

  points.forEach((point) => {
    const latLng = [point.lat, point.lon];
    bounds.push(latLng);

    const strong = point.confidence === 'high';
    const marker = L.circleMarker(latLng, {
      radius: strong ? 6 : point.confidence === 'medium' ? 7 : 8,
      color: strong ? '#2563eb' : point.confidence === 'medium' ? '#ec4899' : '#f59e0b',
      weight: strong ? 1.5 : 2,
      fillColor: strong ? '#2563eb' : point.confidence === 'medium' ? '#f472b6' : '#fbbf24',
      fillOpacity: strong ? 0.75 : point.confidence === 'medium' ? 0.28 : 0.18,
    });

    marker.bindPopup(
      `<strong>${escapeXml(point.call || 'QSO')}</strong><br>` +
        `${escapeXml(point.band || 'Unknown band')}<br>` +
        `${escapeXml(point.source)} • ${escapeXml(point.confidence)}<br>` +
        `${escapeXml(point.clue || 'No clue recorded')}`
    );

    marker.addTo(markerLayer);

    if (point.origin) {
      bounds.push([point.origin.lat, point.origin.lon]);

      L.polyline(buildArcLatLngs(point.origin, point), {
        color: strong ? 'rgba(37, 99, 235, 0.42)' : 'rgba(244, 114, 182, 0.38)',
        weight: strong ? 2 : 1.6,
        opacity: 0.95,
        smoothFactor: 1,
        interactive: false,
      }).addTo(arcLayer);

      const key = `${point.origin.lat.toFixed(4)},${point.origin.lon.toFixed(4)}`;
      if (!seenOrigins.has(key)) {
        seenOrigins.add(key);
        L.circleMarker([point.origin.lat, point.origin.lon], {
          radius: 7,
          color: '#14532d',
          weight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.82,
        })
          .bindPopup(
            `<strong>Log origin</strong><br>` +
              `${escapeXml(point.origin.source)}<br>` +
              `${escapeXml(point.origin.clue || '')}`
          )
          .addTo(originLayer);
      }
    }
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 7);
  } else {
    map.fitBounds(bounds, { padding: [32, 32] });
  }
}

function bindFullscreen(button, frame, mapState) {
  if (!button || !frame) return;

  const syncLabel = () => {
    const active = document.fullscreenElement === frame;
    button.textContent = active ? 'Leave fullscreen' : 'Go fullscreen';
  };

  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else {
        await frame.requestFullscreen();
      }
    } catch (error) {
      console.error(error);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    syncLabel();
    setTimeout(() => mapState?.map.invalidateSize(), 80);
  });

  syncLabel();
}

function initTool(root) {
  const input = root.querySelector('[data-adif-map-input]');
  const dropzone = root.querySelector('[data-adif-map-dropzone]');
  const status = root.querySelector('[data-adif-map-status]');
  const fileList = root.querySelector('[data-adif-map-files]');
  const empty = root.querySelector('[data-adif-map-empty]');
  const results = root.querySelector('[data-adif-map-results]');
  const mapHost = root.querySelector('[data-adif-map-host]');
  const mapFrame = root.querySelector('[data-adif-map-frame]');
  const meta = root.querySelector('[data-adif-map-meta]');
  const table = root.querySelector('[data-adif-map-table]');
  const unresolved = root.querySelector('[data-adif-map-unresolved]');
  const exportStatus = root.querySelector('[data-adif-map-export-status]');
  const fullscreenButton = root.querySelector('[data-map-fullscreen]');
  const kpi = (key) => root.querySelector(`[data-map-kpi="${key}"]`);

  let resolvedPoints = [];
  let unresolvedRows = [];
  let mapStatePromise;
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const ensureMap = async () => {
    if (!mapHost) return null;
    if (!mapStatePromise) {
      mapStatePromise = createLeafletMap(mapHost);
      const mapState = await mapStatePromise;
      bindFullscreen(fullscreenButton, mapFrame, mapState);
      return mapState;
    }
    return mapStatePromise;
  };

  const refresh = async (rows, files) => {
    resolvedPoints = [];
    unresolvedRows = [];

    results.hidden = false;
    empty.hidden = true;

    rows.forEach((row) => {
      const point = resolvePoint(row);
      if (point) {
        resolvedPoints.push({
          ...point,
          call: row.call,
          band: row.band,
          utc: row.utc,
          locator: row.grid || point.clue || '',
          origin: resolveOrigin(row),
        });
      } else {
        unresolvedRows.push(row);
      }
    });

    if (kpi('total')) kpi('total').textContent = String(rows.length);
    if (kpi('resolved')) kpi('resolved').textContent = String(resolvedPoints.length);
    if (kpi('unresolved')) kpi('unresolved').textContent = String(unresolvedRows.length);
    if (kpi('grid')) kpi('grid').textContent = String(resolvedPoints.filter((p) => p.source === 'grid square').length);
    if (kpi('reference')) kpi('reference').textContent = String(resolvedPoints.filter((p) => p.source === 'reference').length);
    if (kpi('callsign')) {
      kpi('callsign').textContent = String(
        resolvedPoints.filter((p) => p.source !== 'grid square' && p.source !== 'reference').length
      );
    }

    const mapState = await ensureMap();
    await nextFrame();
    mapState?.map.invalidateSize();
    plotPointsOnMap(mapState, resolvedPoints);
    renderResolvedTable(table, resolvedPoints);
    renderUnresolved(unresolved, unresolvedRows);

    if (meta) {
      const pathCount = resolvedPoints.filter((point) => point.origin).length;
      meta.textContent = `${resolvedPoints.length} mapped point${resolvedPoints.length === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}, with ${pathCount} path${pathCount === 1 ? '' : 's'} drawn back to the log origin. Screenshot away if you want an image; the map attribution stays visible.`;
    }
    setStatus(`Mapped ${resolvedPoints.length} of ${rows.length} QSO${rows.length === 1 ? '' : 's'}.`);
  };

  const handleFiles = async (fileListLike) => {
    const files = [...fileListLike].filter((file) => /\.(adi|adif)$/i.test(file.name));
    filePill(fileList, files);

    if (!files.length) {
      setStatus('Those do not look like ADIF files.');
      return;
    }

    setStatus(`Reading ${files.length} file${files.length === 1 ? '' : 's'}...`);

    try {
      const rows = await parseFiles(files);
      if (!rows.length) {
        setStatus('No QSO records turned up in those files.');
        return;
      }
      await refresh(rows, files);
    } catch (error) {
      console.error(error);
      setStatus('The parser or map loader tripped over something unpleasant while reading the ADIF.');
    }
  };

  root.querySelectorAll('[data-map-export]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!resolvedPoints.length) return;
      download(
        'adif-contact-footprint.kml',
        makeKml(resolvedPoints),
        'application/vnd.google-earth.kml+xml;charset=utf-8'
      );
      if (exportStatus) exportStatus.textContent = 'Downloaded adif-contact-footprint.kml';
    });
  });

  input?.addEventListener('change', (event) => {
    const files = event.target?.files;
    if (files) handleFiles(files);
  });

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
}

function init() {
  document.querySelectorAll('[data-adif-map-tool]').forEach(initTool);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
