import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { getMapboxToken, resolveTravelEstimate } from '../_shared/travel.ts';

/**
 * Owner-only pricing help for one inquiry. Two actions:
 *
 *   locate    — saves the work address typed on the inquiry and returns the
 *               drive to it, so the travel charge can be worked out.
 *   recommend — asks Claude what to charge, given the formula price the page
 *               already worked out, the customer's own words, and how past jobs
 *               like it were priced and how long they took.
 *
 * Everything is saved to `inquiry_pricing`, which nothing customer-facing reads.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'claude-opus-5-5';
/** Finished jobs sent as pricing history, newest first. */
const HISTORY_LIMIT = 150;
/** Lost quotes sent alongside, so a price that keeps losing work is visible. */
const LOST_LIMIT = 40;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const SYSTEM_PROMPT = `You help the owner of Boxed2Built, a one-person furniture assembly business in Middle Tennessee, decide what to charge for a job a customer has asked about. Your answer is private to the owner and is never shown to the customer.

You are given:
- The inquiry: what the customer picked on the quote form, their notes in their own words, and the instant estimate the form showed them. That estimate comes from a fixed price list and includes no travel.
- A formula price the owner's software already worked out: hours on site at the owner's target hourly profit, plus the round-trip drive at the same rate and mileage. Treat it as the starting point. The hours in it come from the same fixed list, so they are a guess.
- The owner's job history: finished jobs with what was quoted, what was finally charged, and the hours they really took, and recent quotes that were lost with the reason.

Decide what the owner should charge for this job, before any coupon.

Work from the evidence. Find past jobs that resemble this one and see how long they really took and what they were charged; say so when the history shows the form's hours are off for this kind of item. Read the customer's notes for anything that changes the work: brand or model, size, stairs, wall mounting, disassembly or haul-away, several rooms, a tight deadline. If lost quotes show price was the reason for work like this, weigh that. When the history has little like this job, stay near the formula price and say the evidence is thin.

Do not invent facts about the job. If something you would need to price it well is missing, put it in questions_to_ask instead of assuming it.

Write for a busy owner reading on a phone: plain words, short sentences, dollar amounts rounded to $5. In reasoning, lead with the price and the main reason for it.`;

const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    price: { type: 'number', description: 'What to charge, in dollars, before any coupon. Rounded to 5.' },
    low: { type: 'number', description: 'The lowest price still worth taking the job at.' },
    high: { type: 'number', description: 'The highest price this job could reasonably carry.' },
    hours: { type: 'number', description: 'Your estimate of the hours on site.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasoning: { type: 'string', description: 'Two to four short sentences. The price and why.' },
    factors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to four short points that moved the price up or down from the formula price.',
    },
    questions_to_ask: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to three things to ask the customer that would change the price. Empty when nothing is missing.',
    },
  },
  required: ['price', 'low', 'high', 'hours', 'confidence', 'reasoning', 'factors', 'questions_to_ask'],
  additionalProperties: false,
};

interface Recommendation {
  price: number;
  low: number;
  high: number;
  hours: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  factors: string[];
  questions_to_ask: string[];
}

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Only the figures the page is expected to send, each one a plain number or null. */
function cleanFormula(raw: unknown) {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    target_rate_per_hour: num(source.targetRate),
    all_time_on_site_rate_per_hour: num(source.allTimeRate),
    form_hours: num(source.hours),
    labor: num(source.labor),
    travel: num(source.travel),
    formula_price: num(source.recommended),
    one_way_drive_minutes: num(source.driveMinutes),
    area: typeof source.area === 'string' ? source.area.slice(0, 80) : null,
    area_advice: typeof source.areaAdvice === 'string' ? source.areaAdvice.slice(0, 600) : null,
  };
}

function parseRecommendation(text: string): Recommendation | null {
  let body = text.trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  body = body.slice(start, end + 1);
  try {
    const parsed = JSON.parse(body);
    const price = num(parsed.price);
    if (price === null || price <= 0) return null;
    const list = (value: unknown, max: number) =>
      Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, max) : [];
    return {
      price,
      low: num(parsed.low) ?? price,
      high: num(parsed.high) ?? price,
      hours: num(parsed.hours) ?? 0,
      confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '',
      factors: list(parsed.factors, 4),
      questions_to_ask: list(parsed.questions_to_ask, 3),
    };
  } catch {
    return null;
  }
}

