import { SERVICES } from '../constants';

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
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const name = businessData?.info?.name || 'Boxed2Built';
  const phone = formatPhone(businessData?.info?.phone || '+16154034538');
  const email = businessData?.info?.email || 'boxed2builtco@gmail.com';
  const website = businessData?.info?.website || 'https://boxed2built.com';
  const slogan = businessData?.info?.slogan || 'We turn boxes into comfort so families can focus on what matters most';

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

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(phone, pageWidth - margin, 14, { align: 'right' });
  doc.text(email, pageWidth - margin, 20, { align: 'right' });
  doc.text(website.replace('https://', ''), pageWidth - margin, 26, { align: 'right' });

  // Green accent line below header
  doc.setFillColor(21, 128, 61);
  doc.rect(0, 42, pageWidth, 3, 'F');

  y = 55;

  // --- TITLE ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Realtor Partnership Program', margin, y);

  y += 10;
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const introLines = doc.splitTextToSize(
    'Give your clients a stress-free move-in. We assemble furniture so buyers enjoy their new home from day one. Partner with us to offer a closing gift that clients actually use.',
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 5 + 8;

  // --- WHY PARTNER WITH US ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Why Realtors Partner With Us', margin, y);
  y += 8;

  const benefits = [
    { title: 'Closing gift clients actually use', desc: 'Professional furniture assembly your buyers will appreciate on day one.' },
    { title: 'Fast help for move-in day', desc: 'We coordinate directly with closing timelines and buyer schedules.' },
    { title: 'Personalized discount code', desc: 'Track referrals and provide added value with a code tied to your name.' },
  ];

  doc.setTextColor(55, 65, 81);
  for (const benefit of benefits) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`•  ${benefit.title}`, margin + 2, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`    ${benefit.desc}`, margin + 2, y);
    y += 7;
  }

  y += 4;

  // --- PRICING SECTION ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Pricing at a Glance', margin, y);
  y += 7;

  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Starting at $85/hour  |  Per-item pricing also available', margin, y);
  y += 8;

  // Pricing table
  doc.setFillColor(239, 246, 255);
  doc.rect(margin, y - 4, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(29, 78, 216);
  doc.text('Service', margin + 3, y);
  doc.text('Price Range', pageWidth - margin - 3, y, { align: 'right' });
  y += 7;

  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  for (const service of SERVICES) {
    doc.setFont('helvetica', 'normal');
    doc.text(service.type, margin + 3, y);
    doc.text(service.priceRange || '', pageWidth - margin - 3, y, { align: 'right' });
    y += 5.5;
  }

  y += 3;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Volume discounts available for multiple pieces. Visit boxed2built.com/services for full details.', margin, y);
  y += 10;

  // --- REFERRAL CODE BOX ---
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Your Realtor Referral Code', margin, y);
  y += 6;

  // Dashed border box
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([3, 2], 0);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'S');
  doc.setLineDashPattern([], 0);

  y += 10;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text('REALTOR-YOURNAME', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text('Share this code with your clients. They receive 10% off their first service,', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.text('and you earn referral credit toward future services.', pageWidth / 2, y, { align: 'center' });

  y += 12;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Contact us to get your personalized code set up.', margin, y);

  y += 10;

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
  const included = ['Unboxing & full assembly', 'Leveling & stability checks', 'Placement in desired room', 'Anti-tip wall securing', 'Debris cleanup', 'Safety inspection', 'Professional tools provided'];

  const rows = Math.max(areas.length, included.length);
  for (let i = 0; i < rows; i++) {
    if (areas[i]) {
      doc.text(`•  ${areas[i]}`, margin + 2, y);
    }
    if (included[i]) {
      doc.text(`•  ${included[i]}`, margin + colWidth + 7, y);
    }
    y += 4.5;
  }

  y += 6;

  // --- FOOTER CTA ---
  const footerHeight = 28;
  const footerY = doc.internal.pageSize.getHeight() - footerHeight;

  doc.setFillColor(21, 128, 61);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Ready to partner? Contact us today!', pageWidth / 2, footerY + 10, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${phone}  |  ${email}  |  boxed2built.com/partners`, pageWidth / 2, footerY + 18, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text('Labor-only service (not subject to TN sales tax)', pageWidth / 2, footerY + 24, { align: 'center' });

  doc.save('Boxed2Built-Realtor-Partnership-Flyer.pdf');
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}
