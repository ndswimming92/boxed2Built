/**
 * Binary STL reader plus the geometry checks the studio reports on.
 *
 * Everything here is derived from the triangle list alone, so it is exact and
 * costs one pass: bounding box, triangle count, signed volume, and whether the
 * surface is closed. Estimates that are *not* exact (filament mass, print time)
 * live in `printability.ts` and are labelled as estimates in the UI.
 */

export interface Mesh {
  /** Flat xyz triples, 9 floats per triangle. */
  positions: Float32Array;
  triangleCount: number;
}

export interface MeshMetrics {
  triangleCount: number;
  bbox: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  /** Cubic centimetres of solid material at 100% infill. */
  volumeCm3: number;
  watertight: boolean;
  /** Edges used by only one triangle. Non-zero means holes in the surface. */
  openEdges: number;
  /** Share of surface area steeper than 45 degrees and facing down, 0-1. */
  overhangRatio: number;
  /** Steepest downward face angle from vertical, in degrees. */
  maxOverhangDeg: number;
  sitsOnBed: boolean;
}

const HEADER_BYTES = 80;
const TRIANGLE_BYTES = 50;

export function parseBinaryStl(bytes: Uint8Array): Mesh {
  if (bytes.length < HEADER_BYTES + 4) {
    throw new Error('Not a valid STL file');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(HEADER_BYTES, true);

  const expected = HEADER_BYTES + 4 + triangleCount * TRIANGLE_BYTES;
  if (triangleCount === 0 || bytes.length < expected) {
    throw new Error('STL file is truncated or contains no geometry');
  }

  const positions = new Float32Array(triangleCount * 9);
  let offset = HEADER_BYTES + 4;

  for (let i = 0; i < triangleCount; i += 1) {
    // Skip the stored normal; it is recomputed from winding order where needed
    // because exporters disagree about whether it is normalised.
    offset += 12;
    for (let v = 0; v < 9; v += 1) {
      positions[i * 9 + v] = view.getFloat32(offset, true);
      offset += 4;
    }
    offset += 2; // attribute byte count
  }

  return { positions, triangleCount };
}

/** Quantised vertex key, so edges shared between triangles actually match. */
function key(x: number, y: number, z: number): string {
  const q = (n: number) => Math.round(n * 1000) / 1000;
  return `${q(x)},${q(y)},${q(z)}`;
}

export function analyzeMesh(mesh: Mesh): MeshMetrics {
  const { positions, triangleCount } = mesh;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // First pass: bounds only. The bed plane has to be known before any face can
  // be classified, because the flat face a model rests on is downward-facing
  // but is emphatically not an overhang.
  for (let i = 0; i < triangleCount * 9; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  // One layer of tolerance: anything within this of the lowest point is first
  // layer, printed onto the plate.
  const bedPlane = minZ + 0.21;

  let signedVolume = 0;
  let downwardArea = 0;
  let overhangArea = 0;
  let maxOverhangDeg = 0;

  // Half-edge tally: a closed surface uses every edge exactly twice.
  const edges = new Map<string, number>();

  for (let t = 0; t < triangleCount; t += 1) {
    const o = t * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];

    // Signed volume of the tetrahedron from the origin to this face; summing
    // over a closed surface gives the enclosed volume.
    signedVolume +=
      (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    // Face normal from winding order.
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const doubleArea = Math.hypot(nx, ny, nz);

    // A face lying flat on the plate is supported by the plate itself.
    const onBed = az <= bedPlane && bz <= bedPlane && cz <= bedPlane;

    if (doubleArea > 0 && !onBed) {
      const area = doubleArea / 2;
      const unitZ = nz / doubleArea;
      if (unitZ < 0) {
        downwardArea += area;
        // Overhang measured from vertical: a wall is 0 degrees, a flat
        // downward face (a bridge) is 90.
        const deg = Math.asin(Math.min(1, -unitZ)) * (180 / Math.PI);
        if (deg > 45) overhangArea += area;
        if (deg > maxOverhangDeg) maxOverhangDeg = deg;
      }
    }

    const ka = key(ax, ay, az);
    const kb = key(bx, by, bz);
    const kc = key(cx, cy, cz);
    for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]]) {
      // Sort the pair so the same edge from either triangle hashes alike.
      const edge = p < q ? `${p}|${q}` : `${q}|${p}`;
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }

  let openEdges = 0;
  for (const count of edges.values()) {
    if (count !== 2) openEdges += 1;
  }

  return {
    triangleCount,
    bbox: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    volumeCm3: Math.abs(signedVolume) / 1000,
    watertight: openEdges === 0,
    openEdges,
    overhangRatio: downwardArea > 0 ? overhangArea / downwardArea : 0,
    maxOverhangDeg,
    // OpenSCAD models are authored at the origin; a gap under the model means
    // the slicer will drop it, which changes nothing, but a model *through* the
    // bed means the design escaped its intended half-space.
    sitsOnBed: minZ > -0.01,
  };
}
