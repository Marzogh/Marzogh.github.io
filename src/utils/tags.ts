export const toTagSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const titleCaseTag = (value: string) =>
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

type TagMeta = {
  label?: string;
  eyebrow?: string;
  description?: string;
  family?: 'radio' | 'general';
  related?: string[];
};

const TAG_META: Record<string, TagMeta> = {
  'amateur-radio': {
    label: 'Amateur Radio',
    eyebrow: 'Radio Content',
    description: 'Portable operating, antennas, field builds, and the practical bits of getting signals off the ground.',
    family: 'radio',
    related: ['ham-radio', 'pota', 'activation-reports', 'portable-ops', 'hf'],
  },
  'ham-radio': {
    label: 'Ham Radio',
    eyebrow: 'Radio Content',
    description: 'Operating notes, station experiments, antenna work, and the gear decisions that make portable radio either fun or annoying.',
    family: 'radio',
    related: ['amateur-radio', 'pota', 'activation-reports', 'hf'],
  },
  pota: {
    label: 'POTA',
    eyebrow: 'Parks On The Air',
    description: 'Field activations, park references, operating notes, and the practical side of making a portable station actually work outdoors.',
    family: 'radio',
    related: ['activation-reports', 'portable-ops', 'amateur-radio', 'marine-park'],
  },
  'activation-reports': {
    label: 'Activation Reports',
    eyebrow: 'Field Reports',
    description: 'Write-ups from real activations: what worked, what broke, and what is worth copying next time.',
    family: 'radio',
    related: ['pota', 'portable-ops', 'amateur-radio', 'field-ops'],
  },
  'portable-ops': {
    label: 'Portable Ops',
    eyebrow: 'Field Operating',
    description: 'Portable station setup, deployment decisions, and the small things that matter once you are away from the shack.',
    family: 'radio',
    related: ['pota', 'activation-reports', 'portable', 'field-ops'],
  },
  hf: {
    label: 'HF',
    eyebrow: 'Radio Bands',
    description: 'HF operating, antennas, propagation, and builds where the ionosphere gets a vote.',
    family: 'radio',
    related: ['40m', 'amateur-radio', 'ham-radio', 'endfed'],
  },
  '40m': {
    label: '40m',
    eyebrow: 'Radio Bands',
    description: '40 metre operating, antennas, and notes from the band that is usually useful and occasionally weird.',
    family: 'radio',
    related: ['hf', 'amateur-radio', 'pota'],
  },
  endfed: {
    label: 'End Fed',
    eyebrow: 'Antenna Builds',
    description: 'End-fed wires, matching networks, deployment choices, and the compromises that make them practical in the field.',
    family: 'radio',
    related: ['hf', 'portable-ops', 'grounding', 'kite'],
  },
  grounding: {
    label: 'Grounding',
    eyebrow: 'RF Practicalities',
    description: 'Ground paths, bleed networks, static handling, and other less glamorous parts of keeping a station civilised.',
    family: 'radio',
    related: ['endfed', 'field-ops', 'portable-ops'],
  },
  'field-ops': {
    label: 'Field Ops',
    eyebrow: 'In The Field',
    description: 'Operating outside, carrying the right gear, and discovering what survives wind, sand, and bad assumptions.',
    family: 'radio',
    related: ['portable-ops', 'activation-reports', 'pota'],
  },
  'marine-park': {
    label: 'Marine Park',
    eyebrow: 'Protected Areas',
    description: 'Operating and documenting work from marine parks and coastal protected areas.',
    family: 'general',
    related: ['pota', 'activation-reports'],
  },
  portable: {
    label: 'Portable',
    eyebrow: 'Portable Work',
    description: 'Gear, setups, and design choices intended to be carried, deployed, and used away from the bench.',
    family: 'general',
    related: ['portable-ops', 'field-ops'],
  },
  kite: {
    label: 'Kite',
    eyebrow: 'Unusual Supports',
    description: 'Kite-supported builds, field experiments, and ideas that only make sense once the wind cooperates.',
    family: 'general',
    related: ['endfed', 'portable-ops', 'activation-reports'],
  },
};

export const getTagMeta = (value: string, fallbackLabel?: string) => {
  const slug = toTagSlug(value);
  const meta = TAG_META[slug] ?? {};

  return {
    slug,
    label: meta.label ?? fallbackLabel ?? titleCaseTag(slug),
    eyebrow: meta.eyebrow ?? 'Tagged Content',
    description: meta.description ?? `Everything currently tagged ${fallbackLabel ?? titleCaseTag(slug)} across Chips’nCode.`,
    family: meta.family ?? 'general',
    related: meta.related ?? [],
  };
};
