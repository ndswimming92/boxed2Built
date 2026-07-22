import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQRCodeBySlug, getActiveScheduleForQRCode } from '../services/qrCodeService';
import { logScan } from '../services/qrScanService';
import BoxLoader from '../components/BoxLoader';

export default function QRRedirectPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!slug) {
        setError(true);
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      try {
        const qrCode = await getQRCodeBySlug(slug);

        if (!qrCode) {
          setError(true);
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        let destinationURL = qrCode.default_destination_url;

        if (qrCode.schedules && qrCode.schedules.length > 0) {
          const activeSchedule = await getActiveScheduleForQRCode(qrCode.id);
          if (activeSchedule) {
            destinationURL = activeSchedule.destination_url;
          }
        }

        const userAgent = navigator.userAgent;
        const referrer = document.referrer;
        const fullURL = window.location.href;

        await logScan(qrCode.id, userAgent, referrer, fullURL);

        window.location.href = destinationURL;
      } catch (err) {
        console.error('Error handling redirect:', err);
        setError(true);
        setTimeout(() => navigate('/'), 2000);
      }
    };

    handleRedirect();
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">QR Code Not Found</h1>
          <p className="text-gray-600 mb-4">This QR code does not exist or is inactive.</p>
          <p className="text-sm text-gray-500">Redirecting to homepage...</p>
        </div>
      </div>
    );
  }

  // Keep the branded box loader visible (no circle spinner) so arriving via a
  // QR slug and the destination page it forwards to feel like one seamless load.
  return <BoxLoader minDurationMs={999999} />;
}
