import type { jsPDF } from 'jspdf';
import { qrPngDataUrl } from '../lib/qrExport';

/**
 * Shared look for the partner flyers. The palette, logo badge and wordmark
 * match the invoice PDF so a flyer, a quote and an invoice read as one brand.
 */

type RGB = [number, number, number];

export const NAVY: RGB = [14, 39, 72];
export const NAVY_DARK: RGB = [11, 31, 58];
export const AMBER: RGB = [217, 164, 65];
export const AMBER_LIGHT_TEXT: RGB = [240, 200, 119];
export const AMBER_PILL_BG: RGB = [39, 51, 76];
export const GREEN_TEXT: RGB = [22, 163, 74];
export const INK: RGB = [17, 24, 39];
export const BODY_TEXT: RGB = [55, 65, 81];
export const SLATE_LABEL: RGB = [107, 114, 128];
export const PANEL_BG: RGB = [249, 250, 251];
export const PANEL_BORDER: RGB = [229, 231, 235];
export const PALE_BLUE: RGB = [143, 166, 196];

export const TAGLINE = 'WE ASSEMBLE. YOU ENJOY.';
export const PARTNERS_URL = 'https://boxed2built.com/partners';
export const FOUNDER_NAME = 'Nicholas Davidson';

const LOGO_URL = '/boxed2built_logo.png';
const HEADER_HEIGHT = 48;
const BAND_HEIGHT = 15;
const FOOTER_HEIGHT = 50;

export const FLYER_MARGIN = 18;
/** Y where flyer body content may start, just below the header and band. */
export const CONTENT_TOP = HEADER_HEIGHT + BAND_HEIGHT + 12;

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

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

export interface FlyerAssets {
  logoDataUrl: string | null;
  qrDataUrl: string;
}

export async function loadFlyerAssets(): Promise<FlyerAssets> {
  const [logoDataUrl, qrDataUrl] = await Promise.all([loadLogoDataUrl(), qrPngDataUrl(PARTNERS_URL, 400)]);
  return { logoDataUrl, qrDataUrl };
}

export interface FlyerContact {
  phone: string;
  email: string;
  website: string;
}

interface HeaderOptions {
  /** Small pill at the top right, e.g. "REALTOR PARTNERS". */
  pill: string;
  /** Small label on the left of the dark band. */
  bandTag: string;
  /** Larger text on the left of the dark band. */
  bandTitle: string;
  /** Small label on the right of the dark band. */
  bandRightTag: string;
  /** Larger text on the right of the dark band. */
  bandRightText: string;
}

export function drawHeader(doc: jsPDF, assets: FlyerAssets, contact: FlyerContact, opts: HeaderOptions): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = FLYER_MARGIN;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  const badgeCx = margin + 11;
  const badgeCy = 24;
  const badgeR = 11;
  doc.setFillColor(255, 255, 255);
  doc.circle(badgeCx, badgeCy, badgeR, 'F');
  if (assets.logoDataUrl) {
    try {
      const imgSize = badgeR * 1.8;
      doc.addImage(assets.logoDataUrl, 'PNG', badgeCx - imgSize / 2, badgeCy - imgSize / 2, imgSize, imgSize);
    } catch {
      // keep the plain white badge if the image fails to decode
    }
  }

  let wordX = margin + 28;
  const wordY = 23;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Boxed', wordX, wordY);
  wordX += doc.getTextWidth('Boxed');
  doc.setTextColor(...AMBER);
  doc.text('2', wordX, wordY);
  wordX += doc.getTextWidth('2');
  doc.setTextColor(255, 255, 255);
  doc.text('Built', wordX, wordY);

  doc.setFontSize(8);
  doc.setTextColor(...PALE_BLUE);
  doc.text(TAGLINE, margin + 28, wordY + 6.5);

  doc.setFontSize(9);
  const pillPadX = 4;
  const pillW = doc.getTextWidth(opts.pill) + 2 * pillPadX;
  const pillH = 8;
  const pillX = pageWidth - margin - pillW;
  const pillY = 12;
  doc.setFillColor(...AMBER_PILL_BG);
  doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'F');
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'S');
  doc.setTextColor(...AMBER_LIGHT_TEXT);
  doc.text(opts.pill, pillX + pillW / 2, pillY + 5.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PALE_BLUE);
  doc.text(contact.phone, pageWidth - margin, pillY + pillH + 7, { align: 'right' });
  doc.text(contact.email, pageWidth - margin, pillY + pillH + 12, { align: 'right' });
  doc.text(contact.website.replace(/^https?:\/\//, ''), pageWidth - margin, pillY + pillH + 17, { align: 'right' });

  doc.setFillColor(...NAVY_DARK);
  doc.rect(0, HEADER_HEIGHT, pageWidth, BAND_HEIGHT, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PALE_BLUE);
  doc.text(opts.bandTag, margin, HEADER_HEIGHT + 6);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.bandTitle, margin, HEADER_HEIGHT + 12);

  doc.setFontSize(7.5);
  doc.setTextColor(...PALE_BLUE);
  doc.text(opts.bandRightTag, pageWidth - margin, HEADER_HEIGHT + 6, { align: 'right' });
  doc.setFontSize(12);
  doc.setTextColor(...AMBER_LIGHT_TEXT);
  doc.text(opts.bandRightText, pageWidth - margin, HEADER_HEIGHT + 12, { align: 'right' });
}

