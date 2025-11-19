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
  let yPosition = 20;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, yPosition);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(businessInfo.name, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 5;

  if (businessInfo.address) {
    doc.text(businessInfo.address, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (businessInfo.phone) {
    doc.text(businessInfo.phone, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (businessInfo.email) {
    doc.text(businessInfo.email, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (businessInfo.website) {
    doc.text(businessInfo.website, pageWidth - margin, yPosition, { align: 'right' });
  }

  yPosition = 50;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice #:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.invoice_date), margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Due Date:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.due_date), margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Terms:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.payment_terms, margin + 30, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.status.toUpperCase().replace('_', ' '), margin + 30, yPosition);

  yPosition = 50;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', pageWidth - margin - 60, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.client_name, pageWidth - margin - 60, yPosition);

  yPosition += 5;
  doc.text(invoice.client_email, pageWidth - margin - 60, yPosition);

  if (invoice.client_phone) {
    yPosition += 5;
    doc.text(invoice.client_phone, pageWidth - margin - 60, yPosition);
  }

  if (invoice.client_address) {
    yPosition += 5;
    const addressLines = doc.splitTextToSize(invoice.client_address, 60);
    doc.text(addressLines, pageWidth - margin - 60, yPosition);
  }

  yPosition = 95;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TYPE', margin, yPosition);
  doc.text('DESCRIPTION', margin + 25, yPosition);
  doc.text('QTY', margin + 100, yPosition);
  doc.text('RATE', margin + 120, yPosition);
  doc.text('TOTAL', pageWidth - margin - 25, yPosition, { align: 'right' });

  yPosition += 2;
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');

  invoice.lineItems.forEach((item) => {
    const descLines = doc.splitTextToSize(item.description, 70);
    const lineHeight = descLines.length * 5;

    if (yPosition + lineHeight > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.text(item.item_type.toUpperCase().substring(0, 3), margin, yPosition);
    doc.text(descLines, margin + 25, yPosition);
    doc.text(item.quantity.toString(), margin + 100, yPosition);
    doc.text(`$${item.unit_price.toFixed(2)}`, margin + 120, yPosition);
    doc.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });

    if (item.is_taxable) {
      doc.setFontSize(7);
      doc.text('*', margin + 22, yPosition);
      doc.setFontSize(9);
    }

    yPosition += lineHeight + 2;
  });

  yPosition += 5;
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal:', pageWidth - margin - 50, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Tax (${invoice.tax_rate}%):`, pageWidth - margin - 50, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });

  if (invoice.late_fee_charged > 0) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Late Fee:', pageWidth - margin - 50, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`$${invoice.late_fee_charged.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });
  }

  yPosition += 2;
  doc.line(pageWidth - margin - 50, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', pageWidth - margin - 50, yPosition);
  doc.text(`$${invoice.total_amount.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });

  if (invoice.amount_paid > 0) {
    yPosition += 6;
    doc.setFontSize(9);
    doc.text('Amount Paid:', pageWidth - margin - 50, yPosition);
    doc.text(`$${invoice.amount_paid.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });

    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Amount Due:', pageWidth - margin - 50, yPosition);
    doc.text(`$${invoice.amount_due.toFixed(2)}`, pageWidth - margin - 25, yPosition, { align: 'right' });
  }

  yPosition += 15;

  if (invoice.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', margin, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
    doc.text(notesLines, margin, yPosition);
    yPosition += notesLines.length * 5 + 5;
  }

  if (invoice.tax_amount > 0) {
    doc.setFontSize(7);
    doc.text('* Indicates taxable items per TN state law', margin, yPosition);
    yPosition += 5;
  }

  if (invoice.payment_terms_description) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT TERMS:', margin, yPosition);
    yPosition += 4;
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(invoice.payment_terms_description, pageWidth - 2 * margin);
    doc.text(termsLines, margin, yPosition);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 20, { align: 'center' });

  if (businessInfo.website) {
    doc.text(businessInfo.website, pageWidth / 2, pageHeight - 15, { align: 'center' });
  }

  return doc.output('blob');
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
