export const REQUIRED_HASHTAG = '#Boxed2Built';

export function parseHashtagsInput(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of value.split(/[\s,]+/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const tag = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  if (!seen.has(REQUIRED_HASHTAG.toLowerCase())) {
    tags.push(REQUIRED_HASHTAG);
  }

  return tags;
}

export function formatHashtagsForInput(hashtags?: string[] | null): string {
  return (hashtags || []).join(' ');
}
