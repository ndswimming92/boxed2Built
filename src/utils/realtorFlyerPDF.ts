import { SERVICES } from '../constants';
import {
  AMBER,
  BODY_TEXT,
  FLYER_MARGIN,
  CONTENT_TOP,
  GREEN_TEXT,
  NAVY,
  PANEL_BG,
  PANEL_BORDER,
  SLATE_LABEL,
  drawAreasAndIncluded,
  drawBenefitCards,
  drawFooter,
  drawHeader,
  drawSectionHeading,
  formatPhone,
  loadFlyerAssets,
} from './flyerBranding';

export { formatPhone };

interface BusinessData {
  info?: {
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
    slogan?: string | null;
  };
}

export async function generateRealtorFlyerPDF(businessData?: BusinessData): Promise<void> {
  const [{ default: jsPDF }, assets] = await Promise.all([import('jspdf'), loadFlyerAssets()]);
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = FLYER_MARGIN;
  const contentWidth = pageWidth - margin * 2;

  const contact = {
    phone: formatPhone(businessData?.info?.phone || '+16154034538'),
    email: businessData?.info?.email || 'nicholas.davidson@boxed2built.com',
    website: businessData?.info?.website || 'https://boxed2built.com',
  };

  drawHeader(doc, assets, contact, {
    pill: 'REALTOR PARTNERS',
    bandTag: 'PARTNERSHIP PROGRAM',
    bandTitle: 'Realtor Partnership Program',
    bandRightTag: 'BUYER DISCOUNT',
    bandRightText: '10% off first service',
  });

  let y = CONTENT_TOP;

  // --- INTRO ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BODY_TEXT);
  const introLines = doc.splitTextToSize(
    'Give your clients a stress-free move-in. We assemble their furniture so buyers enjoy their new home from day one. Partner with us to offer a closing gift they will actually use.',
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 5 + 6;

  // --- WHY PARTNER WITH US ---
  y = drawSectionHeading(doc, 'Why Realtors Partner With Us', y);
  y = drawBenefitCards(
    doc,
    [
      { title: 'A closing gift clients use', desc: 'Professional furniture assembly your buyers will appreciate on day one.' },
      { title: 'Fast help for move-in day', desc: 'We coordinate directly with closing timelines and buyer schedules.' },
      { title: 'Personalized discount code', desc: 'Track referrals and add value with a code tied to your name.' },
    ],
    y
  );

  // --- PRICING (left) + REFERRAL CODE (right) ---
  const gap = 8;
  const refW = 62;
  const tableW = contentWidth - refW - gap;
  const refX = margin + tableW + gap;
  const sectionTop = y;

  y = drawSectionHeading(doc, 'Pricing at a Glance', y);
  const tableTop = y - 4;

  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, tableTop, tableW, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('SERVICE', margin + 3, tableTop + 4.8);
  doc.text('PRICE RANGE', margin + tableW - 3, tableTop + 4.8, { align: 'right' });

  let rowY = tableTop + 7;
  SERVICES.forEach((service, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(...PANEL_BG);
      doc.rect(margin, rowY, tableW, 6.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BODY_TEXT);
    doc.text(service.type, margin + 3, rowY + 4.4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(service.priceRange || '', margin + tableW - 3, rowY + 4.4, { align: 'right' });
    rowY += 6.5;
  });
  doc.setDrawColor(...PANEL_BORDER);
  doc.setLineWidth(0.2);
  doc.line(margin, rowY, margin + tableW, rowY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LABEL);
  doc.text('Starting at $85 per item. Volume discounts for multiple pieces.', margin, rowY + 5);
  const tableBottom = rowY + 5;

  // Referral code card
  const refTop = sectionTop + 1;
  const refH = tableBottom - refTop;
  doc.setFillColor(...PANEL_BG);
  doc.roundedRect(refX, refTop, refW, refH, 2, 2, 'F');
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([3, 2], 0);
  doc.roundedRect(refX, refTop, refW, refH, 2, 2, 'S');
  doc.setLineDashPattern([], 0);

  const refCx = refX + refW / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LABEL);
  doc.text('YOUR REFERRAL CODE', refCx, refTop + 9, { align: 'center' });
  doc.setFontSize(12.5);
  doc.setTextColor(...GREEN_TEXT);
  doc.text('REALTOR-YOURNAME', refCx, refTop + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BODY_TEXT);
  const refLines = doc.splitTextToSize(
    'Clients get 10% off their first service. You earn referral credit toward future services.',
    refW - 10
  );
  doc.text(refLines, refCx, refTop + 24, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LABEL);
  doc.text('Contact us to set up your code.', refCx, refTop + refH - 5, { align: 'center' });

  y = tableBottom + 11;

  // --- SERVICE AREAS & WHAT'S INCLUDED ---
  drawAreasAndIncluded(
    doc,
    ['Spring Hill', 'Franklin', 'Brentwood', 'Nashville', 'Columbia', "Thompson's Station", 'Williamson & Maury Counties'],
    ['Unboxing & full assembly', 'Leveling & stability checks', 'Placement in desired room', 'Anti-tip wall securing', 'Debris cleanup', 'Safety inspection', 'Professional tools provided'],
    y
  );

  drawFooter(doc, assets, contact, {
    cta: 'Ready to partner? Contact us today.',
    subline: 'Let us take furniture assembly off your closing checklist.',
  });

  doc.save('Boxed2Built-Realtor-Partnership-Flyer.pdf');
}
