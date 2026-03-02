import { poetryEntries, type PoetryEntry } from './poetry.generated';

export type PoetryRecord = PoetryEntry & {
  pubDateValue: Date;
};

export function parseLegacyDate(value: string) {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export const poetry: PoetryRecord[] = [...poetryEntries]
  .map((entry) => ({
    ...entry,
    pubDateValue: parseLegacyDate(entry.pubDate),
  }))
  .sort((a, b) => b.pubDateValue.getTime() - a.pubDateValue.getTime());

export const poetryBySlug = new Map(poetry.map((entry) => [entry.slug, entry]));
