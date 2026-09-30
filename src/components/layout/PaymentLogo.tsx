import React from 'react';
import { Banknote, CreditCard } from 'lucide-react';

interface PaymentLogoProps {
  method: string;
  size?: number;
}

/** Venmo brand tile: Venmo blue with the white "V" mark. */
const VenmoLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect width="24" height="24" rx="5" fill="#3D95CE" />
    <path
      fill="#fff"
      d="M17.6 5.6c.4.7.6 1.4.6 2.3 0 2.9-2.5 6.6-4.5 9.2h-4.6L7.3 6.4l4-.4.9 7.2c.8-1.3 1.9-3.4 1.9-4.8 0-.8-.1-1.3-.4-1.8l3.9-1z"
    />
  </svg>
);

/** Mastercard interlocking circles, used for debit/credit cards. */
const CardNetworkLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size * 1.5} height={size} viewBox="0 0 36 24" aria-hidden="true" focusable="false">
    <circle cx="13" cy="12" r="10" fill="#EB001B" />
    <circle cx="23" cy="12" r="10" fill="#F79E1B" />
    <path d="M18 4.3a10 10 0 0 1 0 15.4 10 10 0 0 1 0-15.4z" fill="#FF5F00" />
  </svg>
);

/** EMV Contactless Indicator (four waves). */
const ContactlessLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <path d="M6.5 8.5a5 5 0 0 1 0 7" />
    <path d="M10.5 6a8.5 8.5 0 0 1 0 12" />
    <path d="M14.5 3.5a12 12 0 0 1 0 17" />
    <path d="M18.5 1.5a15.5 15.5 0 0 1 0 21" />
  </svg>
);

const ApplePayLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size * 1.5} height={size} viewBox="0 0 36 24" aria-hidden="true" focusable="false">
    <rect width="36" height="24" rx="4" fill="#fff" />
    <path
      fill="#000"
      d="M10.4 7.6c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7.1 1.3-.3 1.7-.8zm.6 1c-.9-.1-1.7.5-2.1.5-.4 0-1.1-.5-1.8-.5-.9 0-1.8.5-2.3 1.4-1 1.7-.3 4.200.7 5.600.5.700 1 1.400 1.800 1.400.7 0 1-.5 1.900-.5s1.100.5 1.900.5c.8 0 1.300-.7 1.800-1.400.6-.8.800-1.500.8-1.600-.1 0-1.500-.6-1.500-2.200 0-1.400 1.100-2 1.200-2.100-.7-1-1.700-1.100-2.100-1.100z"
    />
    <text x="16" y="16" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="#000">Pay</text>
  </svg>
);

const ZelleLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect width="24" height="24" rx="5" fill="#6D1ED4" />
    <path fill="#fff" d="M6.5 6h11v2.600l-6.600 6.800h6.600V18h-11v-2.600L13.100 8.600H6.500z" />
  </svg>
);

const SquareLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect width="24" height="24" rx="5" fill="#fff" />
    <rect x="5" y="5" width="14" height="14" rx="3" fill="#000" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="#fff" />
  </svg>
);

const PaymentLogo: React.FC<PaymentLogoProps> = ({ method, size = 18 }) => {
  const m = method.toLowerCase();
  if (m.includes('venmo')) return <VenmoLogo size={size} />;
  if (m.includes('apple pay')) return <ApplePayLogo size={size} />;
  if (m.includes('zelle')) return <ZelleLogo size={size} />;
  if (m.includes('square')) return <SquareLogo size={size} />;
  if (m.includes('contactless')) return <ContactlessLogo size={size} />;
  if (m.includes('debit') || m.includes('credit')) return <CardNetworkLogo size={size} />;
  if (m.includes('cash')) return <Banknote size={size} className="text-green-400" aria-hidden="true" />;
  return <CreditCard size={size} className="text-gray-300" aria-hidden="true" />;
};

export default PaymentLogo;
