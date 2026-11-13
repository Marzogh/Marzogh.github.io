export interface CatalogueProject {
  id: string;
  title: string;
  description: string;
  href: string;
  action: string;
  image: string;
  cover: 'social' | 'birds' | 'codex' | 'memory';
  typeface: 'atkinson' | 'plex' | 'cinzel' | 'fell' | 'mono';
  about?: string;
  source?: string;
  pubDate?: string;
}

// The page shuffles these entries on each visit, independently of publication date.
export const projectCatalogue: CatalogueProject[] = [
  {
    id: 'nabhastala', title: 'Nabhastala',
    description: 'Astronomy almanacs for three observing horizons.',
    href: '/projects/nabhastala#nabhastala-picker-title', action: 'Choose an almanac',
    image: '/images/projects/nabhastala/nabhastala-social-preview.webp',
    cover: 'social', typeface: 'atkinson', about: '/projects/nabhastala',
  },
  {
    id: 'vishvadrish', title: 'Viśvadṛś',
    description: 'Explore weather-satellite imagery and make time-lapses.',
    href: 'https://chipsncode.com/vishvadrish/', action: 'Open the viewer',
    image: '/images/projects/vishvadrish/vishvadrish-social-banner.webp',
    cover: 'social', typeface: 'plex', pubDate: '2026-11-14',
  },
  {
    id: 'the-birds-they-saw', title: 'The Birds They Saw',
    description: 'Historical bird art, connected to the birds we know today.',
    href: 'https://chipsncode.com/the-birds-they-saw/', action: 'Explore the collection',
    image: '/images/projects/the-birds-they-saw/superb-lyrebird.webp',
    cover: 'birds', typeface: 'cinzel', about: '/projects/the-birds-they-saw',
  },
  {
    id: 'the-living-codex', title: 'The Living Codex',
    description: 'A local-first companion for playing your tabletop character.',
    href: 'https://chipsncode.com/The-Living-Codex/', action: 'Open the companion',
    image: '/images/projects/living-codex/tarakesh-title.png',
    cover: 'codex', typeface: 'fell', about: '/projects/the-living-codex',
    source: 'https://github.com/Marzogh/The-Living-Codex',
  },
  {
    id: 'spimemory', title: 'SPIMemory',
    description: 'An Arduino library for SPI Flash and FRAM.',
    href: 'https://chipsncode.com/SPIMemory/', action: 'Read the documentation',
    image: '/images/projects/spimemory/spimemory-hero.webp',
    cover: 'memory', typeface: 'mono', about: '/projects/spimemory-docs',
    source: 'https://github.com/Marzogh/SPIMemory',
  },
];
