import { supabase } from '../lib/supabase';

/** What Claude recommended for an inquiry. Owner-only; never part of a quote. */
export interface PriceRecommendation {
  price: number;
  low: number;
  high: number;
  hours: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  factors: string[];
  questions_to_ask: string[];
  /** The formula price it was given to start from. */
  formula_price: number | null;
  /** Finished jobs it was shown as history. */
  jobs_considered: number;
}

export interface InquiryPricingRecord {
  serviceAddress: string | null;
  recommendation: PriceRecommendation | null;
  recommendedAt: string | null;
}

export interface LocatedAddress {
  address: string | null;
  /** 'ok' when the drive is known. Anything else means it could not be placed. */
  status: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
}

/** The figures the page worked out, passed to Claude as its starting point. */
export interface FormulaSummary {
  targetRate: number;
  allTimeRate: number | null;
  hours: number | null;
  labor: number | null;
  travel: number | null;
  recommended: number | null;
  driveMinutes: number | null;
  area: string | null;
  areaAdvice: string | null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('inquiry-price-advice', { body });
  if (error) {
    let message = error.message || 'Pricing request failed';
    try {
      const detail = await (error as { context?: Response }).context?.json?.();
      if (detail?.error) message = detail.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return data as T;
}

export async function getInquiryPricing(inquiryId: string): Promise<InquiryPricingRecord> {
  const { data, error } = await supabase
    .from('inquiry_pricing')
    .select('service_address, recommendation, recommended_at')
    .eq('inquiry_id', inquiryId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load pricing for this inquiry: ${error.message}`);
  return {
    serviceAddress: data?.service_address ?? null,
    recommendation: (data?.recommendation as PriceRecommendation | null) ?? null,
    recommendedAt: data?.recommended_at ?? null,
  };
}

/** Saves the work address on the inquiry and returns the drive to it. An empty address clears it. */
export function locateInquiry(inquiryId: string, address: string): Promise<LocatedAddress> {
  return invoke<LocatedAddress>({ inquiryId, action: 'locate', address });
}

/** Asks Claude what to charge. Costs a few cents a call, so it only runs on a click. */
export function recommendInquiryPrice(
  inquiryId: string,
  formula: FormulaSummary,
): Promise<{ recommendation: PriceRecommendation; recommendedAt: string }> {
  return invoke({ inquiryId, action: 'recommend', formula });
}
