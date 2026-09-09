import { useState, useEffect } from 'react';
import { Download, Copy, ExternalLink, FileImage, FileCode, FileText } from 'lucide-react';
import {
  qrPngDataUrl,
  qrSvgString,
  qrPdfBlob,
  downloadBlob,
  downloadHref,
  type QRPngSize
} from '../../lib/qrExport';
import { QRCodeWithSchedules } from '../../lib/supabase';
import { getShortURL } from '../../services/qrCodeService';
import { useToast } from '../../contexts/ToastContext';

type Props = {
  qrCode: QRCodeWithSchedules;
};

type DownloadFormat = 'png' | 'svg' | 'pdf';
type PNGSize = QRPngSize;

export default function QRCodePreviewDownload({ qrCode }: Props) {
  const [selectedSize] = useState<PNGSize>(600);
  const [qrDataURL, setQrDataURL] = useState<string>('');
  const [qrSVG, setQrSVG] = useState<string>('');
  const [downloadingFormat, setDownloadingFormat] = useState<DownloadFormat | null>(null);
  const [copying, setCopying] = useState(false);
  const { showToast } = useToast();

  const shortURL = getShortURL(qrCode.slug);

  useEffect(() => {
    generateQRCode();
  }, [qrCode.slug, selectedSize]);

  const generateQRCode = async () => {
    try {
      setQrDataURL(await qrPngDataUrl(shortURL, selectedSize));
      setQrSVG(await qrSvgString(shortURL));
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownloadPNG = async (size: PNGSize) => {
    setDownloadingFormat('png');
    try {
      const dataURL = await qrPngDataUrl(shortURL, size);
      downloadHref(dataURL, `qr-code-${qrCode.slug}-${size}px.png`);
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
      downloadBlob(new Blob([qrSVG], { type: 'image/svg+xml' }), `qr-code-${qrCode.slug}.svg`);
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
      const blob = await qrPdfBlob({ text: shortURL, title: qrCode.title });
      downloadBlob(blob, `qr-code-${qrCode.slug}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast({ type: 'error', message: 'Failed to download PDF.' });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyURL = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shortURL);
      showToast({ type: 'success', message: 'Short URL copied to clipboard.' });
    } catch (error) {
      console.error('Error copying short URL:', error);
      showToast({ type: 'error', message: 'Failed to copy short URL.' });
    } finally {
      setCopying(false);
    }
  };

  const handleTestScan = () => {
    window.open(shortURL, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code Preview</h3>
        <p className="text-sm text-gray-600">Download in multiple formats for different use cases</p>
      </div>

      <div className="flex justify-center">
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6 inline-block">
          {qrDataURL && (
            <img
              src={qrDataURL}
              alt={`QR Code for ${qrCode.title}`}
              className="w-64 h-64"
            />
          )}
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Short URL:</span>
          <button
            onClick={handleCopyURL}
            disabled={copying}
            className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
        <code className="block bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 break-all">
          {shortURL}
        </code>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleTestScan}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Test Scan
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Download Options</h4>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileImage className="w-5 h-5 text-gray-600" />
              <h5 className="font-medium text-gray-900">PNG (Raster)</h5>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Perfect for digital use on websites, emails, and social media
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => handleDownloadPNG(300)}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div>
                  <div className="font-medium text-gray-900">Small</div>
                  <div className="text-xs text-gray-500">300 × 300px</div>
                  <div className="text-xs text-gray-400">Business Cards</div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => handleDownloadPNG(600)}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div>
                  <div className="font-medium text-gray-900">Medium</div>
                  <div className="text-xs text-gray-500">600 × 600px</div>
                  <div className="text-xs text-gray-400">Flyers</div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => handleDownloadPNG(1200)}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div>
                  <div className="font-medium text-gray-900">Large</div>
                  <div className="text-xs text-gray-500">1200 × 1200px</div>
                  <div className="text-xs text-gray-400">Posters</div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileCode className="w-5 h-5 text-gray-600" />
              <h5 className="font-medium text-gray-900">SVG (Vector)</h5>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Scalable vector format for professional printing and large displays
            </p>
            <button
              onClick={handleDownloadSVG}
              disabled={downloadingFormat !== null}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div>
                <div className="font-medium text-gray-900">Vector Format</div>
                <div className="text-xs text-gray-500">Scales to any size without quality loss</div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <h5 className="font-medium text-gray-900">PDF Document</h5>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Ready-to-print PDF with QR code and short URL on letter-size page
            </p>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingFormat !== null}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div>
                <div className="font-medium text-gray-900">Print-Ready PDF</div>
                <div className="text-xs text-gray-500">Letter size (8.5" × 11")</div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
