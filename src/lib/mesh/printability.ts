import type { MeshMetrics } from './stl';
import type { ModelParameter, ParamValue } from '../openscad/params';

/**
 * Turns mesh metrics into the checks an admin actually needs before slicing.
 *
 * A deliberate line is drawn here between what is measured and what is guessed.
 * Bed fit, watertightness and overhang angles fall straight out of the triangle
 * list and are exact. Filament mass and print time depend on slicer settings we
 * do not model, so they are returned separately and rendered as estimates —
 * never dressed up as slicer output.
 */

export interface PrinterProfile {
  printer: string;
  bedX: number;
  bedY: number;
  bedZ: number;
  nozzleMm: number;
  layerHeightMm: number;
  material: string;
  supportsAllowed: boolean;
}

export const PRINTER_PRESETS: Record<string, Omit<PrinterProfile, 'material' | 'supportsAllowed'>> = {
  'Bambu Lab P2S': { printer: 'Bambu Lab P2S', bedX: 256, bedY: 256, bedZ: 256, nozzleMm: 0.4, layerHeightMm: 0.2 },
  'Bambu Lab P1S': { printer: 'Bambu Lab P1S', bedX: 256, bedY: 256, bedZ: 256, nozzleMm: 0.4, layerHeightMm: 0.2 },
  'Bambu Lab X1C': { printer: 'Bambu Lab X1C', bedX: 256, bedY: 256, bedZ: 256, nozzleMm: 0.4, layerHeightMm: 0.2 },
  'Bambu Lab A1': { printer: 'Bambu Lab A1', bedX: 256, bedY: 256, bedZ: 256, nozzleMm: 0.4, layerHeightMm: 0.2 },
  'Bambu Lab A1 mini': { printer: 'Bambu Lab A1 mini', bedX: 180, bedY: 180, bedZ: 180, nozzleMm: 0.4, layerHeightMm: 0.2 },
};

/** g/cm3. Used for the filament mass estimate only. */
const DENSITY: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  PA: 1.15,
};

export const DEFAULT_PROFILE: PrinterProfile = {
  ...PRINTER_PRESETS['Bambu Lab P2S'],
  material: 'PLA',
  supportsAllowed: false,
};

export type CheckLevel = 'pass' | 'warn' | 'fail';

export interface PrintCheck {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
}

export interface PrintEstimate {
  /** Solid volume at 100% infill. Exact. */
  volumeCm3: number;
  /** Mass of that solid volume in the chosen material. Exact given density. */
  solidGrams: number;
  /** Rough mass at typical walls + 15% infill. An estimate, not slicer output. */
  estimatedGrams: number;
  /** Order-of-magnitude only. */
  estimatedMinutes: number;
}

export function runChecks(
  metrics: MeshMetrics,
  profile: PrinterProfile,
  params: ModelParameter[],
  values: Record<string, ParamValue>,
): PrintCheck[] {
  const checks: PrintCheck[] = [];
  const { bbox } = metrics;

  const fits = bbox.x <= profile.bedX && bbox.y <= profile.bedY && bbox.z <= profile.bedZ;
  const rotatedFits = bbox.y <= profile.bedX && bbox.x <= profile.bedY && bbox.z <= profile.bedZ;
  checks.push({
    id: 'bed',
    label: 'Fits the build volume',
    level: fits || rotatedFits ? 'pass' : 'fail',
    detail: `${bbox.x.toFixed(1)} x ${bbox.y.toFixed(1)} x ${bbox.z.toFixed(1)} mm on a ${profile.bedX} x ${profile.bedY} x ${profile.bedZ} mm plate${!fits && rotatedFits ? ' (rotate 90 degrees to fit)' : ''}`,
  });

  checks.push({
    id: 'watertight',
    label: 'Watertight solid',
    level: metrics.watertight ? 'pass' : 'fail',
    detail: metrics.watertight
      ? 'Every edge is shared by exactly two faces.'
      : `${metrics.openEdges} open edge${metrics.openEdges === 1 ? '' : 's'} — the slicer may fill this incorrectly.`,
  });

  checks.push({
    id: 'bed-contact',
    label: 'Sits on the plate',
    level: metrics.sitsOnBed ? 'pass' : 'warn',
    detail: metrics.sitsOnBed
      ? `Lowest point at Z = ${metrics.min.z.toFixed(2)} mm.`
      : `Geometry extends ${Math.abs(metrics.min.z).toFixed(2)} mm below Z=0. The slicer will drop it to the plate.`,
  });

  const overhangPct = Math.round(metrics.overhangRatio * 100);
  const overhangLevel: CheckLevel =
    metrics.maxOverhangDeg <= 45 ? 'pass' : profile.supportsAllowed ? 'warn' : overhangPct > 15 ? 'fail' : 'warn';
  checks.push({
    id: 'overhang',
    label: 'Overhangs',
    level: overhangLevel,
    detail:
      metrics.maxOverhangDeg <= 45
        ? 'No downward face steeper than 45 degrees. Prints support-free.'
        : `Steepest downward face is ${metrics.maxOverhangDeg.toFixed(0)} degrees from vertical; ${overhangPct}% of downward area is past 45 degrees.${profile.supportsAllowed ? '' : ' Supports are switched off for this profile.'}`,
  });

  // Wall thickness across an arbitrary mesh is expensive to measure and easy to
  // get wrong. The declared parameters are both cheaper to check and more
  // actionable, since they are what the admin can actually change.
  const minWall = profile.nozzleMm * 2;
  const wallParams = params.filter((param) =>
    param.type === 'number' && /wall|thick|shell|rib|floor|lid|base/i.test(param.name),
  );
  const thin = wallParams.filter((param) => {
    const value = values[param.name] ?? param.default;
    return typeof value === 'number' && value < minWall;
  });
  if (wallParams.length > 0) {
    checks.push({
      id: 'walls',
      label: 'Wall thickness',
      level: thin.length > 0 ? 'warn' : 'pass',
      detail:
        thin.length > 0
          ? `${thin.map((p) => `${p.label} (${values[p.name] ?? p.default} mm)`).join(', ')} below the ${minWall.toFixed(1)} mm minimum for a ${profile.nozzleMm} mm nozzle.`
          : `All wall parameters at or above the ${minWall.toFixed(1)} mm minimum for a ${profile.nozzleMm} mm nozzle.`,
    });
  }

  checks.push({
    id: 'complexity',
    label: 'Mesh complexity',
    level: metrics.triangleCount > 500_000 ? 'warn' : 'pass',
    detail: `${metrics.triangleCount.toLocaleString()} triangles.${metrics.triangleCount > 500_000 ? ' Consider lowering $fn — large meshes slow the slicer down.' : ''}`,
  });

  return checks;
}

export function estimate(metrics: MeshMetrics, profile: PrinterProfile): PrintEstimate {
  const density = DENSITY[profile.material?.toUpperCase?.() ?? 'PLA'] ?? DENSITY.PLA;
  const solidGrams = metrics.volumeCm3 * density;

  // Typical walls plus ~15% infill land well under solid; this is a blunt
  // single factor, which is why the UI calls it an estimate.
  const estimatedGrams = solidGrams * 0.45;

  // Extruded volume divided by a realistic sustained volumetric flow rate.
  // Order-of-magnitude only — it models neither travel moves nor acceleration.
  const flowMm3PerSec = 12;
  const estimatedMinutes = Math.max(1, Math.round((metrics.volumeCm3 * 1000 * 0.45) / flowMm3PerSec / 60));

  return {
    volumeCm3: metrics.volumeCm3,
    solidGrams,
    estimatedGrams,
    estimatedMinutes,
  };
}
