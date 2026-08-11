import type { Plugin, ResolvedConfig } from 'vite';
import { isRatingOnly } from '../src/utils/ratingCalculations';
import { CUSTOMER_REVIEWS } from '../src/constants/localSEO';

// Fills the review totals in index.html's static JSON-LD from customer_reviews at
// build time.
//
// Those blocks used to carry the counts as literal text, in a file nobody thinks
// to open when adding a review — so the site sat at "8 reviews" while the Google
// Business Profile had moved on to 9 ratings. The numbers now come from the same
// table the rest of the site reads, so there is nothing left to keep in sync.
//
// ratingCount is every active rating; reviewCount is only the ones carrying
// written text, because Google lets a customer leave stars without words.

const NAME = 'review-aggregate-rating';

/** Only the columns the totals need. */
type ReviewRow = { review_body: string; rating_value: number };

export type ReviewTotals = {
  ratingValue: string;
  ratingCount: string;
  reviewCount: string;
};

/** `__GBP_RATING_COUNT__` in index.html -> the matching field of ReviewTotals. */
const FIELD_BY_TOKEN: Record<string, keyof ReviewTotals> = {
  RATING_VALUE: 'ratingValue',
  RATING_COUNT: 'ratingCount',
  REVIEW_COUNT: 'reviewCount',
};

const TOKEN = /__GBP_(RATING_VALUE|RATING_COUNT|REVIEW_COUNT)__/g;
/** Non-global twin of TOKEN: `test` on a global regex carries lastIndex between calls. */
const HAS_TOKEN = /__GBP_(?:RATING_VALUE|RATING_COUNT|REVIEW_COUNT)__/;
/** Catches a token that was mistyped, so it can't ship as literal text. */
const ANY_TOKEN = /__GBP_[A-Z_]*__/;

function summarize(rows: ReviewRow[]): ReviewTotals {
  const total = rows.reduce((sum, row) => sum + row.rating_value, 0);
  return {
    ratingValue: (total / rows.length).toFixed(1),
    ratingCount: String(rows.length),
    reviewCount: String(rows.filter((row) => !isRatingOnly(row)).length),
  };
}

/** The same static reviews the app falls back to when Supabase is unreachable. */
function fallbackRows(): ReviewRow[] {
  return CUSTOMER_REVIEWS.map((review) => ({
    review_body: review.reviewBody,
    rating_value: review.ratingValue,
  }));
}

/**
 * Read over the REST endpoint rather than @supabase/supabase-js: this runs while
 * Vite is resolving its config, where the browser client has no business being
 * constructed.
 */
async function fetchRows(url: string, key: string): Promise<ReviewRow[]> {
  const endpoint =
    `${url.replace(/\/+$/, '')}/rest/v1/customer_reviews` +
    '?select=review_body,rating_value&is_active=eq.true';

  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as ReviewRow[];
}

export default function reviewAggregateRating(): Plugin {
  let env: ResolvedConfig['env'] = {};
  let pending: Promise<ReviewTotals> | null = null;

  async function resolveTotals(): Promise<ReviewTotals> {
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;

    if (typeof url === 'string' && typeof key === 'string' && url && key) {
      try {
        const rows = await fetchRows(url, key);
        if (rows.length > 0) return summarize(rows);
        console.warn(`[${NAME}] no active customer_reviews rows; using fallback review data`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[${NAME}] could not read customer_reviews (${reason}); using fallback review data`);
      }
    } else {
      console.warn(`[${NAME}] Supabase env vars missing; using fallback review data`);
    }

    return summarize(fallbackRows());
  }

  return {
    name: NAME,

    configResolved(config) {
      env = config.env;
      // A new build must not reuse totals resolved for a previous config.
      pending = null;
    },

    // The SSG pass renders every page from the built index.html, so substituting
    // once here covers all of them.
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        if (!HAS_TOKEN.test(html)) {
          console.warn(`[${NAME}] index.html has no review-total placeholders left to fill`);
          return html;
        }

        pending ??= resolveTotals();
        const totals = await pending;
        const filled = html.replace(TOKEN, (_match, token: string) => totals[FIELD_BY_TOKEN[token]]);

        const stray = filled.match(ANY_TOKEN);
        if (stray) {
          throw new Error(
            `[${NAME}] unrecognised placeholder ${stray[0]} in index.html — ` +
              `expected one of ${Object.keys(FIELD_BY_TOKEN).map((t) => `__GBP_${t}__`).join(', ')}`,
          );
        }

        console.log(
          `[${NAME}] review totals: ${totals.ratingValue} rating, ` +
            `${totals.ratingCount} ratings, ${totals.reviewCount} written reviews`,
        );
        return filled;
      },
    },
  };
}
