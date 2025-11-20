import jsPDF from 'jspdf';
import { Invoice, InvoiceLineItem, InvoicePayment } from '../lib/supabase';

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

export async function generateInvoicePDF(
  invoice: InvoiceWithDetails,
  businessInfo: BusinessInfo
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 0;

  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', margin, 25);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(businessInfo.name, pageWidth - margin, 18, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  yPosition = 24;

  if (businessInfo.phone) {
    doc.text(businessInfo.phone, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 4.5;
  }

  if (businessInfo.email) {
    doc.text(businessInfo.email, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 4.5;
  }

  if (businessInfo.website) {
    doc.text(businessInfo.website, pageWidth - margin, yPosition, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0);
  yPosition = 58;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, yPosition, 75, 46, 'F');

  yPosition += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('INVOICE DETAILS', margin + 3, yPosition);

  yPosition += 7;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice #:', margin + 3, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin + 3, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatInvoiceType(invoice.invoice_type), margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 3, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.invoice_date), margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Due Date:', margin + 3, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.due_date), margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Terms:', margin + 3, yPosition);
  doc.setFont('helvetica', 'normal');
  const termsText = doc.splitTextToSize(invoice.payment_terms, 40);
  doc.text(termsText, margin + 30, yPosition);

  const statusColors = getStatusColors(invoice.status);
  doc.setFillColor(statusColors.bg[0], statusColors.bg[1], statusColors.bg[2]);
  doc.roundedRect(margin + 3, yPosition + 3, 35, 6, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(statusColors.text[0], statusColors.text[1], statusColors.text[2]);
  doc.text(invoice.status.toUpperCase().replace('_', ' '), margin + 20.5, yPosition + 7, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  yPosition = 58;

  doc.setFillColor(248, 250, 252);
  doc.rect(pageWidth - margin - 80, yPosition, 80, 46, 'F');

  yPosition += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('BILL TO', pageWidth - margin - 77, yPosition);

  yPosition += 7;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.client_name, pageWidth - margin - 77, yPosition);

  yPosition += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(invoice.client_email, pageWidth - margin - 77, yPosition);

  if (invoice.client_phone) {
    yPosition += 4.5;
    doc.text(invoice.client_phone, pageWidth - margin - 77, yPosition);
  }

  if (invoice.client_address) {
    yPosition += 4.5;
    const addressLines = doc.splitTextToSize(invoice.client_address, 75);
    doc.text(addressLines, pageWidth - margin - 77, yPosition);
  }

  yPosition = 116;

  doc.setFillColor(16, 185, 129);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TYPE', margin + 2, yPosition + 5.5);
  doc.text('DESCRIPTION', margin + 25, yPosition + 5.5);
  doc.text('QTY', margin + 105, yPosition + 5.5);
  doc.text('RATE', margin + 125, yPosition + 5.5);
  doc.text('TOTAL', pageWidth - margin - 2, yPosition + 5.5, { align: 'right' });

  yPosition += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  invoice.lineItems.forEach((item, index) => {
    const descLines = doc.splitTextToSize(item.description, 70);
    const lineHeight = Math.max(descLines.length * 5, 7);

    if (yPosition + lineHeight > 270) {
      doc.addPage();
      yPosition = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, lineHeight + 2, 'F');
    }

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(formatItemType(item.item_type), margin + 2, yPosition + 3);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(descLines, margin + 25, yPosition + 3);
    doc.text(item.quantity.toString(), margin + 108, yPosition + 3, { align: 'right' });
    doc.text(`$${item.unit_price.toFixed(2)}`, margin + 145, yPosition + 3, { align: 'right' });
    doc.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 2, yPosition + 3, { align: 'right' });

    if (item.is_taxable) {
      doc.setFontSize(7);
      doc.setTextColor(16, 185, 129);
      doc.text('*', margin + 22, yPosition + 2);
    }

    yPosition += lineHeight + 2;
  });

  yPosition += 5;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  const totalsX = pageWidth - margin - 65;

  doc.setFillColor(248, 250, 252);
  doc.rect(totalsX - 5, yPosition - 5, 70, invoice.late_fee_charged > 0 ? 32 : 26, 'F');

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal:', totalsX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

  if (invoice.late_fee_charged > 0) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Late Fee:', totalsX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`$${invoice.late_fee_charged.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }

  yPosition += 2;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.line(totalsX - 5, yPosition, pageWidth - margin, yPosition);
  doc.setLineWidth(0.2);
  yPosition += 7;

  doc.setFillColor(16, 185, 129);
  doc.rect(totalsX - 5, yPosition - 5, 70, 10, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL:', totalsX, yPosition + 2);
  doc.text(`$${invoice.total_amount.toFixed(2)}`, pageWidth - margin - 2, yPosition + 2, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  yPosition += 12;

  if (invoice.amount_paid > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Amount Paid:', totalsX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(`-$${invoice.amount_paid.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Amount Due:', totalsX, yPosition);
    doc.setTextColor(239, 68, 68);
    doc.text(`$${invoice.amount_due.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0);
  yPosition += 15;

  if (invoice.notes) {
    doc.setFillColor(254, 252, 232);
    doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 2, 'F');
    yPosition += 2;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(113, 63, 18);
    doc.text('NOTES:', margin + 3, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 53, 15);
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin - 6);
    doc.text(notesLines, margin + 3, yPosition);
    yPosition += notesLines.length * 4.5 + 8;
  }

  doc.setTextColor(100, 116, 139);

  if (invoice.tax_amount > 0) {
    doc.setFontSize(8);
    doc.text('* Indicates taxable items per TN state law', margin, yPosition);
    yPosition += 5;
  }

  if (invoice.payment_terms_description) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PAYMENT TERMS:', margin, yPosition);
    yPosition += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const termsLines = doc.splitTextToSize(invoice.payment_terms_description, pageWidth - 2 * margin);
    doc.text(termsLines, margin, yPosition);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });

  if (businessInfo.website) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(businessInfo.website, pageWidth / 2, pageHeight - 9, { align: 'center' });
  }

  return doc.output('blob');
}

function getStatusColors(status: string): { bg: [number, number, number]; text: [number, number, number] } {
  switch (status) {
    case 'paid':
      return { bg: [220, 252, 231], text: [22, 101, 52] };
    case 'partially_paid':
      return { bg: [254, 243, 199], text: [146, 64, 14] };
    case 'sent':
      return { bg: [219, 234, 254], text: [30, 64, 175] };
    case 'overdue':
      return { bg: [254, 226, 226], text: [153, 27, 27] };
    case 'draft':
      return { bg: [241, 245, 249], text: [71, 85, 105] };
    case 'cancelled':
      return { bg: [226, 232, 240], text: [51, 65, 85] };
    default:
      return { bg: [243, 244, 246], text: [75, 85, 99] };
  }
}

export async function downloadInvoicePDF(invoice: InvoiceWithDetails, businessInfo: BusinessInfo): Promise<void> {
  const blob = await generateInvoicePDF(invoice, businessInfo);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice-${invoice.invoice_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function previewInvoicePDF(invoice: InvoiceWithDetails, businessInfo: BusinessInfo): Promise<void> {
  const blob = await generateInvoicePDF(invoice, businessInfo);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatInvoiceType(type: string): string {
  const typeMap: { [key: string]: string } = {
    estimate: 'Estimate',
    deposit: 'Deposit',
    progress: 'Progress',
    final: 'Final',
    general: 'General',
  };
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function formatItemType(type: string): string {
  const typeMap: { [key: string]: string } = {
    labor: 'Labor',
    material: 'Material',
    other: 'Other',
  };
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}
