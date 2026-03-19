import { Invoice, Job } from '../lib/supabase';
import { getInvoice } from './invoiceService';

export interface EstimateFollowUpTemplate {
  subject: string;
  body: string;
}

export interface EstimateFollowUpDetails {
  clientName: string;
  invoiceNumber: string;
  invoiceType: Invoice['invoice_type'];
  serviceSummary?: string | null;
  estimateTotal?: string | null;
  estimatedDuration?: string | null;
}

interface SendEstimateFollowUpEmailPayload extends EstimateFollowUpDetails {
  email: string;
}

function getGreetingName(clientName: string): string {
  return clientName.trim() || 'there';
}

function formatCurrency(amount: number | null | undefined): string | null {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatEstimatedDuration(hours: number | null | undefined): string | null {
  if (typeof hours !== 'number' || Number.isNaN(hours) || hours <= 0) {
    return null;
  }

  const roundedHours = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1).replace(/\.0$/, '');
  return `${roundedHours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function summarizeService(descriptions: string[]): string | null {
  const normalized = descriptions
    .map((description) => description.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]} and ${normalized[1]}`;
  }

  const preview = normalized.slice(0, 3);
  const remainingCount = normalized.length - preview.length;
  return remainingCount > 0
    ? `${preview.join(', ')}, and ${remainingCount} more item${remainingCount === 1 ? '' : 's'}`
    : `${preview.slice(0, -1).join(', ')}, and ${preview[preview.length - 1]}`;
}

export function buildEstimateFollowUpDetails(
  invoice: Invoice,
  options?: {
    serviceSummary?: string | null;
    estimatedDuration?: string | null;
  }
): EstimateFollowUpDetails {
  return {
    clientName: invoice.client_name,
    invoiceNumber: invoice.invoice_number,
    invoiceType: invoice.invoice_type,
    serviceSummary: options?.serviceSummary?.trim() || null,
    estimateTotal: formatCurrency(invoice.total_amount),
    estimatedDuration: options?.estimatedDuration?.trim() || null,
  };
}

export async function getEstimateFollowUpDetails(
  invoice: Invoice,
  job?: Job | null
): Promise<EstimateFollowUpDetails> {
  const fullInvoice = await getInvoice(invoice.id).catch(() => null);
  const serviceSummary = summarizeService(fullInvoice?.lineItems?.map((item) => item.description) || [])
    || job?.job_description?.trim()
    || null;
  const estimatedDuration = formatEstimatedDuration(job?.hours_worked);

  return buildEstimateFollowUpDetails(invoice, {
    serviceSummary,
    estimatedDuration,
  });
}

export function generateEstimateFollowUpEmailSubject(): string {
  return 'Approval follow-up';
}

export function generateEstimateFollowUpEmailPlainText(details: EstimateFollowUpDetails): string {
  const greetingName = getGreetingName(details.clientName);
  const lines = [
    `Hello ${greetingName},`,
    '',
    `I wanted to follow up on estimate ${details.invoiceNumber}${details.serviceSummary ? ` for your ${details.serviceSummary}` : ''}.`,
    '',
  ];

  const detailLines = [
    details.serviceSummary ? `- Service: ${details.serviceSummary}` : null,
    details.estimateTotal ? `- Estimate total: ${details.estimateTotal}` : null,
    details.estimatedDuration ? `- Estimated time: ${details.estimatedDuration}` : null,
  ].filter(Boolean);

  if (detailLines.length > 0) {
    lines.push('Here are the details I have for your project:');
    lines.push(...detailLines);
    lines.push('');
  }

  lines.push(
    'My goal is to make this as easy and stress-free as possible for you. I\'ll handle the assembly, bring the necessary tools, and clean up all packaging when the job is complete.',
    '',
    'If you\'re ready to move forward, just reply to this email and I can confirm the next steps and scheduling details. If you have any questions or want to review anything before moving forward, I\'m happy to help.',
    '',
    'Thank you,',
    'Boxed2Built',
    '615-403-4538',
  );

  return lines.join('\n');
}

export function generateEstimateFollowUpTemplate(details: EstimateFollowUpDetails): EstimateFollowUpTemplate {
  return {
    subject: generateEstimateFollowUpEmailSubject(),
    body: generateEstimateFollowUpEmailPlainText(details),
  };
}

export async function sendEstimateFollowUpEmail(details: EstimateFollowUpDetails, email: string): Promise<void> {
  if (!email) {
    throw new Error('Missing customer email address.');
  }

  const payload: SendEstimateFollowUpEmailPayload = {
    email,
    ...details,
  };

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimate-follow-up-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    const message = typeof data?.error === 'string'
      ? data.error
      : 'Failed to send approval follow-up email.';
    throw new Error(message);
  }
}
