import { zipSync, strToU8 } from 'fflate';
import type { Mesh } from '../mesh/stl';
import type { PrinterProfile } from '../mesh/printability';

/**
 * Writes a 3MF from the compiled mesh.
 *
 * Two reasons this exists rather than shipping STL alone. First, 3MF is
 * millimetre-aware and de-duplicates vertices, so the same model is a fraction
 * of the size and cannot be misread at the wrong scale. Second, the container
 * carries Bambu's print settings alongside the geometry, so the file can open
 * ready to slice rather than ready to configure.
 *
 * A caveat worth stating plainly: Bambu Studio decides for itself whether to
 * trust a project profile that its own slicer did not write, and may fall back
 * to loading geometry only. The core geometry below is spec-compliant and opens
 * correctly in Bambu Studio, Orca, PrusaSlicer and Cura regardless; the settings
 * are a best effort on top of that, which is how the UI describes them.
 *
 * The `openscad-wasm` build links lib3mf but its 3MF exporter traps at runtime,
 * so the container is assembled here instead of asking OpenSCAD for it.
 */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="png" ContentType="image/png"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trim float noise; 3MF files are text and this roughly halves their size. */
function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function buildModelXml(mesh: Mesh, name: string): string {
  const { positions, triangleCount } = mesh;

  // STL repeats every shared vertex; 3MF indexes them. Deduplicating here is
  // what makes the 3MF meaningfully smaller than the STL it came from.
  const index = new Map<string, number>();
  const vertices: string[] = [];
  const triangles: string[] = [];

  const idFor = (x: number, y: number, z: number): number => {
    const k = `${num(x)},${num(y)},${num(z)}`;
    const existing = index.get(k);
    if (existing !== undefined) return existing;
    const id = vertices.length;
    index.set(k, id);
    vertices.push(`   <vertex x="${num(x)}" y="${num(y)}" z="${num(z)}"/>`);
    return id;
  };

  for (let t = 0; t < triangleCount; t += 1) {
    const o = t * 9;
    const v1 = idFor(positions[o], positions[o + 1], positions[o + 2]);
    const v2 = idFor(positions[o + 3], positions[o + 4], positions[o + 5]);
    const v3 = idFor(positions[o + 6], positions[o + 7], positions[o + 8]);
    // A degenerate triangle collapses to fewer than three distinct indices and
    // makes some slicers reject the whole object.
    if (v1 === v2 || v2 === v3 || v1 === v3) continue;
    triangles.push(`   <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
 <metadata name="Application">Boxed2Built Model Studio</metadata>
 <metadata name="Title">${escapeXml(name)}</metadata>
 <metadata name="Designer">Boxed2Built</metadata>
 <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>
 <resources>
  <object id="1" type="model">
   <mesh>
    <vertices>
${vertices.join('\n')}
    </vertices>
    <triangles>
${triangles.join('\n')}
    </triangles>
   </mesh>
  </object>
 </resources>
 <build>
  <item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
 </build>
</model>`;
}

/**
 * Bambu stores project settings as JSON with string-typed values. This is a
 * deliberately small subset — the settings an admin would otherwise set by hand
 * after opening the file.
 */
function buildProjectSettings(profile: PrinterProfile): string {
  return JSON.stringify(
    {
      from: 'project',
      version: '01.09.00.00',
      name: 'Boxed2Built Model Studio',
      printer_model: profile.printer,
      nozzle_diameter: [String(profile.nozzleMm)],
      layer_height: String(profile.layerHeightMm),
      first_layer_height: String(Math.max(profile.layerHeightMm, 0.2)),
      wall_loops: '3',
      top_shell_layers: '4',
      bottom_shell_layers: '3',
      sparse_infill_density: '15%',
      sparse_infill_pattern: 'grid',
      enable_support: profile.supportsAllowed ? '1' : '0',
      support_type: 'tree(auto)',
      brim_type: 'auto_brim',
      filament_type: [profile.material],
      filament_settings_id: [`${profile.material} Basic`],
    },
    null,
    1,
  );
}

function buildModelSettings(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="1">
    <metadata key="name" value="${escapeXml(name)}"/>
    <metadata key="extruder" value="1"/>
  </object>
</config>`;
}

export interface ThreeMfOptions {
  name: string;
  profile: PrinterProfile;
  /** PNG bytes shown as the project thumbnail in Bambu Studio's file browser. */
  thumbnail?: Uint8Array;
}

export function buildThreeMf(mesh: Mesh, options: ThreeMfOptions): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    '3D/3dmodel.model': strToU8(buildModelXml(mesh, options.name)),
    'Metadata/project_settings.config': strToU8(buildProjectSettings(options.profile)),
    'Metadata/model_settings.config': strToU8(buildModelSettings(options.name)),
  };

  if (options.thumbnail && options.thumbnail.length > 0) {
    files['Metadata/plate_1.png'] = options.thumbnail;
  }

  return zipSync(files, { level: 6 });
}
