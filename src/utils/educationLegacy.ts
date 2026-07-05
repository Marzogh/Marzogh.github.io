export const EDUCATION_LEGACY_PAGE_ROUTE_MAP: Record<string, string> = {
  'welcome-to-unit-1-all-about-python': '/education/digital-technologies/year-9/unit-1',
  'get-python-ready-install-thonny': '/education/digital-technologies/year-9/unit-1/setup/install-thonny',
  '2-1-get-python-ready-install-thonny': '/education/digital-technologies/year-9/unit-1/setup/install-thonny',
  'writing-good-code-an-introduction': '/education/digital-technologies/year-9/unit-1/foundations/writing-good-code',
  'explorer-python-basics-hub': '/education/digital-technologies/year-9/unit-1/explorer',
  'chapter-01': '/education/digital-technologies/year-9/unit-1/explorer/chapter-01',
  'chapter-02': '/education/digital-technologies/year-9/unit-1/explorer/chapter-02',
  'chapter-03': '/education/digital-technologies/year-9/unit-1/explorer/chapter-03',
  'chapter-04': '/education/digital-technologies/year-9/unit-1/explorer/chapter-04',
  'chapter-05': '/education/digital-technologies/year-9/unit-1/explorer/chapter-05',
  'chapter-06': '/education/digital-technologies/year-9/unit-1/explorer/chapter-06',
  'chapter-07': '/education/digital-technologies/year-9/unit-1/explorer/chapter-07',
  'chapter-08': '/education/digital-technologies/year-9/unit-1/explorer/chapter-08',
  'chapter-09': '/education/digital-technologies/year-9/unit-1/explorer/chapter-09',
  'chapter-10': '/education/digital-technologies/year-9/unit-1/explorer/chapter-10',
  'python-reference-wiki': '/education/digital-technologies/year-9/unit-1/reference/python-reference',
  'mermaid-live-building-an-algorithm-flow-chart': '/education/digital-technologies/year-9/unit-1/reference/mermaid-live-algorithm-guide',
  'level-1-writing-code-from-zero': '/education/digital-technologies/year-9/unit-1/reference/writing-code-from-zero',
  'pet-services-program-target-audience-and-decision-tree': '/education/digital-technologies/year-9/unit-1/projects/pet-services/decision-tree',
  'pet-services-program-target-audience-decision-tree': '/education/digital-technologies/year-9/unit-1/projects/pet-services/decision-tree',
  'pet-services-program-generating': '/education/digital-technologies/year-9/unit-1/projects/pet-services/generating',
  'pet-services-program-a-worked-solution': '/education/digital-technologies/year-9/unit-1/projects/pet-services/worked-solution',
  'pet-services-program-feedback': '/education/digital-technologies/year-9/unit-1/projects/pet-services/feedback',
  'pet-services-program-what-is-a-function-and-why-does-it-exist': '/education/digital-technologies/year-9/unit-1/projects/pet-services/why-functions-exist',
  'pet-services-program-refactoring-our-pet-booking-system-using-functions': '/education/digital-technologies/year-9/unit-1/projects/pet-services/refactoring-with-functions',
  'welcome-to-unit-2-making-python-interact-with-the-real-world': '/education/digital-technologies/year-9/unit-2',
};

export const EDUCATION_LEGACY_PREFIXES = [
  'digital-technologies-yr9-2026',
  'student-resources/digital-technologies-yr9-2026',
  'student-resources/digital-technologies-year-9-2026/pages',
];

export const EDUCATION_LEGACY_REDIRECTS: Record<string, string> = Object.fromEntries(
  EDUCATION_LEGACY_PREFIXES.flatMap((prefix) =>
    Object.entries(EDUCATION_LEGACY_PAGE_ROUTE_MAP).map(([legacy, target]) => [`${prefix}/${legacy}`, target])
  )
);

EDUCATION_LEGACY_REDIRECTS['digital-technologies/year-9/unit-1/welcome'] = '/education/digital-technologies/year-9/unit-1';
EDUCATION_LEGACY_REDIRECTS['digital-technologies/year-9/unit-2/welcome'] = '/education/digital-technologies/year-9/unit-2';
