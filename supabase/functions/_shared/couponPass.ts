// Builds the pass.json for a Boxed2Built coupon.
//
// Kept free of Deno, npm and network imports so it can be unit-tested directly
// from Node, like the other shared modules. The signing and zipping live in
// pkpass.ts; this file only decides what the customer reads.
import { couponShareUrl, describeDiscount, describeValidThrough } from './couponPromo.ts';

export interface CouponPassRow {
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  /** Exclusive: the midnight *after* the last valid day. */
  ends_at: string | null;
}

export interface CouponPassOptions {
  passTypeIdentifier: string;
  teamIdentifier: string;
  siteUrl: string;
  /** Injectable for tests. */
  now?: Date;
}

export const ORGANIZATION_NAME = 'Boxed2Built';

/** Brand colours, matching the invoice email header. */
const BACKGROUND = 'rgb(14, 39, 72)';
const FOREGROUND = 'rgb(255, 255, 255)';
const LABEL = 'rgb(234, 179, 8)';

/** How long before expiry Wallet should start surfacing the pass. */
export const RELEVANT_DAYS_BEFORE_EXPIRY = 3;

export function buildCouponPass(
  coupon: CouponPassRow,
  options: CouponPassOptions,
): Record<string, unknown> {
  const now = options.now ?? new Date();
  const discount = describeDiscount(coupon);
  const shareUrl = couponShareUrl(coupon.code, options.siteUrl);

  const auxiliaryFields: Array<Record<string, string>> = [];
  const pass: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: options.passTypeIdentifier,
    teamIdentifier: options.teamIdentifier,
    organizationName: ORGANIZATION_NAME,
    // One shared code means one pass, so the code is a stable serial. There is
    // no per-customer coupon in this system to key on.
    serialNumber: coupon.code,
    description: `${ORGANIZATION_NAME} coupon — ${discount}`,
    logoText: ORGANIZATION_NAME,
    backgroundColor: BACKGROUND,
    foregroundColor: FOREGROUND,
    labelColor: LABEL,
    barcodes: [
      {
        // Encodes the prefilled quote form rather than the bare code: there is
        // no till to scan this at, so the useful thing a scan can do is open
        // the quote form with the discount already applied.
        format: 'PKBarcodeFormatQR',
        message: shareUrl,
        messageEncoding: 'iso-8859-1',
        altText: coupon.code,
      },
    ],
  };

  if (coupon.ends_at) {
    const endsAtMs = new Date(coupon.ends_at).getTime();

    // The stored instant is exclusive — the moment the code stops working —
    // which is exactly what expirationDate means. The human-readable line below
    // uses the day before it, via describeValidThrough.
    pass.expirationDate = new Date(endsAtMs).toISOString();

    const windowStartMs = endsAtMs - RELEVANT_DAYS_BEFORE_EXPIRY * 86_400_000;
    // relevantDates (plural) replaced the deprecated relevantDate in iOS 18;
    // the singular key is silently ignored on current devices. Clamped to now
    // so a coupon expiring within the window still gets a valid range.
    pass.relevantDates = [
      {
        startDate: new Date(Math.min(Math.max(windowStartMs, now.getTime()), endsAtMs)).toISOString(),
        endDate: new Date(endsAtMs).toISOString(),
      },
    ];

    auxiliaryFields.push({
      key: 'expires',
      label: 'VALID THROUGH',
      value: describeValidThrough(coupon.ends_at),
    });
  }

  pass.coupon = {
    primaryFields: [{ key: 'offer', label: 'OFFER', value: discount }],
    secondaryFields: [{ key: 'code', label: 'CODE', value: coupon.code }],
    auxiliaryFields,
    backFields: [
      ...(coupon.description
        ? [{ key: 'details', label: 'Details', value: coupon.description }]
        : []),
      {
        key: 'howto',
        label: 'How to use it',
        value:
          `Enter code ${coupon.code} when you request a quote, or scan the code on the ` +
          'front of this pass to open the form with the discount already applied.',
      },
      { key: 'link', label: 'Get a quote', value: shareUrl },
    ],
  };

  return pass;
}
