import React, { useEffect, useState } from 'react';
import PortalLayout from '../../components/portal/PortalLayout';
import {
  customerPortalService,
  PortalServiceError,
  type CustomerPortalDocument,
  type DocumentAccessMode,
} from '../../services/customerPortalService';
import { useNavigate } from 'react-router-dom';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');

export default function PortalDocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<CustomerPortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await customerPortalService.getMyDocuments();
        setDocuments(data);
      } catch (err) {
        if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
          navigate('/portal/login?error=session_expired', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load documents.');
      } finally {
        setLoading(false);
      }
    };

    void loadDocuments();
  }, [navigate]);

  const openDocument = async (documentId: string, mode: DocumentAccessMode) => {
    setActiveDocumentId(documentId);
    try {
      const signedUrl = await customerPortalService.getDocumentSignedUrl(documentId, mode);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open document.');
    } finally {
      setActiveDocumentId(null);
    }
  };

  return (
    <PortalLayout title="My Documents" subtitle="Secure document vault with short-lived access links">
      {loading ? <p className="text-sm text-slate-600">Loading documents...</p> : null}
      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error && documents.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No documents are available yet.</div>
      ) : null}

      {!loading && !error && documents.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Related</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Retention Ends</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{doc.display_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize">{doc.document_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {doc.related_invoice_id ? `Invoice ${doc.related_invoice_id.slice(0, 8)}` : null}
                    {doc.related_job_id ? `Job ${doc.related_job_id.slice(0, 8)}` : null}
                    {!doc.related_invoice_id && !doc.related_job_id ? '—' : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(doc.delete_after_at)}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void openDocument(doc.id, 'view')}
                        disabled={activeDocumentId === doc.id}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => void openDocument(doc.id, 'download')}
                        disabled={activeDocumentId === doc.id}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                      >
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PortalLayout>
  );
}
