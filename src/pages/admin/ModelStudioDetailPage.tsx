import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Download,
  FileCode2,
  History,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Settings2,
  ShieldAlert,
  Sliders,
  Wand2,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import ModelViewer, { type ModelViewerHandle } from '../../components/admin/ModelViewer';
import { compileScad, disposeCompiler } from '../../lib/openscad/client';
import {
  applyParamValues,
  defaultParamValues,
  parseParameters,
  type ModelParameter,
  type ParamValue,
} from '../../lib/openscad/params';
import { analyzeMesh, parseBinaryStl, type Mesh, type MeshMetrics } from '../../lib/mesh/stl';
import {
  DEFAULT_PROFILE,
  PRINTER_PRESETS,
  estimate,
  runChecks,
  type PrinterProfile,
  type PrintCheck,
} from '../../lib/mesh/printability';
import { buildThreeMf } from '../../lib/threemf/write';
import { generateModel } from '../../services/modelStudioAIService';
import {
  createVersion,
  getModel,
  listVersions,
  setCurrentVersion,
  updateModel,
  uploadVersionFiles,
} from '../../services/printModelService';
import type { PrintModelVersion, PrintModelWithVersion } from '../../types/printModel';

/** A compile failure gets this many attempts at self-repair before giving up. */
const MAX_REPAIRS = 3;

type Tab = 'parameters' | 'source' | 'report' | 'history';

const ModelStudioDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const viewerRef = useRef<ModelViewerHandle>(null);

  const [model, setModel] = useState<PrintModelWithVersion | null>(null);
  const [versions, setVersions] = useState<PrintModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<PrinterProfile>(DEFAULT_PROFILE);
  const [source, setSource] = useState('');
  const [params, setParams] = useState<ModelParameter[]>([]);
  const [values, setValues] = useState<Record<string, ParamValue>>({});
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [metrics, setMetrics] = useState<MeshMetrics | null>(null);
  const [stlBytes, setStlBytes] = useState<Uint8Array | null>(null);
  const [printNotes, setPrintNotes] = useState('');

  const [tab, setTab] = useState<Tab>('parameters');
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [dirty, setDirty] = useState(false);
  // What the last Claude turn actually cost and how it got here. Saving a
  // version without this loses the spend for the most expensive Claude surface
  // in the app, which is exactly what /admin/claude-usage is meant to show.
  const [lastGeneration, setLastGeneration] = useState<{
    claudeModel: string;
    inputTokens: number;
    outputTokens: number;
    refinePrompt: string | null;
    repairAttempts: number;
  } | null>(null);

  // The worker holds a 14 MB WASM module; drop it when leaving the studio.
  useEffect(() => () => disposeCompiler(), []);

  const applyVersion = useCallback((version: PrintModelVersion) => {
    setSource(version.scad_source);
    const parsed = version.parameters.length > 0 ? version.parameters : parseParameters(version.scad_source);
    setParams(parsed);
    setValues(
      Object.keys(version.param_values).length > 0
        ? version.param_values
        : defaultParamValues(parsed),
    );
    setPrintNotes(version.metrics?.printNotes ?? '');
    if (version.print_profile && Object.keys(version.print_profile).length > 0) {
      setProfile({ ...DEFAULT_PROFILE, ...version.print_profile });
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, versionRows] = await Promise.all([getModel(id), listVersions(id)]);
      if (!record) {
        setError('That model no longer exists.');
        return;
      }
      setModel(record);
      setVersions(versionRows);
      if (record.current_version) applyVersion(record.current_version);
    } catch (loadError) {
      console.error('Failed to load print model:', loadError);
      setError('Could not load this model.');
    } finally {
      setLoading(false);
    }
  }, [id, applyVersion]);

  useEffect(() => {
    load();
  }, [load]);

  /** Compiles locally. No Claude call, so sliders are free to drag. */
  const compile = useCallback(
    async (
      scad: string,
      paramValues: Record<string, ParamValue>,
    ): Promise<{
      ok: boolean;
      error?: string;
      mesh?: Mesh;
      metrics?: MeshMetrics;
      stl?: Uint8Array;
    }> => {
      setCompiling(true);
      setCompileError(null);
      try {
        const result = await compileScad(scad, { paramValues });
        if (!result.ok) {
          setCompileError(result.error);
          setMesh(null);
          setMetrics(null);
          setStlBytes(null);
          return { ok: false, error: result.error };
        }
        const parsedMesh = parseBinaryStl(result.stl);
        const meshMetrics = analyzeMesh(parsedMesh);
        setMesh(parsedMesh);
        setMetrics(meshMetrics);
        setStlBytes(result.stl);
        return { ok: true, mesh: parsedMesh, metrics: meshMetrics, stl: result.stl };
      } catch (compileFailure) {
        const message =
          compileFailure instanceof Error ? compileFailure.message : 'Compile failed';
        setCompileError(message);
        return { ok: false, error: message };
      } finally {
        setCompiling(false);
      }
    },
    [],
  );

  /**
   * Writes a version row and uploads its files.
   *
   * Everything is passed in explicitly rather than read from state because the
   * generation path calls this the moment a compile succeeds, before React has
   * committed those updates. Persisting there rather than waiting for a Save
   * click is the point: a generation costs about a minute and real money, and
   * losing it to a page refresh is not an acceptable failure mode.
   */
  const persistVersion = useCallback(
    async (args: {
      scad: string;
      parameters: ModelParameter[];
      paramValues: Record<string, ParamValue>;
      mesh: Mesh;
      metrics: MeshMetrics;
      stl: Uint8Array;
      notes: string;
      modelName: string;
      generation: typeof lastGeneration;
      capturePreview: boolean;
    }) => {
      if (!id) return null;

      const resolvedSource = applyParamValues(args.scad, args.paramValues);
      const version = await createVersion({
        modelId: id,
        parentVersionId: model?.current_version?.id ?? null,
        // Save what actually compiled, sliders included, so re-opening a version
        // reproduces the exact geometry rather than the defaults.
        scadSource: resolvedSource,
        parameters: args.parameters,
        paramValues: args.paramValues,
        refinePrompt: args.generation?.refinePrompt ?? null,
        claudeModel: args.generation?.claudeModel ?? null,
        inputTokens: args.generation?.inputTokens ?? 0,
        outputTokens: args.generation?.outputTokens ?? 0,
        compileStatus: 'ok',
        compileError: null,
        repairAttempts: args.generation?.repairAttempts ?? 0,
        metrics: { ...args.metrics, printNotes: args.notes },
        profile,
      });

      // The thumbnail is best-effort: the canvas may not have painted the new
      // mesh yet on an auto-save, and a missing preview must never cost the
      // version itself.
      const preview = args.capturePreview
        ? await viewerRef.current?.capture().catch(() => null)
        : null;

      await uploadVersionFiles({
        modelId: id,
        version,
        stl: args.stl,
        threeMf: buildThreeMf(args.mesh, { name: args.modelName, profile }),
        scadSource: resolvedSource,
        preview: preview ?? null,
      });

      return version;
    },
    [id, model, profile],
  );

  /**
   * Generate (or refine) with Claude, then compile. A compile failure is fed
   * straight back to Claude with the compiler output rather than being shown to
   * the admin as a dead end — that repair loop is what makes a one-shot CAD
   * generator usable rather than a coin flip.
   */
  const runGeneration = useCallback(
    async (mode: 'create' | 'refine', instruction: string) => {
      if (!id || !model) return;
      setGenerating(true);
      setError(null);
      setCompileError(null);

      let scad = '';
      let generated: Awaited<ReturnType<typeof generateModel>> | null = null;
      let repairs = 0;
      let lastCompileError: string | null = null;

      try {
        setStatus(mode === 'create' ? 'Designing the part…' : 'Applying your changes…');
        generated = await generateModel({
          mode,
          prompt: instruction,
          scadSource: mode === 'refine' ? source : undefined,
          profile,
        });
        scad = generated.model.scadSource;

        // Parameters are read from the Customizer annotations in the source
        // rather than restated by the model - one source of truth, and it keeps
        // the generation short enough to finish inside the worker's budget.
        let parsed = parseParameters(scad);
        let paramValues = defaultParamValues(parsed);

        setStatus('Compiling the model…');
        let result = await compile(scad, paramValues);

        while (!result.ok && repairs < MAX_REPAIRS) {
          repairs += 1;
          lastCompileError = result.error ?? null;
          setStatus(`Fixing a compile error (attempt ${repairs} of ${MAX_REPAIRS})…`);
          const repaired = await generateModel({
            mode: 'repair',
            scadSource: scad,
            compileError: result.error,
            profile,
          });
          scad = repaired.model.scadSource;
          parsed = parseParameters(scad);
          paramValues = defaultParamValues(parsed);
          generated = {
            model: { ...repaired.model, name: generated.model.name, summary: generated.model.summary },
            usage: {
              claudeModel: repaired.usage.claudeModel,
              inputTokens: generated.usage.inputTokens + repaired.usage.inputTokens,
              outputTokens: generated.usage.outputTokens + repaired.usage.outputTokens,
              cacheReadTokens: generated.usage.cacheReadTokens + repaired.usage.cacheReadTokens,
            },
          };
          setStatus('Compiling the repaired model…');
          result = await compile(scad, paramValues);
        }

        const generation = {
          claudeModel: generated.usage.claudeModel,
          inputTokens: generated.usage.inputTokens,
          outputTokens: generated.usage.outputTokens,
          refinePrompt: mode === 'refine' ? instruction : null,
          repairAttempts: repairs,
        };

        setSource(scad);
        setParams(parsed);
        setValues(paramValues);
        setPrintNotes(generated.model.printNotes);
        setLastGeneration(generation);

        if (!result.ok) {
          setDirty(true);
          setError(
            `The model still would not compile after ${MAX_REPAIRS} repair attempts. Try rewording the request or simplifying it.`,
          );
          showToast({ message: 'Could not produce a compiling model', type: 'error' });
          return;
        }

        const modelName =
          mode === 'create' && model.name === 'Untitled model'
            ? generated.model.name
            : model.name;

        if (mode === 'create' && model.name === 'Untitled model') {
          await updateModel(id, {
            name: generated.model.name,
            summary: generated.model.summary,
          });
        }

        // Persist immediately. A generation is roughly a minute of waiting and
        // a real API charge; making it survive only until the tab reloads was
        // the wrong trade, and there is nothing here the admin needs to approve
        // before it is worth keeping.
        setStatus('Saving…');
        try {
          if (result.mesh && result.metrics && result.stl) {
            await persistVersion({
              scad,
              parameters: parsed,
              paramValues,
              mesh: result.mesh,
              metrics: result.metrics,
              stl: result.stl,
              notes: generated.model.printNotes,
              modelName,
              generation,
              // The canvas has not painted this mesh yet; the thumbnail is
              // filled in by an explicit Save later.
              capturePreview: false,
            });
          }
          setDirty(false);
        } catch (saveError) {
          // A failed upload must not discard a model the admin can still see,
          // export and save by hand.
          console.error('Could not auto-save the generated version:', saveError);
          setDirty(true);
          showToast({
            message: 'Model built, but saving it failed — use Save version to retry',
            type: 'warning',
          });
        }

        await load();

        showToast({
          message: repairs > 0 ? `Model built (self-repaired ${repairs}x)` : 'Model built',
          type: 'success',
        });
        setRefinePrompt('');
        if (lastCompileError) {
          setStatus(`Recovered from: ${lastCompileError.split('\n')[0]}`);
        } else {
          setStatus(null);
        }
      } catch (generationError) {
        console.error('Model generation failed:', generationError);
        const message =
          generationError instanceof Error ? generationError.message : 'Model generation failed';
        setError(message);
        showToast({ message, type: 'error' });
        setStatus(null);
      } finally {
        setGenerating(false);
      }
    },
    [id, model, source, profile, compile, showToast, persistVersion, load],
  );

  // Kick off the first generation when arriving straight from the library.
  const autostart = searchParams.get('autostart') === '1';
  useEffect(() => {
    if (!autostart || loading || !model || generating || source) return;
    setSearchParams({}, { replace: true });
    runGeneration('create', model.prompt);
    // runGeneration is stable enough for this one-shot; re-running on identity
    // changes would fire a second paid generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, loading, model, generating, source]);

  const handleParamChange = (name: string, value: ParamValue) => {
    setValues((current) => ({ ...current, [name]: value }));
    setDirty(true);
  };

  /**
   * Choosing a different piece recompiles straight away. A dimension slider
   * waits for Recompile because dragging one fires a burst of changes, but a
   * selector is a single deliberate switch and the compile is local and free.
   */
  const handleSelectorChange = (name: string, value: ParamValue) => {
    const next = { ...values, [name]: value };
    setValues(next);
    setDirty(true);
    if (source) compile(source, next);
  };

  const handleRecompile = () => {
    if (!source) return;
    compile(source, values);
  };

  const handleSave = async () => {
    if (!id || !model || !stlBytes || !mesh || !metrics) return;
    setSaving(true);
    try {
      const version = await persistVersion({
        scad: source,
        parameters: params,
        paramValues: values,
        mesh,
        metrics,
        stl: stlBytes,
        notes: printNotes,
        modelName: model.name,
        generation: lastGeneration,
        capturePreview: true,
      });
      if (!version) return;

      showToast({ message: `Saved as v${version.version}`, type: 'success' });
      setDirty(false);
      load();
    } catch (saveError) {
      console.error('Failed to save version:', saveError);
      showToast({
        message: saveError instanceof Error ? saveError.message : 'Could not save this version',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const download = (bytes: BlobPart, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const safeName = (model?.name ?? 'model').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  const checks: PrintCheck[] = useMemo(
    () => (metrics ? runChecks(metrics, profile, params, values) : []),
    [metrics, profile, params, values],
  );
  const estimates = useMemo(() => (metrics ? estimate(metrics, profile) : null), [metrics, profile]);

  // A dropdown selects which piece to build; a slider changes its size. The
  // first is a mode switch that decides what the whole page is showing, so it
  // is pinned above the tabs rather than left to scroll away among the
  // dimensions.
  const selectorParams = useMemo(
    () => params.filter((param) => param.type === 'string' && (param.options?.length ?? 0) > 0),
    [params],
  );

  const grouped = useMemo(() => {
    const sections = new Map<string, ModelParameter[]>();
    for (const param of params) {
      if (param.type === 'string' && (param.options?.length ?? 0) > 0) continue;
      const list = sections.get(param.section) ?? [];
      list.push(param);
      sections.set(param.section, list);
    }
    return Array.from(sections.entries());
  }, [params]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="space-y-4">
        <Link to="/admin/model-studio" className="inline-flex items-center gap-1.5 text-sm text-blue-800 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Model Studio
        </Link>
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error ?? 'Model not found.'}</span>
        </div>
      </div>
    );
  }

  const busy = generating || compiling;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/model-studio"
            className="inline-flex items-center gap-1.5 text-sm text-blue-800 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Model Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{model.name}</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-600">{model.summary || model.prompt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !stlBytes || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : dirty ? 'Save version' : 'Saved'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status && !error && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{status}</span>
        </div>
      )}

      {compileError && !busy && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">The model did not compile</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{compileError}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Viewer + refine */}
        <div className="space-y-4">
          {!source && !busy ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <Wand2 className="h-9 w-9 text-slate-300" />
              <div>
                <p className="font-semibold text-slate-800">This model has not been built yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{model.prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => runGeneration('create', model.prompt)}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                <Wand2 className="h-4 w-4" /> Generate model
              </button>
              <p className="text-xs text-slate-400">Takes about a minute.</p>
            </div>
          ) : (
            <div className="h-[55vh] min-h-[320px] max-h-[560px]">
              <ModelViewer
                ref={viewerRef}
                mesh={mesh}
                bedX={profile.bedX}
                bedY={profile.bedY}
                busy={busy}
              />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="refine" className="text-sm font-semibold text-slate-900">
              Change something
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="refine"
                value={refinePrompt}
                onChange={(event) => setRefinePrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && refinePrompt.trim() && !busy) {
                    runGeneration('refine', refinePrompt);
                  }
                }}
                placeholder="Make the walls 3 mm and add a chamfer to the bottom edge"
                disabled={!source || busy}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => runGeneration('refine', refinePrompt)}
                disabled={!source || busy || !refinePrompt.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Apply
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Rewrites the CAD with Claude. To change a dimension you already have a slider for,
              use the Parameters tab instead — that recompiles locally and costs nothing.
            </p>
          </div>

          {/* Exports */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Export</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => stlBytes && download(stlBytes.slice(), `${safeName}.stl`, 'model/stl')}
                disabled={!stlBytes}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> STL
              </button>
              <button
                type="button"
                onClick={() =>
                  mesh &&
                  download(
                    buildThreeMf(mesh, { name: model.name, profile }),
                    `${safeName}.3mf`,
                    'model/3mf',
                  )
                }
                disabled={!mesh}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Box className="h-4 w-4" /> 3MF for Bambu Studio
              </button>
              <button
                type="button"
                onClick={() =>
                  source && download(applyParamValues(source, values), `${safeName}.scad`, 'text/plain')
                }
                disabled={!source}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <FileCode2 className="h-4 w-4" /> OpenSCAD source
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              The 3MF carries your printer, layer height and filament settings. Bambu Studio
              decides whether to trust a profile it did not write, so it may load geometry only —
              the model itself always opens correctly.
            </p>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Which piece to build. Sticky because it decides what the viewer,
              the report and every export refer to - scrolling to a slider
              should never cost sight of it. */}
          {selectorParams.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 lg:sticky lg:top-4 lg:z-10">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-700" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {selectorParams.length === 1 ? selectorParams[0].section || 'Part' : 'Parts'}
                </h2>
              </div>
              <div className="mt-3 space-y-3">
                {selectorParams.map((param) => (
                  <div key={param.name}>
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      {param.label}
                    </span>
                    <select
                      value={String(values[param.name] ?? param.default)}
                      onChange={(event) => handleSelectorChange(param.name, event.target.value)}
                      disabled={busy}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                    >
                      {(param.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {compiling
                  ? 'Rebuilding…'
                  : 'Switching rebuilds the preview instantly. Export each piece separately.'}
              </p>
            </div>
          )}

          {/* Printer profile */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Print profile</h2>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Printer">
                <select
                  value={profile.printer}
                  onChange={(event) => {
                    const preset = PRINTER_PRESETS[event.target.value];
                    if (preset) setProfile((current) => ({ ...current, ...preset }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {Object.keys(PRINTER_PRESETS).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nozzle (mm)">
                  <input
                    type="number"
                    step="0.1"
                    value={profile.nozzleMm}
                    onChange={(event) =>
                      setProfile((c) => ({ ...c, nozzleMm: Number(event.target.value) || 0.4 }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </Field>
                <Field label="Layer (mm)">
                  <input
                    type="number"
                    step="0.02"
                    value={profile.layerHeightMm}
                    onChange={(event) =>
                      setProfile((c) => ({ ...c, layerHeightMm: Number(event.target.value) || 0.2 }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </Field>
              </div>
              <Field label="Material">
                <select
                  value={profile.material}
                  onChange={(event) => setProfile((c) => ({ ...c, material: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA'].map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={profile.supportsAllowed}
                  onChange={(event) =>
                    setProfile((c) => ({ ...c, supportsAllowed: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Supports allowed
              </label>
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex border-b border-slate-200 text-sm">
              {([
                ['parameters', 'Parameters', Sliders],
                ['report', 'Report', CheckCircle2],
                ['source', 'Source', FileCode2],
                ['history', 'History', History],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 font-medium transition ${
                    tab === key
                      ? 'border-b-2 border-blue-700 text-blue-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="max-h-[520px] overflow-y-auto p-4">
              {tab === 'parameters' && (
                <div className="space-y-4">
                  {params.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No parameters yet. Generate a model to get sliders.
                    </p>
                  ) : grouped.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      This model is controlled entirely by the part selector above.
                    </p>
                  ) : (
                    <>
                      {grouped.map(([section, list]) => (
                        <div key={section}>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {section}
                          </h3>
                          <div className="mt-2 space-y-3">
                            {list.map((param) => (
                              <ParamControl
                                key={param.name}
                                param={param}
                                value={values[param.name] ?? param.default}
                                onChange={handleParamChange}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleRecompile}
                        disabled={compiling || generating}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        {compiling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {compiling ? 'Compiling…' : 'Recompile'}
                      </button>
                      <p className="text-center text-xs text-slate-500">
                        Runs in your browser. No Claude call, no cost.
                      </p>
                    </>
                  )}
                </div>
              )}

              {tab === 'report' && (
                <div className="space-y-4">
                  {!metrics ? (
                    <p className="text-sm text-slate-500">Compile a model to see the report.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {checks.map((check) => (
                          <div key={check.id} className="flex items-start gap-2 text-sm">
                            <span
                              className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                                check.level === 'pass'
                                  ? 'bg-emerald-500'
                                  : check.level === 'warn'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              }`}
                            />
                            <div>
                              <p className="font-medium text-slate-800">{check.label}</p>
                              <p className="text-xs text-slate-600">{check.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {estimates && (
                        <div className="rounded-lg bg-slate-50 p-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Material
                          </h3>
                          <dl className="mt-2 space-y-1 text-sm">
                            <Row label="Solid volume" value={`${estimates.volumeCm3.toFixed(1)} cm³`} />
                            <Row label="At 100% infill" value={`${estimates.solidGrams.toFixed(0)} g`} />
                            <Row
                              label="Rough estimate"
                              value={`~${estimates.estimatedGrams.toFixed(0)} g · ~${estimates.estimatedMinutes} min`}
                            />
                          </dl>
                          <p className="mt-2 text-xs text-slate-500">
                            Volume and mass at 100% infill are exact. The last row assumes typical
                            walls and 15% infill — treat it as a ballpark, not slicer output.
                          </p>
                        </div>
                      )}

                      {printNotes && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Print notes
                          </h3>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{printNotes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === 'source' && (
                <div>
                  {source ? (
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                      <code>{applyParamValues(source, values)}</code>
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-500">No source yet.</p>
                  )}
                </div>
              )}

              {tab === 'history' && (
                <div className="space-y-2">
                  {versions.length === 0 ? (
                    <p className="text-sm text-slate-500">Nothing saved yet.</p>
                  ) : (
                    versions.map((version) => (
                      <div
                        key={version.id}
                        className={`rounded-lg border p-3 text-sm ${
                          model.current_version_id === version.id
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900">v{version.version}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(version.created_at).toLocaleString()}
                          </span>
                        </div>
                        {version.refine_prompt && (
                          <p className="mt-1 text-xs text-slate-600">{version.refine_prompt}</p>
                        )}
                        {model.current_version_id !== version.id && (
                          <button
                            type="button"
                            onClick={async () => {
                              await setCurrentVersion(model.id, version.id);
                              applyVersion(version);
                              await compile(version.scad_source, version.param_values);
                              showToast({ message: `Restored v${version.version}`, type: 'success' });
                              load();
                            }}
                            className="mt-2 text-xs font-medium text-blue-800 hover:underline"
                          >
                            Restore this version
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between">
    <dt className="text-slate-600">{label}</dt>
    <dd className="font-medium text-slate-900">{value}</dd>
  </div>
);

const ParamControl: React.FC<{
  param: ModelParameter;
  value: ParamValue;
  onChange: (name: string, value: ParamValue) => void;
}> = ({ param, value, onChange }) => {
  if (param.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(param.name, event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        {param.label}
      </label>
    );
  }

  if (param.type === 'string') {
    return (
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">{param.label}</span>
        {param.options && param.options.length > 0 ? (
          <select
            value={String(value)}
            onChange={(event) => onChange(param.name, event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {param.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={String(value)}
            onChange={(event) => onChange(param.name, event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>
    );
  }

  const hasRange = param.min !== undefined && param.max !== undefined;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600">{param.label}</span>
        <span className="text-xs font-semibold text-slate-900">{String(value)}</span>
      </div>
      <div className="flex items-center gap-2">
        {hasRange && (
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step ?? 0.1}
            value={Number(value)}
            onChange={(event) => onChange(param.name, Number(event.target.value))}
            className="flex-1 accent-blue-700"
          />
        )}
        <input
          type="number"
          step={param.step ?? 0.1}
          value={Number(value)}
          onChange={(event) => onChange(param.name, Number(event.target.value))}
          className={`rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none ${hasRange ? 'w-20' : 'w-full'}`}
        />
      </div>
    </div>
  );
};

export default ModelStudioDetailPage;
