import { useState } from 'react';

type DashboardKey = 'weather' | 'birds';

const DASHBOARDS: Record<
  DashboardKey,
  {
    tabLabel: string;
    title: string;
    href: string;
  }
> = {
  weather: {
    tabLabel: 'Weather',
    title: 'Weather dashboard',
    href: 'https://arkheion.basilisk-piranha.ts.net/grafana-public/d/as9f6v7as098fs96v75as8/chipsncode-weather?kiosk=true',
  },
  birds: {
    tabLabel: 'Birds',
    title: 'Bird activity dashboard',
    href: 'https://arkheion.basilisk-piranha.ts.net/grafana-public/d/897f65e9s7f6va9sd6/chipsncode-birdnet?kiosk=true',
  },
};

export default function LiveSignals() {
  const [activeDashboard, setActiveDashboard] = useState<DashboardKey>('weather');
  const active = DASHBOARDS[activeDashboard];

  return (
    <section className="live-shell">
      <div className="live-shell__tabs" role="tablist" aria-label="Local Signals dashboards">
        {(Object.entries(DASHBOARDS) as [DashboardKey, (typeof DASHBOARDS)[DashboardKey]][]).map(([key, dashboard]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeDashboard === key}
            aria-controls={`live-panel-${key}`}
            id={`live-tab-${key}`}
            className="live-shell__tab"
            onClick={() => setActiveDashboard(key)}
          >
            {dashboard.tabLabel}
          </button>
        ))}
      </div>

      <div
        className="live-shell__stage"
        role="tabpanel"
        id={`live-panel-${activeDashboard}`}
        aria-labelledby={`live-tab-${activeDashboard}`}
      >
        <iframe className="live-shell__frame" title={active.title} src={active.href} loading="lazy" />
      </div>
    </section>
  );
}
