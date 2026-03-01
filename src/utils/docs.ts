export const DOC_SECTIONS = [
  {
    label: 'Site Meta',
    rank: 10,
    description: 'Design notes, architecture decisions, and internal documentation about the site itself.',
  },
  {
    label: 'SPIMemory',
    rank: 20,
    description: 'Library documentation, integration notes, API references, and migration guides for SPIMemory.',
  },
  {
    label: 'Arduino Notes',
    rank: 30,
    description: 'Embedded implementation notes, hardware-facing snippets, and practical Arduino references.',
  },
  {
    label: 'Platform Guides',
    rank: 40,
    description: 'Setup guides and operating-system-specific notes for machines, tooling, and environments.',
  },
  {
    label: 'Reference',
    rank: 50,
    description: 'Compact cheatsheets and look-up material meant for quick retrieval.',
  },
  {
    label: 'General',
    rank: 999,
    description: 'Fallback bucket for docs that have not been assigned a more specific section yet.',
  },
] as const;

export const DOC_SECTION_LABELS = DOC_SECTIONS.map((section) => section.label);

export const DOC_SECTION_MAP = new Map(
  DOC_SECTIONS.map((section) => [section.label, section]),
);

export function getDocSectionMeta(section?: string | null) {
  return DOC_SECTION_MAP.get(section?.trim() || 'General') ?? DOC_SECTION_MAP.get('General')!;
}
