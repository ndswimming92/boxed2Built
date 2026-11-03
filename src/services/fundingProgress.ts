/** Pure math for the "balance vs. remaining costs" progress bar (no DB imports). */

export type FundingPeriod = 'year-end' | 'next-12-months';

export interface FundingProgress {
  period: FundingPeriod;
  periodEnd: Date;
  /** Charges scheduled from today through periodEnd. */
  scheduled: number;
  /** Extra buffer added on top of the scheduled charges. */
  cushion: number;
  /** scheduled + cushion: the amount the balance is measured against. */
  required: number;
  balance: number;
  /** balance / required, clamped to 0..1. 1 when nothing is owed. */
  fraction: number;
  /** How much more cash is needed to cover the period (0 when fully funded). */
  shortfall: number;
  /** Cash left over after the period's charges (0 when underfunded). */
  surplus: number;
  fullyFunded: boolean;
  chargeCount: number;
}

/** Last day (UTC, date-only) covered by the period. */
export function fundingPeriodEnd(period: FundingPeriod, today: Date): Date {
  if (period === 'year-end') {
    return new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
  }
  // Same day next year, minus one day (Feb 29 clamps to Feb 28).
  const y = today.getUTCFullYear() + 1;
  const m = today.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const nextYear = new Date(Date.UTC(y, m, Math.min(today.getUTCDate(), lastDay)));
  return new Date(nextYear.getTime() - 24 * 60 * 60 * 1000);
}

export function summarizeFunding(
  charges: { amount: number }[],
  balance: number,
  period: FundingPeriod,
  periodEnd: Date,
  cushion = 0
): FundingProgress {
  const round = (n: number) => Math.round(n * 100) / 100;
  const scheduled = round(charges.reduce((sum, c) => sum + c.amount, 0));
  const safeCushion = Math.max(0, round(cushion));
  const required = round(scheduled + safeCushion);
  // Only the progress fraction is clamped; a negative balance still counts in full
  // toward the shortfall (you must cover the overdraft too).
  const fraction = required <= 0 ? 1 : Math.min(1, Math.max(0, balance / required));
  const shortfall = Math.max(0, round(required - balance));
  const surplus = Math.max(0, round(balance - required));
  return {
    period,
    periodEnd,
    scheduled,
    cushion: safeCushion,
    required,
    balance,
    fraction,
    shortfall,
    surplus,
    fullyFunded: shortfall === 0,
    chargeCount: charges.length,
  };
}
