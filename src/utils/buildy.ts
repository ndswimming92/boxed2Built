/**
 * The rules behind Buildy, the admin mascot: what he wears, what he carries,
 * how fast he walks and what he says. Pure functions only, so they can be
 * tested without a browser and the rail component stays about drawing.
 */

/** What the job board looks like from where Buildy is standing. */
export interface JobBoardSummary {
  /** Jobs scheduled for today or later and still ahead of us. */
  upcoming: number;
  /** Of those, how many are today. */
  today: number;
  /** Of those, how many fall in the next seven days, today included. */
  week: number;
  /** The soonest one, for the drag-a-box shortcut. */
  nextJobId: string | null;
}

export const EMPTY_BOARD: JobBoardSummary = { upcoming: 0, today: 0, week: 0, nextJobId: null };

// ── what he carries, by the clock ────────────────────────────────────────────

export type TimeOfDayProp = 'coffee' | 'lunch' | 'headlamp' | null;

/**
 * Coffee first thing, a lunch box around midday, a headlamp once it gets dark.
 * The afternoon gets nothing: he is just working.
 */
export function timeOfDayProp(now: Date): TimeOfDayProp {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return 'coffee';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 18 || hour < 5) return 'headlamp';
  return null;
}

// ── what he wears, by the calendar ───────────────────────────────────────────

export type SeasonalLook = 'santa' | 'pumpkin' | 'shades' | null;

/** A Santa hat in December, a pumpkin box in October, sunglasses all summer. */
export function seasonalLook(now: Date): SeasonalLook {
  const month = now.getMonth();
  if (month === 11) return 'santa';
  if (month === 9) return 'pumpkin';
  if (month >= 5 && month <= 7) return 'shades';
  return null;
}

// ── how fast he walks ────────────────────────────────────────────────────────

/** Three jobs in one day is a full day for a one-van business. */
export const BUSY_DAY = 3;

export type Pace = 'nap' | 'busy' | 'normal';

/**
 * Nothing in the next week and he naps. A packed day and he hurries.
 * Napping wins: a busy today always means a non-empty week anyway.
 */
export function paceFor(board: Pick<JobBoardSummary, 'today' | 'week'>): Pace {
  if (board.week === 0) return 'nap';
  if (board.today >= BUSY_DAY) return 'busy';
  return 'normal';
}

// ── what he says when poked ──────────────────────────────────────────────────

const jobsPhrase = (n: number) => (n === 1 ? '1 job' : `${n} jobs`);

const JOKES = [
  'Got the allen key?',
  'Measure twice, build once.',
  'Righty tighty, lefty loosey.',
  'Who reads the instructions anyway?',
  'There is always one screw left over.',
  'Box in, furniture out.',
];

/**
 * Everything he might say to a click: the real numbers first, then the jokes.
 * Callers cycle through these so repeated clicks do not repeat themselves.
 */
export function pokeLines(board: JobBoardSummary): string[] {
  const facts: string[] = [];
  if (board.upcoming === 0) facts.push('Board is clear. Nap time?');
  else facts.push(`${jobsPhrase(board.upcoming)} on the board.`);
  if (board.today > 0) facts.push(`${jobsPhrase(board.today)} today. Let's go!`);
  else if (board.week > 0) facts.push(`${jobsPhrase(board.week)} this week.`);
  return [...facts, ...JOKES];
}

/** The nth line, wrapping around. */
export function pokeLine(board: JobBoardSummary, n: number): string {
  const lines = pokeLines(board);
  return lines[((n % lines.length) + lines.length) % lines.length];
}

// ── reactions to the business ────────────────────────────────────────────────

export type ReactionKind = 'lead' | 'paid' | 'done' | 'poke';

export interface BuildyReaction {
  /** Unique per event, so the same lead or payment is never celebrated twice. */
  key: string;
  kind: ReactionKind;
  /** What the speech bubble says, and what a screen reader hears. */
  text: string;
  /** Where clicking the bubble goes, if anywhere. */
  href?: string;
}

/** How long each reaction holds the stage. A lead waits longest: it needs acting on. */
export const REACTION_MS: Record<ReactionKind, number> = {
  lead: 9000,
  paid: 4500,
  done: 5000,
  poke: 2600,
};

/** Three things queued is plenty; past that a bulk import is happening, not news. */
export const MAX_QUEUED = 3;

/**
 * Add a reaction to the queue. Business events go ahead of a poke, an event
 * already queued is ignored, and the queue never grows past MAX_QUEUED.
 */
export function enqueueReaction(queue: BuildyReaction[], next: BuildyReaction): BuildyReaction[] {
  if (queue.some((r) => r.key === next.key)) return queue;
  // A new poke replaces a waiting one rather than stacking up behind it.
  const rest = next.kind === 'poke' ? queue.filter((r) => r.kind !== 'poke') : queue;
  if (rest.length >= MAX_QUEUED) return rest;
  if (next.kind === 'poke') return [...rest, next];
  // The one on stage keeps it; a business event jumps any waiting pokes.
  const [current, ...waiting] = rest;
  if (!current) return [next];
  const firstPoke = waiting.findIndex((r) => r.kind === 'poke');
  if (firstPoke === -1) return [current, ...waiting, next];
  return [current, ...waiting.slice(0, firstPoke), next, ...waiting.slice(firstPoke)];
}

/** '$1,250' or '$84.50' — whole dollars lose the cents. */
export function formatPayment(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  const whole = Number.isInteger(amount);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

export function leadReaction(inquiry: { id: string; client_name?: string | null }): BuildyReaction {
  const first = inquiry.client_name?.trim().split(/\s+/)[0];
  return {
    key: `lead:${inquiry.id}`,
    kind: 'lead',
    text: first ? `New lead: ${first}!` : 'New lead!',
    href: `/admin/inquiries?open=${encodeURIComponent(inquiry.id)}`,
  };
}

export function paidReaction(invoice: { id: string; amount_paid?: number | null }): BuildyReaction {
  const amount = formatPayment(invoice.amount_paid);
  return {
    key: `paid:${invoice.id}`,
    kind: 'paid',
    text: amount ? `Paid! ${amount}` : 'Invoice paid!',
    href: '/admin/invoices',
  };
}

export function doneReaction(jobId: string): BuildyReaction {
  return {
    key: `done:${jobId}`,
    kind: 'done',
    text: 'Built it!',
    href: `/admin/jobs?job=${encodeURIComponent(jobId)}`,
  };
}

/** A payment only counts as news if it landed in the last few minutes. */
export const FRESH_PAYMENT_MS = 5 * 60 * 1000;

export function isFreshPayment(
  invoice: { status?: string | null; paid_at?: string | null; is_test?: boolean | null },
  now: number,
): boolean {
  if (invoice.status !== 'paid' || invoice.is_test || !invoice.paid_at) return false;
  const paidAt = Date.parse(invoice.paid_at);
  return Number.isFinite(paidAt) && now - paidAt <= FRESH_PAYMENT_MS && paidAt - now <= FRESH_PAYMENT_MS;
}
