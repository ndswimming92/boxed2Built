import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type QueueItem = {
  id: string;
  candidate_email: string | null;
  reason: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'resolved' | 'ignored';
  created_at: string;
};

export default function AccountLinkReviewQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('customer_identity_review_queue')
      .select('id, candidate_email, reason, payload, status, created_at')
      .eq('status', 'pending')
      .eq('reason', 'ambiguous_portal_account_match')
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as QueueItem[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateStatus = async (id: string, status: 'resolved' | 'ignored') => {
    const { error: updateError } = await supabase
      .from('customer_identity_review_queue')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Link Review Queue</h1>
        <p className="text-sm text-slate-600">Review ambiguous customer matches from portal first-login account-link requests.</p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading review queue...</p> : null}
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Candidate customer IDs</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No ambiguous account-link requests pending review.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const candidateIds = Array.isArray(item.payload?.candidate_customer_ids)
                    ? (item.payload.candidate_customer_ids as unknown[]).join(', ')
                    : 'N/A';

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-700">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-700">{item.candidate_email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{candidateIds}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void updateStatus(item.id, 'resolved')}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Mark resolved
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStatus(item.id, 'ignored')}
                            className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300"
                          >
                            Ignore
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