async function askClaude(apiKey: string, prompt: string): Promise<{ recommendation: Recommendation | null; error: string | null }> {
  const call = (structured: boolean) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: structured
          ? { effort: 'medium', format: { type: 'json_schema', schema: RECOMMENDATION_SCHEMA } }
          : { effort: 'medium' },
        messages: [
          {
            role: 'user',
            content: structured
              ? prompt
              : `${prompt}\n\nAnswer with one JSON object and nothing else, with these keys: price, low, high, hours, confidence ("low", "medium" or "high"), reasoning, factors (array of strings), questions_to_ask (array of strings).`,
          },
        ],
      }),
    });

  let response = await call(true);
  // If this account's API rejects the schema field, the plain request still
  // gets an answer — same fallback as the client photo scan.
  if (response.status === 400) {
    const detail = await response.text();
    if (!/output_config|json_schema|format|schema/i.test(detail)) {
      console.error('inquiry-price-advice: Claude rejected the request', detail.slice(0, 500));
      return { recommendation: null, error: 'Claude could not read this request.' };
    }
    console.warn('inquiry-price-advice: structured output rejected, retrying plainly', detail.slice(0, 300));
    response = await call(false);
  }

  if (!response.ok) {
    console.error('inquiry-price-advice: Claude API error', response.status, (await response.text()).slice(0, 500));
    return {
      recommendation: null,
      error:
        response.status === 429 || response.status === 529
          ? 'Claude is busy right now. Try again in a minute.'
          : `Claude could not be reached (${response.status}).`,
    };
  }

  const result = await response.json();
  if (result.stop_reason === 'refusal') {
    return { recommendation: null, error: 'Claude declined to price this inquiry. Use the formula price.' };
  }

  // Thinking blocks come first, so the answer is the last text block.
  const texts = (result.content ?? []).filter((block: { type: string }) => block.type === 'text');
  const recommendation = parseRecommendation(texts[texts.length - 1]?.text ?? '');
  if (!recommendation) {
    console.error('inquiry-price-advice: unreadable answer', result.stop_reason);
    return { recommendation: null, error: 'Claude answered in a form that could not be read. Try again.' };
  }
  return { recommendation, error: null };
}

