const SITE_TIME_ZONE = 'Australia/Brisbane';

function toLocalDateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function isPublishDateReached(date?: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return true;
  }

  return toLocalDateKey(date) <= toLocalDateKey(new Date());
}

export function isPublishedEntryData(data: { draft?: boolean; pubDate?: Date }) {
  if (data.draft) return false;
  return isPublishDateReached(data.pubDate);
}

export { SITE_TIME_ZONE };
