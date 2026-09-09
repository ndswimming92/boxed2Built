/**
 * Test harness for a client's referral QR modal.
 *
 * The modal lives behind the admin auth guard, but what matters about it needs
 * no login: the URL it bakes into artwork that gets printed on physical tokens.
 * A wrong host there cannot be corrected after the fact, so the payload is
 * rendered into the page for the spec to read directly.
 *
 * Not part of the app build - reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import ClientQRCodeModal from '../../src/components/admin/ClientQRCodeModal';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { getReferralQRPayload } from '../../src/services/referralQRService';

const params = new URLSearchParams(window.location.search);
const code = params.get('code') || 'B2B-ADRIA-4F7D';
const name = params.get('name') || 'Adria Longmire';

function Harness() {
  return (
    <>
      {/* What the QR image actually encodes, which the artwork inherits. */}
      <pre data-testid="qr-payload">{getReferralQRPayload(code)}</pre>
      <ToastProvider>
        <ClientQRCodeModal
          isOpen
          onClose={() => {}}
          clientName={name}
          referralCode={code}
          scanCount={Number(params.get('scans') ?? 0)}
          lastScannedAt={params.get('last')}
        />
      </ToastProvider>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
