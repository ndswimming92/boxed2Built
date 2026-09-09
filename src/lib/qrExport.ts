/**
 * Shared QR rendering and download helpers.
 *
 * Every QR the app produces - marketing codes and per-client referral codes
 * alike - goes through here, so a code scanned off a poster and one printed on
 * a token are generated identically. `errorCorrectionLevel: 'H'` recovers 30%
 * of a damaged symbol, which is what makes a physical code survive scuffing.
 */
import QRCode from 'qrcode';

/** Shared across every export path. Changing these changes existing artwork. */
const QR_OPTIONS = {
  margin: 2,
  errorCorrectionLevel: 'H' as const,
  color: { dark: '#000000', light: '#FFFFFF' }
};

export type QRPngSize = 300 | 600 | 1200;

export function qrPngDataUrl(text: string, width: number): Promise<string> {
  return QRCode.toDataURL(text, { ...QR_OPTIONS, width });
}

export function qrSvgString(text: string): Promise<string> {
  return QRCode.toString(text, { ...QR_OPTIONS, type: 'svg' });
}

export type QRPdfOptions = {
  /** What the QR encodes, and what gets printed under it. */
  text: string;
  /** Printed under the URL - a code name, or the client the code belongs to. */
  title: string;
  /** Optional line above the QR, e.g. who the token is for. */
  heading?: string;
};

/**
 * Letter-size, QR centred, URL and title beneath it. jsPDF is imported lazily:
 * it is large, and no page needs it until someone asks for a PDF.
 */
export async function qrPdfBlob({ text, title, heading }: QRPdfOptions): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const dataURL = await qrPngDataUrl(text, 600);

  const imgWidth = 100;
  const imgHeight = 100;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const x = (pageWidth - imgWidth) / 2;
  const y = 80;

  if (heading) {
    pdf.setFontSize(16);
    pdf.text(heading, pageWidth / 2, y - 12, { align: 'center' });
  }

  pdf.addImage(dataURL, 'PNG', x, y, imgWidth, imgHeight);

  pdf.setFontSize(12);
  pdf.text(text, pageWidth / 2, y + imgHeight + 15, { align: 'center' });

  pdf.setFontSize(10);
  pdf.text(title, pageWidth / 2, y + imgHeight + 25, { align: 'center' });

  return pdf.output('blob');
}

/** Triggers a browser download and releases the object URL afterwards. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    downloadHref(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Same, for an href that needs no revoking (a data: URL from qrPngDataUrl). */
export function downloadHref(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Turns a name into something safe for a filename: lowercase, dashes, no
 * punctuation a filesystem or download header would object to.
 */
export function toFileSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}
