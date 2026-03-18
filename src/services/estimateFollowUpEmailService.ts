import { Invoice } from '../lib/supabase';

export interface EstimateFollowUpTemplate {
  subject: string;
  body: string;
}

function getReferenceLabel(invoice: Invoice): string {
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

export function openEmailClientWithEstimateFollowUp(invoice: Invoice): void {
  const { subject, body } = generateEstimateFollowUpTemplate(invoice);
  window.location.href = `mailto:${invoice.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
