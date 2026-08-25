/**
 * OpenSCAD's Customizer convention turns top-level assignments into a parameter
 * UI. We read the same annotations so the sliders are derived from the source
 * itself rather than from a parallel description that can drift out of sync
 * after a refinement rewrites the model.
 *
 *   /* [Dimensions] *\/          <- section heading
 *   // Outside width            <- label for the next assignment
 *   body_width = 120;  // [40:1:250]   <- range annotation
 */

export type ParamValue = number | boolean | string;

export interface ModelParameter {
  name: string;
  label: string;
  type: 'number' | 'boolean' | 'string';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  section: string;
  description?: string;
}

/**
 * The Customizer only considers assignments above the first module or function,
 * and so do we — an assignment inside a module body is an implementation detail,
 * not a knob.
 */
function parameterRegionEnd(lines: string[]): number {
  const index = lines.findIndex((line) => /^\s*(module|function)\s+[A-Za-z_]/.test(line));
  return index === -1 ? lines.length : index;
}

function parseLiteral(raw: string): ParamValue | null {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  const quoted = value.match(/^"([^"]*)"$/);
  if (quoted) return quoted[1];
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return null;
}

/** `[40:1:250]`, `[40:250]`, `[250]`, or `[a, b, c]` for a dropdown. */
function parseAnnotation(raw: string | undefined): Partial<ModelParameter> {
  if (!raw) return {};
  const body = raw.trim();

  if (body.includes(':')) {
    const parts = body.split(':').map((part) => Number(part.trim()));
    if (parts.some(Number.isNaN)) return {};
    if (parts.length === 3) return { min: parts[0], step: parts[1], max: parts[2] };
    if (parts.length === 2) return { min: parts[0], max: parts[1] };
    return {};
  }

  if (body.includes(',')) {
    return { options: body.split(',').map((part) => part.trim().replace(/^"|"$/g, '')) };
  }

  const single = Number(body);
  return Number.isNaN(single) ? {} : { min: 0, max: single };
}

export function parseParameters(source: string): ModelParameter[] {
  const lines = source.split('\n');
  const end = parameterRegionEnd(lines);
  const params: ModelParameter[] = [];

  let section = 'Parameters';
  let pendingLabel: string | null = null;

  for (let i = 0; i < end; i += 1) {
    const line = lines[i];

    const sectionMatch = line.match(/^\s*\/\*\s*\[([^\]]+)\]\s*\*\//);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      pendingLabel = null;
      continue;
    }

    // A bare comment line becomes the label for whatever is assigned next.
    const commentMatch = line.match(/^\s*\/\/\s?(.*)$/);
    if (commentMatch) {
      const text = commentMatch[1].trim();
      pendingLabel = text.length > 0 ? text : null;
      continue;
    }

    const assignment = line.match(
      /^\s*([A-Za-z_]\w*)\s*=\s*([^;]+);\s*(?:\/\/\s*\[([^\]]*)\])?/,
    );
    if (!assignment) {
      if (line.trim().length > 0) pendingLabel = null;
      continue;
    }

    const [, name, rawValue, annotation] = assignment;
    // `$fn` and friends are rendering hints, not design parameters.
    if (name.startsWith('$')) {
      pendingLabel = null;
      continue;
    }

    const value = parseLiteral(rawValue);
    if (value === null) {
      // A computed default (e.g. `inner = width - 2 * wall`) is derived, not tunable.
      pendingLabel = null;
      continue;
    }

    params.push({
      name,
      label: pendingLabel ?? name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
      default: value,
      section,
      ...parseAnnotation(annotation),
    });
    pendingLabel = null;
  }

  return params;
}

function formatLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return `"${value.replace(/"/g, '')}"`;
}

/**
 * Rewrites top-level assignments in place so a slider change re-compiles the
 * same source with new numbers. Editing the text rather than passing `-D` flags
 * keeps what compiled and what gets saved to storage identical.
 */
export function applyParamValues(
  source: string,
  values: Record<string, ParamValue>,
): string {
  if (Object.keys(values).length === 0) return source;

  const lines = source.split('\n');
  const end = parameterRegionEnd(lines);

  for (let i = 0; i < end; i += 1) {
    const assignment = lines[i].match(/^(\s*)([A-Za-z_]\w*)(\s*=\s*)([^;]+)(;.*)$/);
    if (!assignment) continue;

    const [, indent, name, equals, , tail] = assignment;
    if (!(name in values)) continue;

    lines[i] = `${indent}${name}${equals}${formatLiteral(values[name])}${tail}`;
  }

  return lines.join('\n');
}

/** Slider state for a fresh model: every parameter at its declared default. */
export function defaultParamValues(params: ModelParameter[]): Record<string, ParamValue> {
  return Object.fromEntries(params.map((param) => [param.name, param.default]));
}
