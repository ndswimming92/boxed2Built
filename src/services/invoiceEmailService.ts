import { Invoice, InvoiceLineItem, InvoicePayment } from '../lib/supabase';
import { generateInvoicePDF } from '../utils/invoicePDFGenerator';

interface InvoiceWithDetails extends Invoice {
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

interface BusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export function generateInvoiceEmailHTML(invoice: Invoice, businessInfo: BusinessInfo): string {
  const statusColor = {
    draft: '#6B7280',
    sent: '#3B82F6',
    partially_paid: '#F59E0B',
    paid: '#10B981',
    overdue: '#EF4444',
    cancelled: '#6B7280',
  }[invoice.status];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px; background-color: #059669; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Invoice ${invoice.invoice_number}</h1>
              <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 14px;">${businessInfo.name}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px;">Hello ${invoice.client_name},</p>

              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                Thank you for choosing ${businessInfo.name}! Please find your invoice attached to this email.
              </p>

              <!-- Invoice Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 4px 0;">
                          <strong style="color: #6b7280; font-size: 12px;">Invoice Number:</strong>
                          <span style="color: #1f2937; font-size: 14px; float: right;">${invoice.invoice_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <strong style="color: #6b7280; font-size: 12px;">Invoice Date:</strong>
                          <span style="color: #1f2937; font-size: 14px; float: right;">${formatDate(invoice.invoice_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <strong style="color: #6b7280; font-size: 12px;">Due Date:</strong>
                          <span style="color: #1f2937; font-size: 14px; float: right;">${formatDate(invoice.due_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <strong style="color: #6b7280; font-size: 12px;">Payment Terms:</strong>
                          <span style="color: #1f2937; font-size: 14px; float: right;">${invoice.payment_terms}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0 4px 0; border-top: 2px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 16px;">Total Amount:</strong>
                          <span style="color: #059669; font-size: 20px; font-weight: bold; float: right;">$${invoice.total_amount.toFixed(2)}</span>
                        </td>
                      </tr>
                      ${invoice.amount_paid > 0 ? `
                      <tr>
                        <td style="padding: 4px 0;">
                          <strong style="color: #6b7280; font-size: 12px;">Amount Paid:</strong>
                          <span style="color: #10b981; font-size: 14px; float: right;">$${invoice.amount_paid.toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <strong style="color: #1f2937; font-size: 14px;">Amount Due:</strong>
                          <span style="color: #3b82f6; font-size: 16px; font-weight: bold; float: right;">$${invoice.amount_due.toFixed(2)}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              ${invoice.late_fee_enabled && invoice.late_fee_amount ? `
              <div style="padding: 12px; background-color: #fef3c7; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 13px;">
                  <strong>Late Fee Notice:</strong> A late fee of $${invoice.late_fee_amount.toFixed(2)} will be applied if payment is not received within ${invoice.late_fee_grace_days} days of the due date.
                </p>
              </div>
              ` : ''}

              <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">Payment Methods</h3>
              <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px;">We accept the following payment methods:</p>
              <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
                <li>Cash or Check (at time of service)</li>
                <li>Credit/Debit Card</li>
                <li>Venmo, Zelle, or Bank Transfer</li>
              </ul>

              ${invoice.notes ? `
              <div style="padding: 16px; background-color: #f9fafb; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${invoice.notes}</p>
              </div>
              ` : ''}

              <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                If you have any questions about this invoice, please don't hesitate to contact us at ${businessInfo.email || businessInfo.phone || ''}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; text-align: center;">
                ${businessInfo.name}
              </p>
              ${businessInfo.address ? `<p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px; text-align: center;">${businessInfo.address}</p>` : ''}
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                ${businessInfo.phone || ''} ${businessInfo.email ? '| ' + businessInfo.email : ''}
              </p>
              ${businessInfo.website ? `<p style="margin: 8px 0 0 0; color: #059669; font-size: 12px; text-align: center;"><a href="${businessInfo.website}" style="color: #059669; text-decoration: none;">${businessInfo.website}</a></p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function generateInvoiceEmailSubject(invoice: Invoice): string {
  return `Invoice ${invoice.invoice_number} from ${invoice.client_name}`;
}

export function generateInvoiceEmailPlainText(invoice: Invoice, businessInfo: BusinessInfo): string {
  return `
Invoice ${invoice.invoice_number}

Dear ${invoice.client_name},

Thank you for choosing ${businessInfo.name}! Please find your invoice details below.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Invoice Date: ${formatDate(invoice.invoice_date)}
- Due Date: ${formatDate(invoice.due_date)}
- Payment Terms: ${invoice.payment_terms}

Total Amount: $${invoice.total_amount.toFixed(2)}
${invoice.amount_paid > 0 ? `Amount Paid: $${invoice.amount_paid.toFixed(2)}\nAmount Due: $${invoice.amount_due.toFixed(2)}` : ''}

${invoice.late_fee_enabled && invoice.late_fee_amount ? `
LATE FEE NOTICE: A late fee of $${invoice.late_fee_amount.toFixed(2)} will be applied if payment is not received within ${invoice.late_fee_grace_days} days of the due date.
` : ''}

Payment Methods:
- Cash or Check (at time of service)
- Credit/Debit Card
- Venmo, Zelle, or Bank Transfer

${invoice.notes ? `\nNotes:\n${invoice.notes}\n` : ''}

If you have any questions about this invoice, please contact us.

Best regards,
${businessInfo.name}
${businessInfo.phone || ''}
${businessInfo.email || ''}
${businessInfo.website || ''}
`;
}

export async function openEmailClientWithInvoice(
  invoice: InvoiceWithDetails,
  businessInfo: BusinessInfo
): Promise<void> {
  const subject = encodeURIComponent(generateInvoiceEmailSubject(invoice));
  const body = encodeURIComponent(generateInvoiceEmailPlainText(invoice, businessInfo));

  const mailto = `mailto:${invoice.client_email}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
