import { HOST_ROOM_STARTING_PRICE, hostRoomPriceLabel } from '../constants/hostPartners';
import {
  AMBER,
  BODY_TEXT,
  CONTENT_TOP,
  FLYER_MARGIN,
  GREEN_TEXT,
  PANEL_BG,
  drawAreasAndIncluded,
  drawBenefitCards,
  drawFooter,
  drawHeader,
  drawSectionHeading,
  formatPhone,
  loadFlyerAssets,
} from './flyerBranding';

interface BusinessData {
  info?: {
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
    slogan?: string | null;
  };
}

/** One-page flyer for Airbnb hosts, landlords and property managers. */
export async function generateHostFlyerPDF(businessData?: BusinessData): Promise<void> {
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
    pill: 'HOST & PROPERTY PARTNERS',
    bandTag: 'PARTNERSHIP PROGRAM',
    bandTitle: 'Host & Property Manager Program',
    bandRightTag: 'PRICING',
    bandRightText: HOST_ROOM_STARTING_PRICE === null ? 'Priced per room' : `From $${HOST_ROOM_STARTING_PRICE} per room`,
  });

  let y = CONTENT_TOP;

  // --- INTRO ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BODY_TEXT);
  const introLines = doc.splitTextToSize(
    'Furnish a unit in one visit. We unbox and assemble everything so your Airbnb, rental or turnover is guest-ready or tenant-ready without you spending a weekend on it.',
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 5 + 6;

  // --- WHY HOSTS AND MANAGERS CHOOSE US ---
  y = drawSectionHeading(doc, 'Why Hosts & Property Managers Choose Us', y);
  y = drawBenefitCards(
    doc,
    [
      { title: 'A whole unit in one visit', desc: 'Beds, dressers, desks, shelving and more, assembled and placed room by room.' },
      { title: 'Fast turnarounds', desc: 'We work around your booking calendar and move-in dates so units are not sitting empty.' },
      { title: 'Simple per-room pricing', desc: 'Know the cost before we arrive. Larger units and repeat work are welcome.' },
    ],
    y
  );

  // --- PRICING ---
  y = drawSectionHeading(doc, 'Pricing', y);
  const boxH = 24;
  doc.setFillColor(...PANEL_BG);
  doc.roundedRect(margin, y - 4, contentWidth, boxH, 2, 2, 'F');
  doc.setFillColor(...AMBER);
  doc.rect(margin, y - 4, 1.6, boxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...GREEN_TEXT);
  doc.text(hostRoomPriceLabel(), margin + 8, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BODY_TEXT);
  doc.text('Final price depends on the pieces in each room. Contact us for a quote on your unit.', margin + 8, y + 12);
  y += boxH + 12;

  // --- SERVICE AREAS & WHAT'S INCLUDED ---
  drawAreasAndIncluded(
    doc,
    ['Spring Hill', 'Franklin', 'Brentwood', 'Nashville', 'Columbia', "Thompson's Station", 'Williamson & Maury Counties'],
    ['Unboxing & full assembly', 'Leveling & stability checks', 'Placement in each room', 'Anti-tip wall securing', 'Debris cleanup', 'Safety inspection', 'Professional tools provided'],
    y
  );

  drawFooter(doc, assets, contact, {
    cta: 'Ready to furnish your next unit?',
    subline: 'Tell us about your property and we will send a quote.',
  });

  doc.save('Boxed2Built-Host-Property-Manager-Flyer.pdf');
}
