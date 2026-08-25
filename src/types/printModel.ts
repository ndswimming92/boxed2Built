import type { ModelParameter, ParamValue } from '../lib/openscad/params';
import type { PrinterProfile } from '../lib/mesh/printability';
import type { MeshMetrics } from '../lib/mesh/stl';

export type PrintModelStatus = 'draft' | 'ready' | 'archived';
export type CompileStatus = 'pending' | 'ok' | 'failed';

export interface PrintModel {
  id: string;
  business_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  name: string;
  prompt: string;
  summary: string | null;
  status: PrintModelStatus;
  current_version_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PrintModelVersion {
  id: string;
  model_id: string;
  organization_id: string | null;
  version: number;
  parent_version_id: string | null;
  scad_source: string;
  parameters: ModelParameter[];
  param_values: Record<string, ParamValue>;
  refine_prompt: string | null;
  claude_model: string | null;
  claude_input_tokens: number;
  claude_output_tokens: number;
  compile_status: CompileStatus;
  compile_error: string | null;
  repair_attempts: number;
  stl_path: string | null;
  threemf_path: string | null;
  scad_path: string | null;
  preview_path: string | null;
  metrics: Partial<MeshMetrics> & { printNotes?: string; supportsRequired?: boolean };
  print_profile: Partial<PrinterProfile>;
  created_at: string;
}

export interface PrintModelWithVersion extends PrintModel {
  current_version: PrintModelVersion | null;
}

/** What the edge function hands back for a create, refine or repair turn. */
export interface GeneratedModel {
  name: string;
  summary: string;
  scadSource: string;
  printNotes: string;
  recommendedOrientation: string;
  supportsRequired: boolean;
  estimatedBboxMm: { x: number; y: number; z: number } | null;
}

export interface GenerationUsage {
  claudeModel: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface GenerationResult {
  model: GeneratedModel;
  usage: GenerationUsage;
}
