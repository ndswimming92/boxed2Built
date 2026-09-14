// TWIN FILE — the other copy is src/utils/invoiceLabels.ts.
// Deno can't import from src/ and Vite can't import Deno modules, so this file
// exists twice. tests/unit/invoiceLabels.test.ts fails if the two drift apart,
// so keep everything below the marker byte-identical and import-free.
// === BEGIN SHARED ===
/**
 * How an invoice's stored type is worded for people.
 *
 * The database stores `invoice_type = 'estimate'` — pinned by a CHECK
 * constraint (supabase/migrations/20251119193905_create_invoices_system.sql)
 * and referenced across queries, the api-v1 field list and exports. But
 * Boxed2Built sells firm prices off a published price table, not
 * approximations, so every surface a person reads says "Quote" instead.
 * Renaming the stored value would mean a migration for no customer benefit.
 *
 * The rule: code names follow the database, display strings follow the
 * customer. If you see `estimate` you're looking at data; if you see "Quote"
 * you're looking at output. This file is the only place the two meet.
 */

export type InvoiceType = 'estimate' | 'deposit' | 'progress' | 'final' | 'general';

export interface InvoiceLabels {
  /** Uppercase full name, for the PDF and email pill. */
  header: string;
  /** Uppercase short tag, for the document-number band. */
  bandTag: string;
  /** Title case, for a "Type:" row, an admin chip, or the form dropdown. */
  type: string;
  /** Lower case, to drop mid-sentence: "your quote is ready". */
  noun: string;
  /** "Quote Date" on an offer, "Invoice Date" on a bill. */
  dateLabel: string;
  /** Filename prefix for the downloaded PDF. */
  fileNoun: string;
  /** A quote is an offer, not a bill — nothing is owed until it's accepted. */
  isQuote: boolean;
}

const LABELS: Record<InvoiceType, InvoiceLabels> = {
  estimate: {
    header: 'QUOTE',
    bandTag: 'QUOTE',
    type: 'Quote',
    noun: 'quote',
    dateLabel: 'Quote Date',
    fileNoun: 'Quote',
    isQuote: true,
  },
  deposit: {
    header: 'DEPOSIT INVOICE',
    bandTag: 'DEPOSIT',
    type: 'Deposit',
    noun: 'deposit invoice',
    dateLabel: 'Invoice Date',
    fileNoun: 'Invoice',
    isQuote: false,
  },
  progress: {
    header: 'PROGRESS INVOICE',
    bandTag: 'PROGRESS',
    type: 'Progress',
    noun: 'progress invoice',
    dateLabel: 'Invoice Date',
    fileNoun: 'Invoice',
    isQuote: false,
  },
  final: {
    header: 'FINAL INVOICE',
    bandTag: 'INVOICE',
    type: 'Final',
    noun: 'final invoice',
    dateLabel: 'Invoice Date',
    fileNoun: 'Invoice',
    isQuote: false,
  },
  general: {
    header: 'INVOICE',
    bandTag: 'INVOICE',
    type: 'General',
    noun: 'invoice',
    dateLabel: 'Invoice Date',
    fileNoun: 'Invoice',
    isQuote: false,
  },
};

export function invoiceLabels(invoiceType: string): InvoiceLabels {
  return LABELS[invoiceType as InvoiceType] ?? LABELS.general;
}

/** The document's name standing on its own, e.g. under its number. */
export function invoiceNoun(invoiceType: string): string {
  const { noun } = invoiceLabels(invoiceType);
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** Headline money label: "Quote Total" on an offer, "Amount Due" on a bill. */
export function amountLabel(invoiceType: string): string {
  return invoiceLabels(invoiceType).isQuote ? 'Quote Total' : 'Amount Due';
}

/** Bottom row of a totals block: "Quote Total" on an offer, "Total Due" on a bill. */
export function totalLabel(invoiceType: string): string {
  return invoiceLabels(invoiceType).isQuote ? 'Quote Total' : 'Total Due';
}

/**
 * The figure that belongs next to {@link amountLabel}. A bill leads with what
 * is still owed; a quote leads with the price of the job, so that a quote with
 * a payment already recorded doesn't headline "Quote Total $0.00".
 */
export function headlineAmount(
  invoiceType: string,
  amounts: { total_amount: number; amount_due: number },
): number {
  return invoiceLabels(invoiceType).isQuote ? amounts.total_amount : amounts.amount_due;
}

/** Subject line for the document email. */
export function invoiceEmailSubject(
  invoiceType: string,
  invoiceNumber: string,
  formattedHeadline: string,
): string {
  return invoiceLabels(invoiceType).isQuote
    ? `Your quote from Boxed2Built — ${formattedHeadline}`
    : `Invoice ${invoiceNumber} — ${formattedHeadline} Due`;
}
