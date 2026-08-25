/**
 * Test harness for the Model Studio rendering pipeline.
 *
 * The studio page itself sits behind an admin auth guard, which a smoke test
 * cannot get through without real credentials. Everything that has actually
 * broken in this feature, though, lives below that guard: the OpenSCAD worker,
 * the mesh analysis, the 3MF writer and the three.js canvas. This mounts those
 * real modules — not copies — so the tests exercise shipped code.
 *
 * Not part of the app build. Vite only emits the entries it is given, and this
 * page is reachable only from the dev server.
 */
import React, { useCallback, useRef, useState } from 'react';
// The viewer sizes itself with Tailwind utilities, so the harness has to load
// the same stylesheet the app does or there is no layout to fill.
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import ModelViewer, { type ModelViewerHandle } from '../../src/components/admin/ModelViewer';
import { compileScad } from '../../src/lib/openscad/client';
import { analyzeMesh, parseBinaryStl, type Mesh, type MeshMetrics } from '../../src/lib/mesh/stl';
import { buildThreeMf } from '../../src/lib/threemf/write';
import { unzipSync, strFromU8 } from 'fflate';
import { DEFAULT_PROFILE } from '../../src/lib/mesh/printability';
import {
  parseParameters,
  partScopedHiddenParams,
  type ParamValue,
} from '../../src/lib/openscad/params';

interface CompileOutcome {
  ok: boolean;
  error?: string;
  metrics?: MeshMetrics;
  paramNames?: string[];
  stlBytes?: number;
  threeMfBytes?: number;
  threeMfEntries?: string[];
  threeMfModelXml?: string;
  threeMfVertexCount?: number;
}

declare global {
  interface Window {
    __harness: {
      compile: (source: string, params?: Record<string, ParamValue>) => Promise<CompileOutcome>;
      setBed: (x: number, y: number) => void;
      clear: () => void;
      hiddenParams: (source: string, values: Record<string, ParamValue>) => string[];
    };
  }
}

function Harness() {
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [bed, setBed] = useState({ x: DEFAULT_PROFILE.bedX, y: DEFAULT_PROFILE.bedY });
  const viewerRef = useRef<ModelViewerHandle>(null);

  const compile = useCallback(
    async (source: string, params: Record<string, ParamValue> = {}): Promise<CompileOutcome> => {
      const result = await compileScad(source, { paramValues: params });
      if (!result.ok) {
        setMesh(null);
        return { ok: false, error: result.error };
      }
      const parsed = parseBinaryStl(result.stl);
      setMesh(parsed);

      const threeMf = buildThreeMf(parsed, { name: 'Harness', profile: DEFAULT_PROFILE });
      const unzipped = unzipSync(threeMf);
      const modelXml = strFromU8(unzipped['3D/3dmodel.model']);

      return {
        ok: true,
        metrics: analyzeMesh(parsed),
        paramNames: parseParameters(source).map((param) => param.name),
        stlBytes: result.stl.length,
        threeMfBytes: threeMf.length,
        threeMfEntries: Object.keys(unzipped),
        threeMfModelXml: modelXml,
        threeMfVertexCount: (modelXml.match(/<vertex /g) ?? []).length,
      };
    },
    [],
  );

  window.__harness = {
    compile,
    setBed: (x, y) => setBed({ x, y }),
    clear: () => setMesh(null),
    hiddenParams: (source, paramValues) =>
      Array.from(partScopedHiddenParams(parseParameters(source), paramValues)).sort(),
  };

  return (
    <div id="viewer">
      <ModelViewer ref={viewerRef} mesh={mesh} bedX={bed.x} bedY={bed.y} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
