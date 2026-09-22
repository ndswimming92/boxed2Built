import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

interface AddToWalletButtonProps {
  code: string;
  /** Admins download the pass to check it; customers add it to their phone. */
  variant?: 'customer' | 'admin';
  className?: string;
}

/**
 * Links to the signed .pkpass for a coupon.
 *
 * A plain anchor on purpose: Wallet opens on a real navigation, and a fetch
 * would just hand us bytes the browser does nothing with.
 */
export default function AddToWalletButton({
  code,
  variant = 'customer',
  className = '',
}: AddToWalletButtonProps) {
  // Undefined until mounted: this site pre-renders through vite-react-ssg, so
  // navigator does not exist at build time.
  const [isApple, setIsApple] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isMacSafari = /Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
    setIsApple(isIos || isMacSafari);
  }, []);

  const href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-coupon-pass?code=${encodeURIComponent(code)}`;

  // Customers on Android or a desktop browser get nothing rather than a button
  // that hands them a file their device cannot open. Admins always get it, so
  // the pass can be checked from any machine.
  if (variant === 'customer' && isApple !== true) return null;

  if (variant === 'admin') {
    return (
      <a
        href={href}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors ${className}`}
      >
        <Wallet className="w-4 h-4" />
        Wallet pass
      </a>
    );
  }

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors ${className}`}
    >
      <Wallet className="w-4 h-4" />
      Add to Apple Wallet
    </a>
  );
}
