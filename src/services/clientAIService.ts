import { supabase } from '../lib/supabase';

export type ExtractionConfidence = 'high' | 'medium' | 'low';

export interface ClientPhotoExtraction {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  source: string | null;
  notes: string | null;
  confidence: ExtractionConfidence;
  warnings: string[];
}

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Formats a raw phone string the way the client table stores it. The model is
 * asked for bare digits, but photos of business cards and handwriting produce
 * all sorts of shapes, so anything that isn't a recognizable US number is left
 * exactly as read for the admin to correct.
 */
export function formatExtractedPhone(phone: string | null): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  return phone.trim();
}

/**
 * Sends a photo of a business card, note, work order, or message screenshot to
 * the analyze-client-photo Edge Function and returns the contact fields it could
 * read. Every field can come back null — the caller is expected to show the
 * result in an editable form, never to save it blind.
 */
export async function analyzeClientPhoto(file: File, hint?: string): Promise<ClientPhotoExtraction> {
  const { base64, mediaType } = await fileToBase64(file);

  const body: Record<string, string> = { image: base64, mediaType };
  if (hint?.trim()) {
    body.hint = hint.trim();
  }

  const { data, error } = await supabase.functions.invoke('analyze-client-photo', {
    body,
  });

  if (error) {
    // On a non-2xx the Edge Function's JSON body (with a human-readable `error`)
    // is on error.context; surface that instead of the generic
    // "Edge Function returned a non-2xx status code".
    let message = error.message || 'Photo scan failed';
    try {
      const errorBody = await (error as { context?: Response }).context?.json?.();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  if (!data) {
    throw new Error('No response from the photo scan');
  }

  const extraction: ClientPhotoExtraction = {
    name: data.name ?? null,
    email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    source: data.source ?? null,
    notes: data.notes ?? null,
    confidence: (['high', 'medium', 'low'] as const).includes(data.confidence)
      ? data.confidence
      : 'low',
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };

  const foundSomething = Boolean(
    extraction.name || extraction.email || extraction.phone || extraction.address
  );

  if (!foundSomething) {
    throw new Error(
      'No contact details were readable in that photo. Try a clearer shot, or enter the details manually.'
    );
  }

  return extraction;
}
