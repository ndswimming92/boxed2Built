import { Invoice } from '../lib/supabase';

export interface EstimateFollowUpTemplate {
  subject: string;
  body: string;
}

interface SendEstimateFollowUpEmailPayload {
  email: string;
  clientName: string;
  invoiceNumber: string;
  invoiceType: Invoice['invoice_type'];
}

function getReferenceLabel(invoice: Pick<Invoice, 'invoice_type'>): string {
  return invoice.invoice_type === 'estimate' ? 'estimate' : 'invoice';
}

function getGreetingName(clientName: string): string {
  return clientName.trim() || 'there';
}

export function generateEstimateFollowUpEmailSubject(invoice: Invoice): string {
  const referenceLabel = getReferenceLabel(invoice);
  return `Following up on ${referenceLabel} ${invoice.invoice_number}`;
}

export function generateEstimateFollowUpEmailPlainText(invoice: Invoice): string {
  const referenceLabel = getReferenceLabel(invoice);
  const greetingName = getGreetingName(invoice.client_name);

  return [
    `Hi ${greetingName},`,
    '',
    `I wanted to follow up on ${referenceLabel} ${invoice.invoice_number}.`,
    'Would you like to proceed with the work, or is there anything you would like to review before we move forward?',
    '',
    'If you are ready to proceed, just reply to this email and I can confirm the next steps and scheduling details.',
    '',
    'Thank you,',
    'Boxed2Built',
  ].join('\n');
}

export function generateEstimateFollowUpTemplate(invoice: Invoice): EstimateFollowUpTemplate {
  return {
    subject: generateEstimateFollowUpEmailSubject(invoice),
    body: generateEstimateFollowUpEmailPlainText(invoice),
  };
}

export async function sendEstimateFollowUpEmail(invoice: Invoice): Promise<void> {
  if (!invoice.client_email) {
    throw new Error('Missing customer email address.');
  }

  const payload: SendEstimateFollowUpEmailPayload = {
    email: invoice.client_email,
    clientName: invoice.client_name,
    invoiceNumber: invoice.invoice_number,
    invoiceType: invoice.invoice_type,
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
