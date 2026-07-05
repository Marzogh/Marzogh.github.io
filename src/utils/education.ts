export type EducationRenderMode = 'document' | 'interactive-document';

export interface EducationDownloadTarget {
  label: string;
  url: string;
}

export const EDUCATION_TYPE_LABELS: Record<string, string> = {
  'course-overview': 'Course',
  'unit-overview': 'Unit',
  lesson: 'Lesson',
  chapter: 'Chapter',
  project: 'Project',
  assessment: 'Assessment',
  reference: 'Reference',
  'setup-guide': 'Setup guide',
  worksheet: 'Worksheet',
  'worked-example': 'Worked example',
  'teacher-note': 'Teacher note',
  'interactive-document': 'Interactive',
  guide: 'Guide',
  practical: 'Practical',
  'resource-pack': 'Resource pack',
};

export const EDUCATION_SUBJECT_LABELS: Record<string, string> = {
  'digital-technologies': 'Digital Technologies',
  biology: 'Biology',
  mathematics: 'Mathematics',
  psychology: 'Psychology',
  science: 'Science',
};

export const EDUCATION_AUDIENCE_LABELS: Record<string, string> = {
  student: 'Student facing',
  teacher: 'Teacher facing',
  both: 'Student + teacher',
};

export function titleCaseFromSlug(value?: string | null) {
  if (!value) return '';
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getEducationSubjectLabel(value?: string | null) {
  if (!value) return '';
  return EDUCATION_SUBJECT_LABELS[value] ?? titleCaseFromSlug(value);
}

export function getEducationTypeLabel(value?: string | null) {
  if (!value) return '';
  return EDUCATION_TYPE_LABELS[value] ?? titleCaseFromSlug(value);
}

export function getEducationAudienceLabel(value?: string | null) {
  if (!value) return '';
  return EDUCATION_AUDIENCE_LABELS[value] ?? titleCaseFromSlug(value);
}

export function getEducationLevelLabel(value?: string | null) {
  if (!value) return '';
  if (/^year-\d+$/i.test(value)) {
    return value.replace(/^year-/i, 'Year ');
  }
  return titleCaseFromSlug(value);
}

export function normalizeEducationId(id: string) {
  return id.replace(/\/index$/, '');
}

export function educationPathFromId(id: string) {
  const normalized = normalizeEducationId(id);
  return normalized ? `/education/${normalized}` : '/education';
}

export function toEducationTagSlug(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const SUBJECT_ORDER = ['digital-technologies', 'biology', 'mathematics', 'psychology'];

export function compareEducationSubjects(a: string, b: string) {
  const left = SUBJECT_ORDER.indexOf(a);
  const right = SUBJECT_ORDER.indexOf(b);

  if (left !== -1 || right !== -1) {
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  }

  return getEducationSubjectLabel(a).localeCompare(getEducationSubjectLabel(b));
}

export function buildEducationSubjectNavItems(subjects: string[]) {
  return [...new Set(subjects.filter(Boolean))]
    .sort(compareEducationSubjects)
    .map((subject) => ({
      href: `/education/${subject}`,
      label: getEducationSubjectLabel(subject),
    }));
}
