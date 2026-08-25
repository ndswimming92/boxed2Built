import { supabase } from '../lib/supabase';
import type { PrinterProfile } from '../lib/mesh/printability';
import type { GenerationResult } from '../types/printModel';

/**
 * Thin wrapper over the `generate-print-model` edge function. The Anthropic key
 * lives only as a Supabase function secret, so every generation goes through the
 * server — nothing here ever sees it.
 */

interface GenerateArgs {
  mode: 'create' | 'refine' | 'repair';
  prompt?: string;
  scadSource?: string;
  compileError?: string;
  profile: PrinterProfile;
}

export async function generateModel(args: GenerateArgs): Promise<GenerationResult> {
  const { data, error } = await supabase.functions.invoke('generate-print-model', {
    body: {
      mode: args.mode,
      prompt: args.prompt,
      scadSource: args.scadSource,
      compileError: args.compileError,
      printProfile: {
        printer: args.profile.printer,
        bedX: args.profile.bedX,
        bedY: args.profile.bedY,
        bedZ: args.profile.bedZ,
        nozzleMm: args.profile.nozzleMm,
        layerHeightMm: args.profile.layerHeightMm,
        material: args.profile.material,
        supportsAllowed: args.profile.supportsAllowed,
      },
    },
  });

  if (error) {
    // On a non-2xx the Edge Function's JSON body (with a human-readable `error`)
    // is on error.context; surface that instead of the generic
    // "Edge Function returned a non-2xx status code".
    let message = error.message || 'Model generation failed';
    const context = (error as { context?: Response }).context;

    // Supabase kills a worker that overruns its wall clock with a bare 546 and
    // no body, so there is nothing to parse - say what actually happened.
    if (context?.status === 546) {
      throw new Error(
        'The generator ran out of time on the server. This usually means the request was very open-ended — try describing the part more specifically, with dimensions.',
      );
    }

    try {
      const body = await context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  if (!data?.success || !data?.model?.scadSource) {
    throw new Error(data?.error || 'The model did not return usable CAD source');
  }

  return { model: data.model, usage: data.usage };
}