/** Navy heading with a short amber rule underneath. Returns the next y. */
export function drawSectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...NAVY);
  doc.text(text, FLYER_MARGIN, y);
  doc.setFillColor(...AMBER);
  doc.rect(FLYER_MARGIN, y + 2, 12, 0.9, 'F');
  return y + 9;
}

export interface BenefitCard {
  title: string;
  desc: string;
}

/** A row of equal-width cards with an amber top edge. Returns the next y. */
export function drawBenefitCards(doc: jsPDF, cards: BenefitCard[], y: number): number {
  const margin = FLYER_MARGIN;
  const gap = 4;
  const cardW = (doc.internal.pageSize.getWidth() - margin * 2 - gap * (cards.length - 1)) / cards.length;
  const padding = 4;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const wrapped = cards.map((card) => doc.splitTextToSize(card.desc, cardW - padding * 2) as string[]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const titles = cards.map((card) => doc.splitTextToSize(card.title, cardW - padding * 2) as string[]);

  const titleLines = Math.max(...titles.map((t) => t.length));
  const descLines = Math.max(...wrapped.map((w) => w.length));
  const cardH = padding + 2 + titleLines * 4.4 + 2 + descLines * 4 + padding;

  cards.forEach((_, i) => {
    const x = margin + i * (cardW + gap);
    doc.setFillColor(...PANEL_BG);
    doc.setDrawColor(...PANEL_BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(...AMBER);
    doc.rect(x + 0.5, y, cardW - 1, 1.2, 'F');

    let ty = y + padding + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(titles[i], x + padding, ty);
    ty += titleLines * 4.4 + 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...BODY_TEXT);
    doc.text(wrapped[i], x + padding, ty);
  });

  return y + cardH + 8;
}

/** Two bulleted columns: where we work and what is included. Returns the next y. */
export function drawAreasAndIncluded(doc: jsPDF, areas: string[], included: string[], y: number): number {
  const margin = FLYER_MARGIN;
  const colWidth = (doc.internal.pageSize.getWidth() - margin * 2) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('SERVICE AREAS', margin, y);
  doc.text("WHAT'S INCLUDED", margin + colWidth + 4, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BODY_TEXT);
  const rows = Math.max(areas.length, included.length);
  for (let i = 0; i < rows; i++) {
    if (areas[i]) {
      doc.setTextColor(...AMBER);
      doc.text('•', margin + 1, y);
      doc.setTextColor(...BODY_TEXT);
      doc.text(areas[i], margin + 5, y);
    }
    if (included[i]) {
      doc.setTextColor(...AMBER);
      doc.text('•', margin + colWidth + 5, y);
      doc.setTextColor(...BODY_TEXT);
      doc.text(included[i], margin + colWidth + 9, y);
    }
    y += 4.8;
  }
  return y;
}

interface FooterOptions {
  cta: string;
  subline: string;
}

export function drawFooter(doc: jsPDF, assets: FlyerAssets, contact: FlyerContact, opts: FooterOptions): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = FLYER_MARGIN;
  const footerY = pageHeight - FOOTER_HEIGHT;

  doc.setFillColor(...NAVY);
  doc.rect(0, footerY, pageWidth, FOOTER_HEIGHT, 'F');
  doc.setFillColor(...AMBER);
  doc.rect(0, footerY, pageWidth, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.cta, margin, footerY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PALE_BLUE);
  doc.text(opts.subline, margin, footerY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...AMBER_LIGHT_TEXT);
  doc.text(contact.phone, margin, footerY + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(contact.email, margin, footerY + 32);
  doc.text('boxed2built.com/partners', margin, footerY + 37);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(FOUNDER_NAME, margin, footerY + 43.5);
  const founderW = doc.getTextWidth(FOUNDER_NAME);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PALE_BLUE);
  doc.text('|  Owner, Boxed2Built', margin + founderW + 2, footerY + 43.5);

  const tile = 30;
  const tileX = pageWidth - margin - tile;
  const tileY = footerY + 5.5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(tileX, tileY, tile, tile, 2, 2, 'F');
  doc.addImage(assets.qrDataUrl, 'PNG', tileX + 1, tileY + 1, tile - 2, tile - 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...AMBER_LIGHT_TEXT);
  doc.text('SCAN TO PARTNER WITH US', tileX + tile / 2, tileY + tile + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PALE_BLUE);
  doc.text('Labor-only service (not subject to TN sales tax)', pageWidth - margin, pageHeight - 3.5, { align: 'right' });
}
