import { BUSINESS_INFO } from '../constants/localSEO';

const DEFAULT_PHONE_MACHINE = BUSINESS_INFO.phone;

export function formatPhoneForSchema(phone: string | null | undefined): string {
  if (!phone) return DEFAULT_PHONE_MACHINE;

  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;

  return phone.startsWith('+') ? phone : DEFAULT_PHONE_MACHINE;
}

export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const schemaPhone = formatPhoneForSchema(phone);
  const cleaned = schemaPhone.replace(/\D/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return BUSINESS_INFO.phoneFormatted;
}

