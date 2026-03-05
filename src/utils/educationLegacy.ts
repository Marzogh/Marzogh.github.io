export const EDUCATION_LEGACY_PAGE_ROUTE_MAP: Record<string, string> = {
  'welcome-to-unit-1-all-about-python': '/education/year-9-python-foundations',
  'get-python-ready-install-thonny': '/education/install-python-with-thonny',
  'writing-good-code-an-introduction': '/education/writing-good-code',
  'explorer-python-basics-hub': '/education/python-basics-hub',
  'chapter-01': '/education/python-basics-hub/chapter-1-your-first-python-mission',
  'chapter-02': '/education/python-basics-hub/chapter-2-printing-and-running-code',
  'chapter-03': '/education/python-basics-hub/chapter-3-variables',
  'chapter-04': '/education/python-basics-hub/chapter-4-data-types',
  'chapter-05': '/education/python-basics-hub/chapter-5-input',
  'chapter-06': '/education/python-basics-hub/chapter-6-if-statements',
  'chapter-07': '/education/python-basics-hub/chapter-7-loops',
  'chapter-08': '/education/python-basics-hub/chapter-8-lists',
  'chapter-09': '/education/python-basics-hub/chapter-9-functions',
  'chapter-10': '/education/python-basics-hub/chapter-10-debugging-and-errors',
  'python-reference-wiki': '/education/python-reference',
  'mermaid-live-building-an-algorithm-flow-chart': '/education/algorithms-with-mermaid',
  'level-1-writing-code-from-zero': '/education/year-9-python-foundations/writing-code-from-zero',
  'pet-services-program-target-audience-and-decision-tree': '/education/pet-services-project/planning-and-decision-tree',
  'pet-services-program-generating': '/education/pet-services-project/build-the-booking-program',
  'pet-services-program-a-worked-solution': '/education/pet-services-project/worked-solution',
  'pet-services-program-feedback': '/education/pet-services-project/feedback-and-improvement',
  'pet-services-program-what-is-a-function-and-why-does-it-exist': '/education/pet-services-project/why-functions-matter',
  'pet-services-program-refactoring-our-pet-booking-system-using-functions': '/education/pet-services-project/refactoring-with-functions',
};

export const EDUCATION_LEGACY_PREFIXES = [
  'digital-technologies-yr9-2026',
  'student-resources/digital-technologies-yr9-2026',
];

export const EDUCATION_LEGACY_REDIRECTS: Record<string, string> = Object.fromEntries(
  EDUCATION_LEGACY_PREFIXES.flatMap((prefix) =>
    Object.entries(EDUCATION_LEGACY_PAGE_ROUTE_MAP).map(([legacy, target]) => [`${prefix}/${legacy}`, target])
  )
);
