import { hostRoomPriceLabel } from '../constants/hostPartners';
import { formatPhone } from './realtorFlyerPDF';

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
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const name = businessData?.info?.name || 'Boxed2Built';
  const phone = formatPhone(businessData?.info?.phone || '+16154034538');
  const email = businessData?.info?.email || 'nicholas.davidson@boxed2built.com';
  const website = businessData?.info?.website || 'https://boxed2built.com';
  const slogan = businessData?.info?.slogan || 'Turning boxes into comfort so families can focus on what matters most';

  // --- HEADER BANNER ---
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(name, margin, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(slogan, margin, 26);
  doc.text(phone, pageWidth - margin, 14, { align: 'right' });
  doc.text(email, pageWidth - margin, 20, { align: 'right' });
  doc.text(website.replace('https://', ''), pageWidth - margin, 26, { align: 'right' });

  doc.setFillColor(21, 128, 61);
  doc.rect(0, 42, pageWidth, 3, 'F');

  y = 55;

  // --- TITLE ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Host & Property Manager Program', margin, y);

  y += 10;
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const introLines = doc.splitTextToSize(
    'Furnish a unit in one visit. We unbox and assemble everything so your Airbnb, rental or turnover is guest-ready or tenant-ready without you spending a weekend on it.',
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 5 + 8;

  // --- WHY HOSTS AND MANAGERS CHOOSE US ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Why Hosts & Property Managers Choose Us', margin, y);
  y += 8;

  const benefits = [
    { title: 'A whole unit furnished in one visit', desc: 'Beds, dressers, desks, shelving and more, assembled and placed room by room.' },
    { title: 'Fast turnarounds', desc: 'We work around your booking calendar and move-in dates so units are not sitting empty.' },
    { title: 'Simple per-room pricing', desc: 'Know the cost before we arrive. Larger units and repeat work are welcome.' },
  ];

  doc.setTextColor(55, 65, 81);
  for (const benefit of benefits) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`\u2022  ${benefit.title}`, margin + 2, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`    ${benefit.desc}`, margin + 2, y);
    y += 7;
  }

  y += 4;

  // --- PRICING ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Pricing', margin, y);
  y += 8;

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y - 5, contentWidth, 16, 2, 2, 'F');
  doc.setTextColor(21, 128, 61);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(hostRoomPriceLabel(), margin + 5, y + 3);
  y += 20;

  doc.setTextColor(55, 65, 81);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Final price depends on the pieces in each room. Contact us for a quote on your unit.', margin, y);
  y += 12;

  // --- SERVICE AREAS & WHAT'S INCLUDED ---
  const colWidth = contentWidth / 2;

  doc.setTextColor(29, 78, 216);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Service Areas', margin, y);
  doc.text("What's Included", margin + colWidth + 5, y);
  y += 6;

  doc.setTextColor(55, 65, 81);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const areas = ['Spring Hill', 'Franklin', 'Brentwood', 'Nashville', 'Columbia', "Thompson's Station", 'Williamson & Maury Counties'];
  const included = ['Unboxing & full assembly', 'Leveling & stability checks', 'Placement in each room', 'Anti-tip wall securing', 'Debris cleanup', 'Safety inspection', 'Professional tools provided'];

  const rows = Math.max(areas.length, included.length);
  for (let i = 0; i < rows; i++) {
    if (areas[i]) doc.text(`\u2022  ${areas[i]}`, margin + 2, y);
    if (included[i]) doc.text(`\u2022  ${included[i]}`, margin + colWidth + 7, y);
    y += 4.5;
  }

  // --- FOOTER CTA ---
  const footerHeight = 28;
  const footerY = doc.internal.pageSize.getHeight() - footerHeight;

  doc.setFillColor(21, 128, 61);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Ready to furnish your next unit? Contact us today!', pageWidth / 2, footerY + 10, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${phone}  |  ${email}  |  boxed2built.com/partners`, pageWidth / 2, footerY + 18, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text('Labor-only service (not subject to TN sales tax)', pageWidth / 2, footerY + 24, { align: 'center' });

  doc.save('Boxed2Built-Host-Property-Manager-Flyer.pdf');
}
