import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { supabase, Invoice } from '../../lib/supabase';
import {
  previewInvoiceEmail,
  sendInvoiceEmailTest,
} from '../../services/clientEmailService';
import EmailPreviewActions from './EmailPreviewActions';

interface InvoiceEmailPreviewModalProps {
  invoice: Invoice;
  onClose: () => void;
}

/**
 * The email a client receives for one invoice, opened from the Invoices list.
 *
 * Same preview the client profile shows — rendered by send-invoice-email itself,
 * so a styling change to that template shows up here without a second copy to
 * keep in step. Nothing is sent to the client from here; "Send test to me"
 * mails the admin's own inbox.
 */
export default function InvoiceEmailPreviewModal({ invoice, onClose }: InvoiceEmailPreviewModalProps) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // The send function scopes by client and organization; the invoice only
  // carries the client, so the organization is read from the client's row.
  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (!invoice.client_id) {
        setLookupError('This invoice is not linked to a client, so its email cannot be previewed.');
        return;
      }
      const { data, error } = await supabase
        .from('clients')
        .select('organization_id')
        .eq('id', invoice.client_id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.organization_id) {
        setLookupError('Could not find the client for this invoice.');
        return;
      }
      setOrganizationId(data.organization_id);
    }

    void lookup();
    return () => { cancelled = true; };
  }, [invoice.client_id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const clientId = invoice.client_id ?? '';
  const orgId = organizationId ?? '';

  const loadPreview = useCallback(
    () => previewInvoiceEmail(clientId, orgId, invoice.id, invoice.client_email || undefined),
    [clientId, orgId, invoice.id, invoice.client_email],
  );
  const sendTest = useCallback(
    () => sendInvoiceEmailTest(clientId, orgId, invoice.id),
    [clientId, orgId, invoice.id],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Email preview for ${invoice.invoice_number}`}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email preview</h2>
            <p className="text-sm text-gray-500">
              {invoice.invoice_number} &middot; {invoice.client_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {lookupError ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              {lookupError}
            </p>
          ) : organizationId ? (
            <EmailPreviewActions
              label="Invoice email"
              previewKey={`invoice:${invoice.id}`}
              loadPreview={loadPreview}
              sendTest={sendTest}
              startExpanded
            />
          ) : (
            <div className="mt-4 animate-pulse space-y-2">
              <div className="h-3 w-56 rounded bg-gray-200" />
              <div className="h-64 w-full rounded-lg bg-gray-100" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
