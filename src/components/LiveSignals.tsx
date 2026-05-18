import { useEffect, useState } from 'react';

type WeatherData = {
  updated?: string;
  temperature_c?: number | null;
  humidity_percent?: number | null;
  pressure_hpa?: number | null;
  wind_speed_kph?: number | null;
  wind_gust_kph?: number | null;
  wind_direction_degrees?: number | null;
  rain_today_mm?: number | null;
  rain_rate_mm_per_hour?: number | null;
};

type BirdDetection = {
  id?: number;
  timestamp?: string;
  common_name?: string;
  scientific_name?: string;
  confidence_percent?: number | null;
  source_label?: string | null;
};

type TopSpecies = {
  common_name?: string;
  scientific_name?: string;
  count?: number;
  max_confidence_percent?: number | null;
};

type BirdData = {
  updated?: string;
  today_total_detections?: number;
  today_species_count?: number;
  database_total_detections?: number;
  latest_detection_time?: string;
  top_detection_today?: {
    common_name?: string;
    scientific_name?: string;
    confidence_percent?: number | null;
    timestamp?: string;
  };
  top_species_today?: TopSpecies[];
  latest_detections?: BirdDetection[];
  location?: {
    display_name?: string;
    map_point?: {
      latitude?: number;
      longitude?: number;
    };
    public_safety_note?: string;
  };
  privacy_note?: string;
};

type Freshness = 'Live-ish' | 'Stale' | 'Unavailable';

const WEATHER_URL = 'https://data.chipsncode.com/weather.json';
const BIRDS_URL = 'https://data.chipsncode.com/birds.json';

function getUnavailableMessage(kind: 'weather' | 'birds'): string {
  const base =
    kind === 'weather'
      ? 'Weather data is temporarily unavailable.'
      : 'Bird detection data is temporarily unavailable.';

  if (typeof window === 'undefined') return base;

  const host = window.location.hostname;
  const isLocalPreview = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (isLocalPreview) {
    return `${base} Local preview is blocked by CORS: data.chipsncode.com currently allows https://chipsncode.com only.`;
  }

  return base;
}

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { cache: 'no-store' }).then((res) => {
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    return res.json() as Promise<T>;
  });
}

