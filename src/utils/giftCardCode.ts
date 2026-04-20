/**
 * Gift card codes use the format B2B-XXXX-XXXX where X is [A-Z0-9]
 * excluding easily confused characters (0/O, 1/I/L).
 */

const GIFT_CARD_CODE_REGEX = /^B2B-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export function isValidGiftCardCode(raw: string): boolean {
  return GIFT_CARD_CODE_REGEX.test(normalizeGiftCardCode(raw));
}

export function normalizeGiftCardCode(raw: string): string {
  return (raw || '').trim().toUpperCase();
}

/** Visual formatter: insert dashes as user types. */
export function formatGiftCardCodeInput(raw: string): string {
  const cleaned = (raw || '')
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, '')
    .slice(0, 11); // B2B + 8 chars = 11 significant chars

  if (cleaned.startsWith('B2B')) {
    const rest = cleaned.slice(3);
    const p1 = rest.slice(0, 4);
    const p2 = rest.slice(4, 8);
    let out = 'B2B';
    if (p1.length) out += `-${p1}`;
    if (p2.length) out += `-${p2}`;
    return out;
  }
  // If they haven't typed B2B yet, treat as 8-char body
  const p1 = cleaned.slice(0, 4);
  const p2 = cleaned.slice(4, 8);
  if (!p1) return '';
  return p2 ? `B2B-${p1}-${p2}` : `B2B-${p1}`;
}

export function maskGiftCardCode(code: string): string {
  const normalized = normalizeGiftCardCode(code);
  if (normalized.length < 4) return normalized;
  const last4 = normalized.slice(-4);
  return `B2B-••••-${last4}`;
}
