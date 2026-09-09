import { useState, useEffect } from 'react';
import { Download, Copy, Check, ExternalLink, QrCode, ScanLine } from 'lucide-react';
import Modal from '../Modal';
import {
  qrPngDataUrl,
  qrSvgString,
  qrPdfBlob,
  downloadBlob,
  downloadHref,
  toFileSlug,
  type QRPngSize
} from '../../lib/qrExport';
import {
  getReferralLandingURL,
  getReferralQRPayload
} from '../../services/referralQRService';
import { useToast } from '../../contexts/ToastContext';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  referralCode: string;
  scanCount?: number;
  lastScannedAt?: string | null;
};

type DownloadFormat = 'png' | 'svg' | 'pdf';

const PNG_SIZES: { size: QRPngSize; label: string; use: string }[] = [
  { size: 300, label: 'Small', use: 'Business cards' },
  { size: 600, label: 'Medium', use: 'Flyers, stickers' },
  { size: 1200, label: 'Large', use: 'Posters' }
];

function describeLastScan(lastScannedAt?: string | null): string {
  if (!lastScannedAt) return 'never scanned yet';

  const days = Math.floor((Date.now() - new Date(lastScannedAt).getTime()) / 86_400_000);
  if (days <= 0) return 'last scanned today';
  if (days === 1) return 'last scanned yesterday';
  if (days < 30) return `last scanned ${days} days ago`;
  return `last scanned ${new Date(lastScannedAt).toLocaleDateString()}`;
}

/**
 * The scannable form of a client's referral code, for printing on thank-you
 * tokens. The QR encodes an uppercase URL so it stays in QR alphanumeric mode
 * and prints with chunkier squares; the copy button gives the normal-case link
 * for texting. Both resolve to the same place.
 */
export default function ClientQRCodeModal({
  isOpen,
  onClose,
  clientName,
  referralCode,
  scanCount = 0,
  lastScannedAt
}: Props) {
  const [qrDataURL, setQrDataURL] = useState('');
  const [qrSVG, setQrSVG] = useState('');
  const [downloadingFormat, setDownloadingFormat] = useState<DownloadFormat | null>(null);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const shareURL = getReferralLandingURL(referralCode);
  const qrPayload = getReferralQRPayload(referralCode);
  const fileBase = `b2b-referral-${toFileSlug(clientName)}-${referralCode}`;

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      try {
        const [png, svg] = await Promise.all([
          qrPngDataUrl(qrPayload, 600),
          qrSvgString(qrPayload)
        ]);
        if (cancelled) return;
        setQrDataURL(png);
        setQrSVG(svg);
      } catch (error) {
        console.error('Error generating referral QR code:', error);
        showToast({ type: 'error', message: 'Could not generate the QR code.' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, qrPayload]);

  const handleDownloadPNG = async (size: QRPngSize) => {
    setDownloadingFormat('png');
    try {
      downloadHref(await qrPngDataUrl(qrPayload, size), `${fileBase}-${size}px.png`);
    } catch (error) {
      console.error('Error downloading PNG:', error);
      showToast({ type: 'error', message: 'Failed to download PNG.' });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadSVG = () => {
    setDownloadingFormat('svg');
    try {
      downloadBlob(new Blob([qrSVG], { type: 'image/svg+xml' }), `${fileBase}.svg`);
    } catch (error) {
      console.error('Error downloading SVG:', error);
      showToast({ type: 'error', message: 'Failed to download SVG.' });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadingFormat('pdf');
    try {
      const blob = await qrPdfBlob({
        text: shareURL,
        title: `${clientName} · ${referralCode}`,
        heading: 'Referred by a friend'
      });
      downloadBlob(blob, `${fileBase}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast({ type: 'error', message: 'Failed to download PDF.' });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyURL = async () => {
    try {
      await navigator.clipboard.writeText(shareURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast({ type: 'success', message: 'Referral link copied.' });
    } catch (error) {
      console.error('Error copying referral link:', error);
      showToast({ type: 'error', message: 'Failed to copy the link.' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${clientName}'s referral QR`}
      description="Scanning this opens the quote form with their referral code already filled in."
      size="medium"
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6 inline-block">
            {qrDataURL ? (
              <img
                src={qrDataURL}
                alt={`Referral QR code for ${clientName}`}
                className="w-56 h-56"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-gray-300">
                <QrCode className="w-12 h-12" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <ScanLine className="w-4 h-4 text-gray-400" />
          <span>
            <span className="font-semibold text-gray-900">{scanCount}</span>{' '}
            {scanCount === 1 ? 'scan' : 'scans'} · {describeLastScan(lastScannedAt)}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Referral link</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyURL}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                Copy
              </button>
              <button
                onClick={() => window.open(shareURL, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Test
              </button>
            </div>
          </div>
          <code className="block bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 break-all">
            {shareURL}
          </code>
        </div>

        <div className="border-t border-gray-200 pt-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Download</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            {PNG_SIZES.map(({ size, label, use }) => (
              <button
                key={size}
                onClick={() => handleDownloadPNG(size)}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="text-left">
                  <div className="font-medium text-gray-900">{label} PNG</div>
                  <div className="text-xs text-gray-500">{size} × {size}px</div>
                  <div className="text-xs text-gray-400">{use}</div>
                </div>
                <Download className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadSVG}
              disabled={downloadingFormat !== null || !qrSVG}
              className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="text-left">
                <div className="font-medium text-gray-900">SVG</div>
                <div className="text-xs text-gray-500">Vector — for CAD and 3D printing</div>
              </div>
              <Download className="w-4 h-4 text-gray-400 shrink-0" />
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloadingFormat !== null}
              className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="text-left">
                <div className="font-medium text-gray-900">PDF</div>
                <div className="text-xs text-gray-500">Letter size, print-ready</div>
              </div>
              <Download className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
