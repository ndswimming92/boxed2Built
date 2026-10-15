/**
 * How long a customer would typically spend building each kind of furniture
 * themselves — the time Boxed2Built hands back.
 *
 * `diyHours` is a [low, high] range PER PIECE for a first-time builder: hunting
 * for parts, decoding the instructions, tightening hardware, fixing a backwards
 * panel, and hauling away the packaging. Ranges are anchored to the hours logged
 * on completed Boxed2Built jobs (a pro's time) scaled up for a first-timer, and
 * cross-checked against typical published assembly times. The `basis` note
 * records how solid each figure is so it can be revisited as more jobs are logged.
 *
 * Keep ids in step with FURNITURE in ContactForm.
 */
export type TimeSavingsId = 'Chair' | 'Table' | 'Bed' | 'Dresser' | 'Bookshelf' | 'IKEA' | 'Other';

export type TimeSavingsEntry = {
  diyHours: [number, number];
  /** Short, customer-facing hint of what the range covers. */
  example: string;
  basis: 'job-data' | 'job-data-thin' | 'general-estimate';
};

export const DIY_TIME_SAVINGS: Record<TimeSavingsId, TimeSavingsEntry> = {
  // Jobs: 3 Adirondack chairs + patio heater 3h; 2 rocking chairs + umbrella 2h;
  // nightstands + chair 1.5h (~30-45 min per chair for us).
  Chair: { diyHours: [1, 1.5], example: 'dining, patio or rocking chair', basis: 'job-data' },
  // Jobs: coffee table 0.5h; farmhouse table + nightstand 2.5h; standing desk 2h;
  // office desk + file cabinet 6h; desk with hutch + fireplace stand 13h.
  Table: { diyHours: [2, 4], example: 'desk, dining or coffee table', basis: 'job-data' },
  // Jobs: only one bed logged (Murphy bed, 4.5h). Standard frames are general estimates.
  Bed: { diyHours: [2, 4], example: 'bed frame, platform bed or crib', basis: 'job-data-thin' },
  // Jobs: clothes storage + nightstand 3h; pantry cabinet 4.5h; storage closet 2h.
  Dresser: { diyHours: [3, 5], example: 'dresser, wardrobe or cabinet', basis: 'job-data' },
  // Jobs: 76" fireplace TV stand 2.5h; shelving 1-2h.
  Bookshelf: { diyHours: [2, 4], example: 'bookcase, shelving or TV stand', basis: 'job-data' },
  // No jobs logged by brand. General estimate for mixed flat-pack.
  IKEA: { diyHours: [2, 4], example: 'flat-pack with a bag of hardware', basis: 'general-estimate' },
  // Jobs: trampoline + shelving 3.5h; planter 1.5h; water fountain 1h. Very mixed.
  Other: { diyHours: [2, 5], example: 'grill, gym gear, patio sets', basis: 'job-data-thin' },
};

export type TimeSavings = { low: number; high: number };

/** Total hours saved for a set of quantities. Unknown ids and non-positive counts are ignored. */
export function estimateTimeSaved(qty: Partial<Record<string, number>>): TimeSavings {
  let low = 0;
  let high = 0;
  for (const [id, count] of Object.entries(qty)) {
    const entry = (DIY_TIME_SAVINGS as Record<string, TimeSavingsEntry | undefined>)[id];
    const n = Number(count);
    if (!entry || !Number.isFinite(n) || n <= 0) continue;
    low += entry.diyHours[0] * n;
    high += entry.diyHours[1] * n;
  }
  return { low, high };
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

/** "2–4 hours", "about 3 hours", or "1 hour". */
export function formatHoursRange({ low, high }: TimeSavings): string {
  if (high <= 0) return '';
  if (low === high) return `${trim(low)} ${low === 1 ? 'hour' : 'hours'}`;
  return `${trim(low)}–${trim(high)} hours`;
}
