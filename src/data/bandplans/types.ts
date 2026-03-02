export type BandUnit = 'kHz' | 'MHz' | 'GHz';

export type BandMode =
  | 'cw'
  | 'data'
  | 'voice'
  | 'repeater'
  | 'beacon'
  | 'all_modes'
  | 'atv'
  | 'satellite';

export type MarkerKind =
  | 'emergency'
  | 'am_coa'
  | 'digital_coa'
  | 'beacon_coa'
  | 'calling'
  | 'changed';

export type MarkerStatus = 'new' | 'moved' | 'retained' | 'withdrawn';

export interface BandSegment {
  start: number;
  end: number;
  mode: BandMode;
  label?: string;
  notes?: string;
}

export interface BandMarker {
  freq: number;
  kind: MarkerKind;
  label: string;
  status?: MarkerStatus;
  notes?: string;
}

export interface BandPlanVersion {
  id: 'old' | 'new';
  label: string;
  sourceLabel: string;
  segments: BandSegment[];
  markers?: BandMarker[];
}

export interface BandChart {
  id: string;
  label: string;
  unit: BandUnit;
  range: {
    start: number;
    end: number;
  };
  plans: BandPlanVersion[];
  notes?: string[];
}

export interface SourceLink {
  label: string;
  href: string;
}

export interface KeyChange {
  band: string;
  summary: string;
  details: string[];
}

export interface BandPanelSection {
  changed: string[];
  why: string[];
  downsides: string[];
}

export interface BandPanel {
  id: string;
  title: string;
  summary: string;
  badges: string[];
  chartId?: string;
  sections: BandPanelSection;
}
