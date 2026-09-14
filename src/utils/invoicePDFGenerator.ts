import { Invoice, InvoiceLineItem, InvoicePayment } from '../lib/supabase';
import { invoiceLabels, amountLabel, headlineAmount } from './invoiceLabels';

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

const LOGO_URL = 'https://boxed2built.com/boxed2built_logo.png';

const NAVY: [number, number, number] = [14, 39, 72];
const NAVY_DARK: [number, number, number] = [11, 31, 58];
const AMBER: [number, number, number] = [217, 164, 65];
const AMBER_LIGHT_TEXT: [number, number, number] = [240, 200, 119];
const AMBER_PILL_BG: [number, number, number] = [39, 51, 76];
const GREEN_ACCENT: [number, number, number] = [74, 222, 128];
const GREEN_TEXT: [number, number, number] = [22, 163, 74];
const RED_TEXT: [number, number, number] = [185, 28, 28];
const SLATE_LABEL: [number, number, number] = [156, 163, 175];
const SLATE_MUTED: [number, number, number] = [107, 114, 128];
const INK: [number, number, number] = [17, 24, 39];
const BODY_TEXT: [number, number, number] = [55, 65, 81];
const PANEL_BG: [number, number, number] = [249, 250, 251];
const PANEL_BORDER: [number, number, number] = [229, 231, 235];
const ROW_BORDER: [number, number, number] = [243, 244, 246];
const PALE_BLUE: [number, number, number] = [143, 166, 196];
const LINK_BLUE: [number, number, number] = [183, 198, 220];

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePDF(
  invoice: InvoiceWithDetails,
  businessInfo: BusinessInfo
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const labels = invoiceLabels(invoice.invoice_type);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 0;

  const logoDataUrl = await loadLogoDataUrl();

  // ---- Header (navy) ----
  const headerHeight = 48;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  const badgeCx = margin + 9;
  const badgeCy = 20;
  const badgeR = 9;
  doc.setFillColor(255, 255, 255);
  doc.circle(badgeCx, badgeCy, badgeR, 'F');
  if (logoDataUrl) {
    try {
      const imgSize = badgeR * 1.8;
      doc.addImage(logoDataUrl, 'PNG', badgeCx - imgSize / 2, badgeCy - imgSize / 2, imgSize, imgSize);
    } catch {
      // fall back to plain white badge if the image fails to decode
    }
  }

  let wordX = margin + 24;
  const wordY = 21;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Boxed', wordX, wordY);
  wordX += doc.getTextWidth('Boxed');
  doc.setTextColor(...AMBER);
  doc.text('2', wordX, wordY);
  wordX += doc.getTextWidth('2');
  doc.setTextColor(255, 255, 255);
  doc.text('Built', wordX, wordY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PALE_BLUE);
  doc.text('WE ASSEMBLE. YOU ENJOY.', margin + 24, wordY + 5.5);

  const pillText = labels.header;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const pillPadX = 4;
  const pillTextW = doc.getTextWidth(pillText);
  const pillW = pillTextW + 2 * pillPadX;
  const pillH = 8;
  const pillX = pageWidth - margin - pillW;
  const pillY = 12;
  doc.setFillColor(...AMBER_PILL_BG);
  doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'F');
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'S');
  doc.setTextColor(...AMBER_LIGHT_TEXT);
  doc.text(pillText, pillX + pillW / 2, pillY + 5.5, { align: 'center' });

  let bizY = pillY + pillH + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(businessInfo.name, pageWidth - margin, bizY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PALE_BLUE);
  bizY += 4.5;
  if (businessInfo.phone) {
    doc.text(businessInfo.phone, pageWidth - margin, bizY, { align: 'right' });
    bizY += 4;
  }
  if (businessInfo.email) {
    doc.text(businessInfo.email, pageWidth - margin, bizY, { align: 'right' });
  }

  // ---- Invoice #/Amount due sub-band (dark navy) ----
  const bandY = headerHeight;
  const bandHeight = 15;
  doc.setFillColor(...NAVY_DARK);
  doc.rect(0, bandY, pageWidth, bandHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PALE_BLUE);
  doc.text(labels.bandTag, margin, bandY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.invoice_number, margin, bandY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PALE_BLUE);
  doc.text(amountLabel(invoice.invoice_type).toUpperCase(), pageWidth - margin, bandY + 6, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GREEN_ACCENT);
  doc.text(
    `$${headlineAmount(invoice.invoice_type, invoice).toFixed(2)}`,
    pageWidth - margin,
    bandY + 12,
    { align: 'right' },
  );

  doc.setTextColor(0, 0, 0);
  yPosition = bandY + bandHeight + 12;

  // ---- Details / Bill To boxes ----
  const boxTop = yPosition;
  const boxW = 85;
  const boxH = 44;

  doc.setFillColor(...PANEL_BG);
  doc.setDrawColor(...PANEL_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, boxTop, boxW, boxH, 2, 2, 'FD');
  doc.roundedRect(pageWidth - margin - boxW, boxTop, boxW, boxH, 2, 2, 'FD');

  let leftY = boxTop + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LABEL);
  doc.text('DETAILS', margin + 4, leftY);

  leftY += 7;
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin + 4, leftY);
  doc.setFont('helvetica', 'normal');
  doc.text(labels.type, margin + 26, leftY);

  leftY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 4, leftY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.invoice_date), margin + 26, leftY);

  // Estimates have no due date — nothing is owed until the quote is accepted.
  if (invoice.due_date) {
    leftY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Due Date:', margin + 4, leftY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...RED_TEXT);
    doc.text(formatDate(invoice.due_date), margin + 26, leftY);
    doc.setTextColor(...INK);
  }

  leftY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Terms:', margin + 4, leftY);
  doc.setFont('helvetica', 'normal');
  const termsText = doc.splitTextToSize(invoice.payment_terms || 'N/A', 40);
  doc.text(termsText, margin + 26, leftY);

  const statusColors = getStatusColors(invoice.status);
  doc.setFillColor(...statusColors.bg);
  doc.roundedRect(margin + 4, leftY + 3, 34, 6, 1, 1, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusColors.text);
  doc.text(invoice.status.toUpperCase().replace('_', ' '), margin + 21, leftY + 7, { align: 'center' });

  doc.setTextColor(0, 0, 0);

  let rightY = boxTop + 8;
  const rightX = pageWidth - margin - boxW + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LABEL);
  doc.text('BILLED TO', rightX, rightY);

  rightY += 7;
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.client_name, rightX, rightY);

  rightY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BODY_TEXT);
  if (invoice.client_email) {
    doc.text(invoice.client_email, rightX, rightY);
    rightY += 4.5;
  }
  if (invoice.client_phone) {
    doc.text(invoice.client_phone, rightX, rightY);
    rightY += 4.5;
  }
  if (invoice.client_address) {
    const addressLines = doc.splitTextToSize(invoice.client_address, boxW - 8);
    doc.text(addressLines, rightX, rightY);
  }

  doc.setTextColor(0, 0, 0);
  yPosition = boxTop + boxH + 12;

  // ---- Line items table ----
  doc.setFillColor(...NAVY);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');

  doc.setFontSize(8.5);
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
      doc.setFillColor(...PANEL_BG);
      doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, lineHeight + 2, 'F');
    }

    doc.setFontSize(8);
    doc.setTextColor(...SLATE_MUTED);
    doc.text(formatItemType(item.item_type), margin + 2, yPosition + 3);

    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(descLines, margin + 25, yPosition + 3);
    doc.text(item.quantity.toString(), margin + 108, yPosition + 3, { align: 'right' });
    doc.text(`$${item.unit_price.toFixed(2)}`, margin + 145, yPosition + 3, { align: 'right' });
    doc.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 2, yPosition + 3, { align: 'right' });

    if (item.is_taxable) {
      doc.setFontSize(7);
      doc.setTextColor(...AMBER);
      doc.text('*', margin + 22, yPosition + 2);
    }

    yPosition += lineHeight + 2;
  });

  yPosition += 5;
  doc.setDrawColor(...ROW_BORDER);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // ---- Totals ----
  const totalsX = pageWidth - margin - 65;

  doc.setFillColor(...PANEL_BG);
  doc.rect(totalsX - 5, yPosition - 5, 70, invoice.late_fee_charged > 0 ? 32 : 26, 'F');

  doc.setFontSize(10);
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal:', totalsX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BODY_TEXT);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE_MUTED);
  doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BODY_TEXT);
  doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

  if (invoice.late_fee_charged > 0) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED_TEXT);
    doc.text('Late Fee:', totalsX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`$${invoice.late_fee_charged.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }

  yPosition += 2;
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.8);
  doc.line(totalsX - 5, yPosition, pageWidth - margin, yPosition);
  doc.setLineWidth(0.2);
  yPosition += 7;

  doc.setFillColor(...NAVY);
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
    doc.setTextColor(...SLATE_MUTED);
    doc.text('Amount Paid:', totalsX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREEN_TEXT);
    doc.text(`-$${invoice.amount_paid.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text('Amount Due:', totalsX, yPosition);
    doc.setTextColor(...RED_TEXT);
    doc.text(`$${invoice.amount_due.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0);
  yPosition += 15;

  // ---- Notes ----
  if (invoice.notes) {
    doc.setFillColor(...PANEL_BG);
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin - 10);
    const notesBoxH = 8 + notesLines.length * 4.5 + 4;
    doc.roundedRect(margin, yPosition - 4, pageWidth - 2 * margin, notesBoxH, 2, 2, 'F');
    doc.setFillColor(...AMBER);
    doc.rect(margin, yPosition - 4, 1.4, notesBoxH, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_LABEL);
    doc.text('NOTES', margin + 6, yPosition + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BODY_TEXT);
    doc.text(notesLines, margin + 6, yPosition + 7);
    yPosition += notesBoxH + 8;
  }

  doc.setTextColor(...SLATE_MUTED);

  if (invoice.tax_amount > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('* Indicates taxable items per TN state law', margin, yPosition);
    yPosition += 5;
  }

  if (invoice.payment_terms_description) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_MUTED);
    doc.text('PAYMENT TERMS:', margin, yPosition);
    yPosition += 4;
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(invoice.payment_terms_description, pageWidth - 2 * margin);
    doc.text(termsLines, margin, yPosition);
  }

  // ---- Footer (navy) ----
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerHeight = 32;
  doc.setFillColor(...NAVY);
  doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');

  const footCx = pageWidth / 2;
  const footBadgeR = 6.5;
  const footBadgeCy = pageHeight - footerHeight + 10;
  doc.setFillColor(255, 255, 255);
  doc.circle(footCx, footBadgeCy, footBadgeR, 'F');
  if (logoDataUrl) {
    try {
      const imgSize = footBadgeR * 1.8;
      doc.addImage(logoDataUrl, 'PNG', footCx - imgSize / 2, footBadgeCy - imgSize / 2, imgSize, imgSize);
    } catch {
      // fall back to plain white badge if the image fails to decode
    }
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PALE_BLUE);
  doc.text('Furniture assembly & TV mounting · Spring Hill, TN', footCx, footBadgeCy + 10, { align: 'center' });

  if (businessInfo.website) {
    doc.setFontSize(8);
    doc.setTextColor(...LINK_BLUE);
    doc.text(businessInfo.website, footCx, footBadgeCy + 15, { align: 'center' });
  }

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(92, 116, 154);
  doc.text('Turning boxes into comfort, one home at a time.', footCx, footBadgeCy + 20, { align: 'center' });

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
  link.download = `${invoiceLabels(invoice.invoice_type).fileNoun}-${invoice.invoice_number}.pdf`;
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
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatItemType(type: string): string {
  const typeMap: { [key: string]: string } = {
    labor: 'Labor',
    material: 'Material',
    other: 'Other',
  };
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}
