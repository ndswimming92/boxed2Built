/**
 * Helpers for a US mobile number field: format as the visitor types, and say
 * in plain English what is wrong with a number. Kept free of browser APIs so
 * `node --test` can import it. The server (text-question) applies the same
 * rules (toUsE164), so a number that passes here passes there.
 */

/** Digits only, with a leading US country code (1) dropped. Area codes never start with 1, so a leading 1 is always the country code. */
export function phoneDigitsOnly(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('1') ? digits.slice(1) : digits;
}

/**
 * "6154034538" -> "(615) 403-4538", built up as digits arrive:
 * "(61", "(615", "(615) 4", "(615) 403", "(615) 403-4". Digits past the tenth are
 * kept on the end (not silently cut) so validatePhoneInput can say it is too long.
 */
export function formatPhoneInput(raw: string): string {
  const digits = phoneDigitsOnly(raw);
  if (!digits) return '';
  const area = digits.slice(0, 3);
  if (digits.length <= 3) return `(${area}`;
  const exchange = digits.slice(3, 6);
  if (digits.length <= 6) return `(${area}) ${exchange}`;
  const line = digits.slice(6, 10);
  const extra = digits.slice(10);
  return `(${area}) ${exchange}-${line}${extra}`;
}

/**
 * What is wrong with the number, or null when it is fine.
 *
 * While the visitor is still typing (`complete` false) only mistakes that more
 * typing cannot fix are reported, so "too short" does not nag on the way to ten
 * digits. On blur or submit (`complete` true) a missing or short number is reported too.
 */
export function validatePhoneInput(raw: string, complete: boolean): string | null {
  const digits = phoneDigitsOnly(raw);

  if (!digits) return complete ? 'Enter your mobile number.' : null;
  if (/^[01]/.test(digits)) return "An area code can't start with 0 or 1. Check the first digits.";
  if (digits.length >= 4 && /^[01]/.test(digits.slice(3))) {
    return "That number doesn't look right. The first digit after the area code can't be 0 or 1.";
  }
  if (digits.length > 10) {
    const extra = digits.length - 10;
    return `That's ${extra} digit${extra === 1 ? '' : 's'} too many. US numbers have 10 digits.`;
  }
  if (digits.length === 10 && /^(\d)\1{9}$/.test(digits)) return "That doesn't look like a real number. Please check it.";
  if (complete && digits.length < 10) {
    const missing = 10 - digits.length;
    return `That's ${missing} digit${missing === 1 ? '' : 's'} short. US numbers have 10 digits.`;
  }
  return null;
}

/**
 * Where the text cursor belongs after reformatting: just past the Nth digit of
 * the formatted text. Counting digits (not characters) keeps the cursor on the
 * same digit even though "(", ")", " " and "-" appear or vanish around it.
 * `digitsBefore` is how many digits sat before the cursor in the text as typed.
 */
export function caretAfterDigits(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === digitsBefore) return i + 1;
  }
  return formatted.length;
}