async function loadHistory(admin: SupabaseClient, organizationId: string) {
  const columns =
    'job_type, job_description, hours_worked, quoted_price, final_price, materials_cost, location_city, client_type, date_completed';

  const [done, lost] = await Promise.all([
    admin
      .from('jobs')
      .select(columns)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('is_test', false)
      .eq('is_free', false)
      .eq('job_status', 'completed')
      .gt('hours_worked', 0)
      .order('date_completed', { ascending: false, nullsFirst: false })
      .limit(HISTORY_LIMIT),
    admin
      .from('jobs')
      .select('job_type, job_description, quoted_price, location_city, lost_reason_category, status_changed_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('is_test', false)
      .eq('job_status', 'lost')
      .gt('quoted_price', 0)
      .order('status_changed_at', { ascending: false, nullsFirst: false })
      .limit(LOST_LIMIT),
  ]);

  if (done.error) throw done.error;
  if (lost.error) throw lost.error;
  return { finished: done.data ?? [], lost: lost.data ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Both actions cost money on a miss (Mapbox, Claude), so admins only.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);

    const body = await req.json().catch(() => ({}));
    const inquiryId = typeof body?.inquiryId === 'string' ? body.inquiryId : '';
    const action = body?.action;
    if (!inquiryId) return json({ error: 'inquiryId is required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inquiry, error: inquiryError } = await admin
      .from('form_inquiries')
      .select(
        'id, organization_id, furniture_type, pieces, notes, estimated_price, estimated_time, preferred_date, ' +
          'preferred_time_slot, coupon_code, coupon_discount_amount, submission_date',
      )
      .eq('id', inquiryId)
      .maybeSingle();
    if (inquiryError) throw inquiryError;
    if (!inquiry) return json({ error: 'Inquiry not found' }, 404);

    const { data: saved } = await admin
      .from('inquiry_pricing')
      .select('service_address')
      .eq('inquiry_id', inquiryId)
      .maybeSingle();

    if (action === 'locate') {
      const address = typeof body?.address === 'string' ? body.address.trim().replace(/\s+/g, ' ').slice(0, 300) : '';

      const { error: saveError } = await admin.from('inquiry_pricing').upsert(
        {
          inquiry_id: inquiryId,
          organization_id: inquiry.organization_id,
          service_address: address || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'inquiry_id' },
      );
      if (saveError) throw saveError;

      if (!address) return json({ address: null, status: 'no_address', durationSeconds: null, distanceMeters: null });
      if (!getMapboxToken()) {
        return json({ address, status: 'error', durationSeconds: null, distanceMeters: null, error: 'Mapbox token not configured.' });
      }

      const estimate = await resolveTravelEstimate(admin, inquiry.organization_id, address, { allowLookup: true });
      return json({
        address,
        status: estimate.status,
        durationSeconds: estimate.durationSeconds,
        distanceMeters: estimate.distanceMeters,
      });
    }

    if (action !== 'recommend') return json({ error: 'Unknown action' }, 400);

    const apiKey =
      Deno.env.get('Claude_Inquiry_Pricing') ??
      Deno.env.get('Claude_Coupon_Promo') ??
      Deno.env.get('Claude_Gallery_Image_Creation');
    if (!apiKey) return json({ error: 'Claude API key not configured' }, 500);

    const formula = cleanFormula(body?.formula);
    const history = await loadHistory(admin, inquiry.organization_id);

    // The customer's name, email and phone are deliberately left out: nothing
    // about a price depends on who is asking.
    const prompt = [
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
      `<inquiry>\n${JSON.stringify(
        {
          main_item_type: inquiry.furniture_type,
          total_pieces: inquiry.pieces,
          customer_notes: inquiry.notes,
          form_estimate_shown_to_customer: inquiry.estimated_price,
          form_estimated_time: inquiry.estimated_time,
          coupon_code: inquiry.coupon_code,
          coupon_amount_already_off_the_estimate: inquiry.coupon_discount_amount,
          preferred_date: inquiry.preferred_date,
          preferred_time: inquiry.preferred_time_slot,
          submitted: inquiry.submission_date,
          work_address: saved?.service_address ?? null,
        },
        null,
        1,
      )}\n</inquiry>`,
      `<formula_price>\n${JSON.stringify(formula, null, 1)}\n</formula_price>`,
      `<finished_jobs count="${history.finished.length}">\n${JSON.stringify(history.finished)}\n</finished_jobs>`,
      `<lost_quotes count="${history.lost.length}">\n${JSON.stringify(history.lost)}\n</lost_quotes>`,
      'What should the owner charge for this inquiry?',
    ].join('\n\n');

    const { recommendation, error } = await askClaude(apiKey, prompt);
    if (!recommendation) return json({ error: error ?? 'No recommendation' }, 502);

    const recommendedAt = new Date().toISOString();
    const stored = { ...recommendation, formula_price: formula.formula_price, jobs_considered: history.finished.length };

    const { error: storeError } = await admin.from('inquiry_pricing').upsert(
      {
        inquiry_id: inquiryId,
        organization_id: inquiry.organization_id,
        recommendation: stored,
        recommended_at: recommendedAt,
        updated_at: recommendedAt,
      },
      { onConflict: 'inquiry_id' },
    );
    // The answer cost money, so it is still returned if saving it fails.
    if (storeError) console.error('inquiry-price-advice: could not save the recommendation', storeError);

    return json({ recommendation: stored, recommendedAt });
  } catch (failure) {
    console.error('inquiry-price-advice failed:', failure);
    return json({ error: failure instanceof Error ? failure.message : 'Something went wrong' }, 500);
  }
});
