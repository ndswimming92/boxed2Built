import { useState, useEffect } from 'react';
import { GitMerge, AlertTriangle, ArrowRight, Briefcase, Receipt, Mail, FileText, StickyNote, Loader2 } from 'lucide-react';
import Modal from '../Modal';
import { type Client, mergeClients, getMergePreviewCounts } from '../../services/clientService';

interface MergeClientsModalProps {
  clientA: Client;
  clientB: Client;
  onClose: () => void;
  onMerged: () => void;
}

interface PreviewCounts {
  jobs: number;
  invoices: number;
  inquiries: number;
  notes: number;
}

export default function MergeClientsModal({ clientA, clientB, onClose, onMerged }: MergeClientsModalProps) {
  const [keepClientId, setKeepClientId] = useState<string | null>(null);
  const [countsA, setCountsA] = useState<PreviewCounts | null>(null);
  const [countsB, setCountsB] = useState<PreviewCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const keepClient = keepClientId === clientA.id ? clientA : keepClientId === clientB.id ? clientB : null;
  const discardClient = keepClientId === clientA.id ? clientB : keepClientId === clientB.id ? clientA : null;
  const discardCounts = keepClientId === clientA.id ? countsB : keepClientId === clientB.id ? countsA : null;

  useEffect(() => {
    async function loadCounts() {
      setLoadingCounts(true);
      try {
        const [a, b] = await Promise.all([
          getMergePreviewCounts(clientA.id),
          getMergePreviewCounts(clientB.id),
        ]);
        setCountsA(a);
        setCountsB(b);
      } catch {
        setError('Failed to load client data.');
      } finally {
        setLoadingCounts(false);
      }
    }
    loadCounts();
  }, [clientA.id, clientB.id]);

  async function handleMerge() {
    if (!keepClientId || !discardClient) return;
    setMerging(true);
    setError(null);
    try {
      await mergeClients(keepClientId, discardClient.id);
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed. Please try again.');
    } finally {
      setMerging(false);
    }
  }

  function formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }

  function renderClientCard(client: Client, counts: PreviewCounts | null, side: 'left' | 'right') {
    const isSelected = keepClientId === client.id;
    const isDiscarded = keepClientId !== null && keepClientId !== client.id;

    return (
      <div className={`flex-1 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-green-500 bg-green-50/50 ring-2 ring-green-200'
          : isDiscarded
          ? 'border-red-300 bg-red-50/30 opacity-75'
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}>
        {/* Status banner */}
        {keepClientId && (
          <div className={`px-4 py-1.5 text-xs font-bold text-center uppercase tracking-wider ${
            isSelected ? 'bg-green-500 text-white' : 'bg-red-400 text-white'
          }`}>
            {isSelected ? 'Keeping' : 'Will Be Merged'}
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Name & basic info */}
          <div>
            <h3 className="text-lg font-bold text-gray-900">{client.name}</h3>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 text-gray-400 text-center text-xs font-bold">#</span>
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <p className="text-xs text-gray-500 mt-1">{client.address}</p>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(client.total_revenue)}</p>
            </div>
            <div className="p-2.5 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Jobs</p>
              <p className="text-sm font-bold text-gray-900">{client.job_count}</p>
            </div>
            <div className="p-2.5 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-bold text-gray-900 capitalize">{client.client_status}</p>
            </div>
            <div className="p-2.5 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Since</p>
              <p className="text-sm font-bold text-gray-900">{formatDate(client.first_contact_date || client.created_at)}</p>
            </div>
          </div>

          {/* Record counts */}
          {counts && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                <Briefcase className="w-3 h-3" />{counts.jobs} jobs
              </span>
              <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md">
                <Receipt className="w-3 h-3" />{counts.invoices} invoices
              </span>
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-md">
                <FileText className="w-3 h-3" />{counts.inquiries} inquiries
              </span>
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-md">
                <StickyNote className="w-3 h-3" />{counts.notes} notes
              </span>
            </div>
          )}

          {/* Action button */}
          {!keepClientId && (
            <button
              onClick={() => setKeepClientId(client.id)}
              disabled={loadingCounts}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 transition-colors"
            >
              Keep This Client
            </button>
          )}
          {isSelected && (
            <button
              onClick={() => { setKeepClientId(null); setConfirmed(false); }}
              className="w-full mt-2 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Change Selection
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Merge Clients" size="large">
      <div className="space-y-6">
        {/* Explanation */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <GitMerge className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Select which client to keep. All records from the other client will be transferred to the kept one, and the duplicate will be permanently deleted.
            </p>
          </div>
        </div>

        {/* Side-by-side comparison */}
        {loadingCounts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {renderClientCard(clientA, countsA, 'left')}
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            {renderClientCard(clientB, countsB, 'right')}
          </div>
        )}

        {/* Transfer summary when selection is made */}
        {keepClient && discardClient && discardCounts && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{discardCounts.jobs} jobs</span>,{' '}
              <span className="font-semibold">{discardCounts.invoices} invoices</span>,{' '}
              <span className="font-semibold">{discardCounts.inquiries} inquiries</span>, and{' '}
              <span className="font-semibold">{discardCounts.notes} notes</span>{' '}
              from <span className="font-semibold">{discardClient.name}</span> will be transferred to{' '}
              <span className="font-semibold">{keepClient.name}</span>.
              {discardClient.email && !keepClient.email && (
                <> The email <span className="font-semibold">{discardClient.email}</span> will also be carried over.</>
              )}
            </p>
          </div>
        )}

        {/* Confirmation */}
        {keepClient && discardClient && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <p className="text-sm font-medium text-red-900">
                This action cannot be undone. The client record for "{discardClient.name}" will be permanently deleted after transferring all associated data.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-red-800 font-medium">
                  I understand this is permanent and want to proceed
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={merging}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!keepClientId || !confirmed || merging}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {merging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                Merge Clients
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
