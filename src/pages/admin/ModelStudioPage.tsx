import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  createModel,
  deleteModel,
  getActiveBusinessId,
  listModels,
} from '../../services/printModelService';
import type { PrintModel, PrintModelStatus } from '../../types/printModel';

const STATUS_STYLES: Record<PrintModelStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  ready: { label: 'Ready to print', className: 'bg-emerald-100 text-emerald-800' },
  archived: { label: 'Archived', className: 'bg-amber-100 text-amber-800' },
};

const STARTERS = [
  'A 4-bay drawer insert for hex bits, 120 x 80 x 30 mm',
  'A wall bracket for a 32 mm broom handle with two M4 countersunk holes',
  'A keychain that says BOXED2BUILT, 60 mm long and 3 mm thick',
  'A desk stand for a phone at a 60 degree angle with a cable slot',
];

const ModelStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [models, setModels] = useState<PrintModel[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [id, rows] = await Promise.all([getActiveBusinessId(), listModels()]);
      setBusinessId(id);
      setModels(rows);
    } catch (loadError) {
      console.error('Failed to load print models:', loadError);
      setError('Could not load the model library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return models;
    return models.filter(
      (model) =>
        model.name.toLowerCase().includes(term) ||
        model.prompt.toLowerCase().includes(term) ||
        (model.summary ?? '').toLowerCase().includes(term),
    );
  }, [models, search]);

  const readyCount = useMemo(
    () => models.filter((model) => model.status === 'ready').length,
    [models],
  );

  // The row is created here and the generation itself happens on the detail
  // page, so a long Claude call never blocks the library and the work is
  // recoverable by reloading rather than lost with the tab.
  const handleCreate = async (initialPrompt: string) => {
    const text = initialPrompt.trim();
    if (!text) {
      setError('Describe the part you want before generating.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const model = await createModel({
        businessId,
        name: 'Untitled model',
        prompt: text,
        summary: '',
      });
      navigate(`/admin/model-studio/${model.id}?autostart=1`);
    } catch (createError) {
      console.error('Failed to create print model:', createError);
      setError(createError instanceof Error ? createError.message : 'Could not start a new model.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (model: PrintModel) => {
    if (!window.confirm(`Delete "${model.name}" and all of its versions? This cannot be undone.`)) {
      return;
    }
    setBusyId(model.id);
    try {
      await deleteModel(model.id);
      showToast({ message: 'Model deleted', type: 'success' });
      load();
    } catch (deleteError) {
      console.error('Failed to delete print model:', deleteError);
      showToast({ message: 'Could not delete that model', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Model Studio</h1>
          <p className="mt-1 text-sm text-slate-600">
            Describe a part and Claude writes the parametric CAD for it. Compiles to a
            print-ready STL in your browser.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* New model */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label htmlFor="model-prompt" className="text-sm font-semibold text-slate-900">
          What do you want to print?
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <textarea
            id="model-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={2}
            placeholder="A stackable bin for M3 screws, 100 x 60 x 40 mm, with a label slot on the front"
            className="flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => handleCreate(prompt)}
            disabled={creating || !prompt.trim()}
            className="inline-flex h-fit items-center gap-2 self-start rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {creating ? 'Starting…' : 'Generate'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => setPrompt(starter)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
            >
              {starter}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Best at functional parts — organisers, brackets, enclosures, adapters, lettering.
          It writes real CAD, so it cannot sculpt figurines or organic shapes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Models" value={String(models.length)} icon={Boxes} />
        <StatCard label="Ready to print" value={String(readyCount)} icon={CheckCircle2} />
        <StatCard
          label="Drafts"
          value={String(models.filter((model) => model.status === 'draft').length)}
          icon={Plus}
        />
      </div>

      {/* Library */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Library</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search models"
              className="w-56 rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Boxes className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">
              {models.length === 0 ? 'No models yet' : 'Nothing matches that search'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {models.length === 0
                ? 'Describe a part above to generate your first one.'
                : 'Try a different term.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <Th>Model</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((model) => {
                  const status = STATUS_STYLES[model.status];
                  return (
                    <tr key={model.id} className="border-b border-slate-100 last:border-0">
                      <Td>
                        <Link
                          to={`/admin/model-studio/${model.id}`}
                          className="font-medium text-blue-800 hover:underline"
                        >
                          {model.name}
                        </Link>
                        <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                          {model.summary || model.prompt}
                        </p>
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-slate-600">
                          {new Date(model.updated_at).toLocaleDateString()}
                        </span>
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => handleDelete(model)}
                          disabled={busyId === model.id}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          title="Delete model"
                        >
                          {busyId === model.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="px-4 py-2 font-medium">{children}</th>
);

const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="px-4 py-3 align-top">{children}</td>
);

const StatCard: React.FC<{ label: string; value: string; icon: React.ElementType }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2 text-slate-500">
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export default ModelStudioPage;
