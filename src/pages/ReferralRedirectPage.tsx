import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  logReferralScan,
  normalizeReferralCode,
  rememberReferralCode
} from '../services/referralQRService';
import BoxLoader from '../components/BoxLoader';

// Never hold the visitor on the loader waiting for scan logging.
const SCAN_LOG_TIMEOUT_MS = 1500;

/**
 * Landing point for a client's referral QR (`/r/B2B-ADRIA-4F7D`), printed on
 * thank-you tokens. Logs the scan, then forwards to the quote form with the
 * code prefilled.
 *
 * There is no error state on purpose. Someone standing here is holding a
 * physical object with this URL on it; whatever is wrong with the code, the
 * right outcome is still the contact form, not a dead end.
 */
export default function ReferralRedirectPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const handledCode = useRef<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!code) {
        navigate('/contact', { replace: true });
        return;
      }

      // One scan per code per mount: a re-run must not double-count.
      if (handledCode.current === code) return;
      handledCode.current = code;

      const normalized = normalizeReferralCode(code);

      // Held for the rest of the session, so browsing away from the form and
      // back does not lose the referral.
      rememberReferralCode(normalized);

      await Promise.race([
        logReferralScan({
          code: normalized,
          userAgent: navigator.userAgent,
          referrer: document.referrer
        }),
        new Promise((resolve) => setTimeout(resolve, SCAN_LOG_TIMEOUT_MS))
      ]);

      navigate(`/contact?ref=${encodeURIComponent(normalized)}`, { replace: true });
    };

    handleRedirect();
  }, [code, navigate]);

  // Same branded loader the QR short-link redirect uses, so arriving by scan
  // and the page it forwards to feel like one load.
  return <BoxLoader minDurationMs={999999} />;
}