function formatDateTime(value?: string): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatTime(value?: string): string {
  if (!value) return 'Unknown';
  const direct = new Date(value);
  if (!Number.isNaN(direct.valueOf())) {
    return direct.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Brisbane',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const localish = new Date(`${value}+10:00`);
  if (!Number.isNaN(localish.valueOf())) {
    return localish.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Brisbane',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return value;
}

function formatNumber(value?: number | null, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatOptional(value?: number | null, suffix = '', digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, digits)}${suffix}`;
}

function formatWhole(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-AU').format(value);
}

function getFreshness(updated?: string, maxAgeMinutes = 45): Freshness {
  if (!updated) return 'Unavailable';
  const time = new Date(updated).valueOf();
  if (!Number.isFinite(time)) return 'Unavailable';
  const ageMs = Date.now() - time;
  return ageMs <= maxAgeMinutes * 60_000 ? 'Live-ish' : 'Stale';
}

function confidencePercent(value?: number | null): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export default function LiveSignals() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [birds, setBirds] = useState<BirdData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [birdLoading, setBirdLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [birdError, setBirdError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchJson<WeatherData>(WEATHER_URL)
      .then((data) => {
        if (!active) return;
        setWeather(data);
      })
      .catch(() => {
        if (!active) return;
        setWeatherError(getUnavailableMessage('weather'));
      })
      .finally(() => {
        if (!active) return;
        setWeatherLoading(false);
      });

    fetchJson<BirdData>(BIRDS_URL)
      .then((data) => {
        if (!active) return;
        setBirds(data);
      })
      .catch(() => {
        if (!active) return;
        setBirdError(getUnavailableMessage('birds'));
      })
      .finally(() => {
        if (!active) return;
        setBirdLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const weatherFreshness = weatherError ? 'Unavailable' : getFreshness(weather?.updated, 45);
  const birdFreshness = birdError ? 'Unavailable' : getFreshness(birds?.updated, 90);

  const mapPoint = birds?.location?.map_point;
  const lat = mapPoint?.latitude;
  const lon = mapPoint?.longitude;
  const hasMapPoint = Number.isFinite(lat) && Number.isFinite(lon);

  const statusClass = (freshness: Freshness) =>
    freshness === 'Live-ish'
      ? 'live-signals__status live-signals__status--ok'
      : freshness === 'Stale'
        ? 'live-signals__status live-signals__status--stale'
        : 'live-signals__status live-signals__status--bad';

  return (
    <div className="live-signals">
      <section className="panel live-signals__card live-signals__card--weather">
        <div className="live-signals__card-header">
          <h2>Backyard weather</h2>
          <span className={statusClass(weatherFreshness)}>{weatherFreshness}</span>
        </div>

        {weatherLoading ? (
          <p>Loading weather data...</p>
        ) : weatherError ? (
          <p>{weatherError}</p>
        ) : (
          <>
            <dl className="live-signals__stats">
              <div><dt>Temperature</dt><dd>{formatOptional(weather?.temperature_c, ' °C', 1)}</dd></div>
              <div><dt>Humidity</dt><dd>{formatOptional(weather?.humidity_percent, '%', 0)}</dd></div>
              <div><dt>Pressure</dt><dd>{formatOptional(weather?.pressure_hpa, ' hPa', 1)}</dd></div>
              <div><dt>Wind speed</dt><dd>{formatOptional(weather?.wind_speed_kph, ' km/h', 1)}</dd></div>
              <div><dt>Wind gust</dt><dd>{formatOptional(weather?.wind_gust_kph, ' km/h', 1)}</dd></div>
              <div><dt>Wind direction</dt><dd>{formatOptional(weather?.wind_direction_degrees, '°', 0)}</dd></div>
              <div><dt>Rain today</dt><dd>{formatOptional(weather?.rain_today_mm, ' mm', 1)}</dd></div>
              <div><dt>Rain rate</dt><dd>{formatOptional(weather?.rain_rate_mm_per_hour, ' mm/h', 1)}</dd></div>
            </dl>
            <p className="live-signals__updated">Last updated: {formatDateTime(weather?.updated)}</p>
          </>
        )}
      </section>

      <section className="panel live-signals__card live-signals__card--birds">
        <div className="live-signals__card-header">
          <h2>Bird activity</h2>
          <span className={statusClass(birdFreshness)}>{birdFreshness}</span>
        </div>

        {birdLoading ? (
          <p>Loading bird detections...</p>
        ) : birdError ? (
          <p>{birdError}</p>
        ) : (
          <>
            <dl className="live-signals__stats">
              <div><dt>Detections today</dt><dd>{formatWhole(birds?.today_total_detections)}</dd></div>
              <div><dt>Species today</dt><dd>{formatWhole(birds?.today_species_count)}</dd></div>
              <div><dt>Database detections</dt><dd>{formatWhole(birds?.database_total_detections)}</dd></div>
              <div>
                <dt>Top detection today</dt>
                <dd>
                  {birds?.top_detection_today?.common_name ?? '—'}
                  {birds?.top_detection_today?.confidence_percent !== undefined
                    ? ` (${formatNumber(birds.top_detection_today.confidence_percent, 1)}%)`
                    : ''}
                </dd>
              </div>
              <div><dt>Latest detection time</dt><dd>{formatTime(birds?.latest_detection_time)}</dd></div>
            </dl>
            <p className="live-signals__updated">Last updated: {formatDateTime(birds?.updated)}</p>
          </>
        )}
      </section>

      {!birdLoading && !birdError && (
        <section className="panel live-signals__card live-signals__card--species">
          <h2>Top species today</h2>
          {birds?.top_species_today?.length ? (
            <ul className="live-signals__species-list">
              {birds.top_species_today.map((species, idx) => {
                const score = confidencePercent(species.max_confidence_percent);
                return (
                  <li key={`${species.common_name ?? 'species'}-${idx}`} className="live-signals__species-item">
                    <div className="live-signals__species-head">
                      <strong>{species.common_name ?? 'Unknown'}</strong>
                      <span>{formatWhole(species.count)} detections</span>
                    </div>
                    <p><em>{species.scientific_name ?? 'Unknown'}</em></p>
                    <div className="live-signals__meter" aria-hidden="true">
                      <span style={{ width: `${score}%` }} />
                    </div>
                    <p className="live-signals__meter-label">Max confidence: {formatOptional(species.max_confidence_percent, '%', 1)}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No species detections available yet.</p>
          )}
        </section>
      )}

      {!birdLoading && !birdError && (
        <section className="panel live-signals__card live-signals__card--detections">
          <h2>Latest detections</h2>
          {birds?.latest_detections?.length ? (
            <ul className="live-signals__detections">
              {birds.latest_detections.slice(0, 10).map((entry, idx) => (
                <li key={`${entry.id ?? 'detection'}-${idx}`}>
                  <strong>{formatTime(entry.timestamp)}</strong>
                  <span>{entry.common_name ?? 'Unknown'} <em>({entry.scientific_name ?? 'Unknown'})</em></span>
                  <span>{formatOptional(entry.confidence_percent, '%', 1)}</span>
                  {entry.source_label ? <span className="live-signals__source">Source: {entry.source_label}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>No recent detections listed.</p>
          )}
        </section>
      )}

      {!birdLoading && !birdError && (
        <section className="panel live-signals__card live-signals__card--location live-signals__location">
          <h2>Approximate location</h2>
          <p>{birds?.location?.display_name ?? 'Location unavailable'}</p>
          {hasMapPoint ? (
            <p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View approximate map point on OpenStreetMap
              </a>
            </p>
          ) : null}
          <p className="live-signals__privacy">
            {birds?.location?.public_safety_note ?? birds?.privacy_note ?? 'Location is intentionally blurred for privacy.'}
          </p>
        </section>
      )}
    </div>
  );
}
