import { supabase } from '../lib/supabase';
import type { ModelParameter, ParamValue } from '../lib/openscad/params';
import type { MeshMetrics } from '../lib/mesh/stl';
import type { PrinterProfile } from '../lib/mesh/printability';
import type {
  PrintModel,
  PrintModelStatus,
  PrintModelVersion,
  PrintModelWithVersion,
} from '../types/printModel';

const BUCKET = 'print-models';

/** Rows carry jsonb columns that arrive as `unknown`; give them their shape back. */
function normalizeVersion(row: Record<string, unknown>): PrintModelVersion {
  return {
    ...(row as unknown as PrintModelVersion),
    parameters: Array.isArray(row.parameters) ? (row.parameters as ModelParameter[]) : [],
    param_values: (row.param_values && typeof row.param_values === 'object'
      ? row.param_values
      : {}) as Record<string, ParamValue>,
    metrics: (row.metrics && typeof row.metrics === 'object' ? row.metrics : {}) as PrintModelVersion['metrics'],
    print_profile: (row.print_profile && typeof row.print_profile === 'object'
      ? row.print_profile
      : {}) as Partial<PrinterProfile>,
  };
}

export async function getActiveBusinessId(): Promise<string | null> {
  const { data } = await supabase
    .from('business_info')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function listModels(): Promise<PrintModel[]> {
  const { data, error } = await supabase
    .from('print_models')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PrintModel[];
}

export async function getModel(id: string): Promise<PrintModelWithVersion | null> {
  const { data, error } = await supabase
    .from('print_models')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const model = data as PrintModel;
  if (!model.current_version_id) return { ...model, current_version: null };

  const { data: versionRow, error: versionError } = await supabase
    .from('print_model_versions')
    .select('*')
    .eq('id', model.current_version_id)
    .maybeSingle();
  if (versionError) throw versionError;

  return {
    ...model,
    current_version: versionRow ? normalizeVersion(versionRow as Record<string, unknown>) : null,
  };
}

export async function listVersions(modelId: string): Promise<PrintModelVersion[]> {
  const { data, error } = await supabase
    .from('print_model_versions')
    .select('*')
    .eq('model_id', modelId)
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeVersion(row as Record<string, unknown>));
}

export async function createModel(args: {
  businessId: string | null;
  name: string;
  prompt: string;
  summary: string;
}): Promise<PrintModel> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('print_models')
    .insert({
      business_id: args.businessId,
      created_by: userData?.user?.id ?? null,
      name: args.name,
      prompt: args.prompt,
      summary: args.summary,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PrintModel;
}

export async function updateModel(
  id: string,
  patch: Partial<Pick<PrintModel, 'name' | 'status' | 'tags' | 'summary'>>,
): Promise<void> {
  const { error } = await supabase.from('print_models').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteModel(id: string): Promise<void> {
  // Storage objects are not cascaded by the database, so clear the folder first;
  // a failure here must not block the row delete, or the model becomes unlistable
  // and its files are orphaned anyway.
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(id, { limit: 1000 });
    if (files?.length) {
      await supabase.storage.from(BUCKET).remove(files.map((file) => `${id}/${file.name}`));
    }
  } catch (storageError) {
    console.warn('Could not clear print model files:', storageError);
  }

  const { error } = await supabase.from('print_models').delete().eq('id', id);
  if (error) throw error;
}

export async function createVersion(args: {
  modelId: string;
  parentVersionId: string | null;
  scadSource: string;
  parameters: ModelParameter[];
  paramValues: Record<string, ParamValue>;
  refinePrompt: string | null;
  claudeModel: string | null;
  inputTokens: number;
  outputTokens: number;
  compileStatus: 'pending' | 'ok' | 'failed';
  compileError: string | null;
  repairAttempts: number;
  metrics: (Partial<MeshMetrics> & { printNotes?: string; supportsRequired?: boolean }) | null;
  profile: PrinterProfile;
}): Promise<PrintModelVersion> {
  // Versions are append-only and numbered per model, so ask the table what the
  // last one was rather than trusting client-side state that a second tab could
  // have moved on from.
  const { data: last } = await supabase
    .from('print_model_versions')
    .select('version')
    .eq('model_id', args.modelId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('print_model_versions')
    .insert({
      model_id: args.modelId,
      version: ((last?.version as number | undefined) ?? 0) + 1,
      parent_version_id: args.parentVersionId,
      scad_source: args.scadSource,
      parameters: args.parameters,
      param_values: args.paramValues,
      refine_prompt: args.refinePrompt,
      claude_model: args.claudeModel,
      claude_input_tokens: args.inputTokens,
      claude_output_tokens: args.outputTokens,
      compile_status: args.compileStatus,
      compile_error: args.compileError,
      repair_attempts: args.repairAttempts,
      metrics: args.metrics ?? {},
      print_profile: args.profile,
    })
    .select()
    .single();
  if (error) throw error;

  const version = normalizeVersion(data as Record<string, unknown>);
  await supabase
    .from('print_models')
    .update({ current_version_id: version.id })
    .eq('id', args.modelId);

  return version;
}

export async function setCurrentVersion(modelId: string, versionId: string): Promise<void> {
  const { error } = await supabase
    .from('print_models')
    .update({ current_version_id: versionId })
    .eq('id', modelId);
  if (error) throw error;
}

/** Uploads the generated files and records their paths on the version row. */
export async function uploadVersionFiles(args: {
  modelId: string;
  version: PrintModelVersion;
  stl: Uint8Array;
  threeMf: Uint8Array;
  scadSource: string;
  preview: Blob | null;
}): Promise<PrintModelVersion> {
  const base = `${args.modelId}/v${args.version.version}`;
  const paths: Partial<PrintModelVersion> = {};

  const put = async (name: string, body: Blob, contentType: string) => {
    const path = `${base}/${name}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });
    if (error) throw error;
    return path;
  };

  // `slice()` detaches nothing and gives Blob a plain ArrayBuffer to hold, which
  // matters because these arrays came across from the worker as transferables.
  paths.stl_path = await put('model.stl', new Blob([args.stl.slice()], { type: 'model/stl' }), 'model/stl');
  paths.threemf_path = await put(
    'model.3mf',
    new Blob([args.threeMf.slice()], { type: 'model/3mf' }),
    'model/3mf',
  );
  paths.scad_path = await put('source.scad', new Blob([args.scadSource], { type: 'text/plain' }), 'text/plain');
  if (args.preview) {
    paths.preview_path = await put('preview.png', args.preview, 'image/png');
  }

  const { data, error } = await supabase
    .from('print_model_versions')
    .update(paths)
    .eq('id', args.version.id)
    .select()
    .single();
  if (error) throw error;
  return normalizeVersion(data as Record<string, unknown>);
}

/** The bucket is private, so downloads go through a short-lived signed URL. */
export async function signedUrlFor(path: string, downloadAs?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function setStatus(id: string, status: PrintModelStatus): Promise<void> {
  const { error } = await supabase.from('print_models').update({ status }).eq('id', id);
  if (error) throw error;
}
