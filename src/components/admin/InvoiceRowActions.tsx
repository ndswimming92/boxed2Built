import React, { useEffect, useRef } from 'react';
import {
  CreditCard,
  Download,
  Eye,
  Link2,
  MessageSquareQuote,
  MoreHorizontal,
  Send,
  Trash2,
  Wrench,
  SquarePen,
} from 'lucide-react';
import { Invoice } from '../../lib/supabase';
import AnchoredPanel from '../ui/AnchoredPanel';

type InvoiceRowActionsProps = {
  invoice: Invoice;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onViewInvoice: () => void;
  onRecordPayment?: () => void;
  onCreateJob?: () => void;
  onMarkAsSent?: () => void;
  onDownloadPdf: () => void;
  onApprovalFollowUp?: () => void;
  onCopyPaymentLink?: () => void;
  onDelete: () => void;
  isDownloading: boolean;
  isDeleting: boolean;
  isMarkingSent: boolean;
  hasCopiedPaymentLink: boolean;
};

type ActionButtonProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
};

function MenuActionButton({ icon, label, onClick, tone = 'default', disabled = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        tone === 'danger'
          ? 'text-red-600 hover:bg-red-50 disabled:hover:bg-transparent'
          : 'text-slate-700 hover:bg-slate-100 disabled:hover:bg-transparent',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-current">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

export default function InvoiceRowActions({
  invoice,
  isMenuOpen,
  onMenuToggle,
  onMenuClose,
  onViewInvoice,
  onRecordPayment,
  onCreateJob,
  onMarkAsSent,
  onDownloadPdf,
  onApprovalFollowUp,
  onCopyPaymentLink,
  onDelete,
  isDownloading,
  isDeleting,
  isMarkingSent,
  hasCopiedPaymentLink,
}: InvoiceRowActionsProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = `invoice-actions-${invoice.id}`;
  const isDraft = invoice.status === 'draft';
  const primaryActionLabel = isDraft ? 'Send' : 'View';
  const primaryActionIcon = isDraft ? <Send className="h-4 w-4" /> : <Eye className="h-4 w-4" />;
  const primaryActionHandler = isDraft && onMarkAsSent ? onMarkAsSent : onViewInvoice;
  const primaryActionDisabled = isDraft ? isMarkingSent : false;

  // AnchoredPanel closes the menu on Escape and on outside clicks; this only
  // returns focus to the trigger so keyboard users are not stranded.
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleMenuAction = (handler: () => void) => {
    onMenuClose();
    handler();
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={primaryActionHandler}
        disabled={primaryActionDisabled}
        title={isDraft ? `Send ${invoice.invoice_number}` : `View ${invoice.invoice_number}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {primaryActionIcon}
        <span>{primaryActionLabel}</span>
      </button>

      <div className="relative">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuToggle}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          aria-label={`More actions for invoice ${invoice.invoice_number}`}
          title={`More actions for ${invoice.invoice_number}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <AnchoredPanel
          anchorRef={menuButtonRef}
          open={isMenuOpen}
          onClose={onMenuClose}
          width={256}
          align="right"
          id={menuId}
          role="menu"
          aria-label={`Invoice actions for ${invoice.invoice_number}`}
          className="rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="overflow-y-auto p-2">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice actions</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{invoice.invoice_number}</p>
            </div>

            <div className="mt-2 space-y-1">
              <MenuActionButton
                icon={<SquarePen className="h-4 w-4" />}
                label="Edit invoice"
                onClick={() => handleMenuAction(onViewInvoice)}
              />

              {onRecordPayment && (
                <MenuActionButton
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Record payment"
                  onClick={() => handleMenuAction(onRecordPayment)}
                />
              )}

              {onCreateJob && (
                <MenuActionButton
                  icon={<Wrench className="h-4 w-4" />}
                  label="Create job from invoice"
                  onClick={() => handleMenuAction(onCreateJob)}
                />
              )}

              {onMarkAsSent && !isDraft && (
                <MenuActionButton
                  icon={<Send className="h-4 w-4" />}
                  label="Mark as sent"
                  onClick={() => handleMenuAction(onMarkAsSent)}
                  disabled={isMarkingSent}
                />
              )}

              <MenuActionButton
                icon={<Download className="h-4 w-4" />}
                label={isDownloading ? 'Downloading PDF…' : 'Download PDF'}
                onClick={() => handleMenuAction(onDownloadPdf)}
                disabled={isDownloading}
              />

              {onApprovalFollowUp && (
                <MenuActionButton
                  icon={<MessageSquareQuote className="h-4 w-4" />}
                  label="Send approval follow-up"
                  onClick={() => handleMenuAction(onApprovalFollowUp)}
                />
              )}

              {onCopyPaymentLink && (
                <MenuActionButton
                  icon={<Link2 className="h-4 w-4" />}
                  label={hasCopiedPaymentLink ? 'Payment link copied' : 'Copy payment link'}
                  onClick={() => handleMenuAction(onCopyPaymentLink)}
                />
              )}
            </div>

            <div className="mt-2 border-t border-slate-100 pt-2">
              <MenuActionButton
                icon={<Trash2 className="h-4 w-4" />}
                label={isDeleting ? 'Deleting invoice…' : 'Delete invoice'}
                onClick={() => handleMenuAction(onDelete)}
                tone="danger"
                disabled={isDeleting}
              />
            </div>
          </div>
        </AnchoredPanel>
      </div>
    </div>
  );
}
