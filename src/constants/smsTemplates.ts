/**
 * Starting wording for the Admin > SMS Templates page.
 *
 * The variable names of the four service templates are the parameter names the
 * edge functions send (supabase/functions/_shared/sentSms.ts callers), so the
 * page lets you edit the wording and sample values but not those names. A name
 * ending in "Link" is sent with room for a long URL (see sendCustomerSms).
 * Twin file: supabase/functions/_shared/sentTemplates.ts (checks the server
 * repeats before anything goes to Sent).
 *
 * Length matters: Sent bills each text segment. A plain-alphabet message fits
 * 160 characters in one segment, then 153 per segment after that; one curly
 * quote, dash or emoji drops that to 70 and 67. These aim for two segments with
 * typical values, and the samples are realistic so the page's estimate is too.
 */

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export interface TemplateVariable {
  id: number;
  name: string;
  variableType: 'text' | 'link';
  sample: string;
}

export interface TemplateDefault {
  key: string;
  label: string;
  description: string;
  /** Supabase secret the approved template's ID goes in. */
  secret: string;
  category: TemplateCategory;
  body: string;
  variables: TemplateVariable[];
  /** False for a template no sender uses yet, so its names are free to change. */
  wiredToSender: boolean;
}

const CONTACT = 'Call (615) 403-4538 or email nicholas.davidson@boxed2built.com.';
const STOP = 'Reply STOP to opt out.';

const text = (id: number, name: string, sample: string): TemplateVariable => ({ id, name, variableType: 'text', sample });
const link = (id: number, name: string, sample: string): TemplateVariable => ({ id, name, variableType: 'link', sample });

// Same shape and length as a real customer link: /pay/<invoice id>/<access token>.
const SAMPLE_PAY_LINK =
  'https://www.boxed2built.com/pay/8f3c2a1e-5b7d-4c9a-9e21-3d6f7a1b2c4d/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

export const TEMPLATE_DEFAULTS: TemplateDefault[] = [
  {
    key: 'booking_confirmed',
    label: 'Booking confirmed',
    description: 'Sent right after a customer books a time.',
    secret: 'SENT_TEMPLATE_BOOKING_CONFIRMED',
    category: 'UTILITY',
    body: `Boxed2Built: Hi {{0:variable}}, your {{1:variable}} is confirmed for {{2:variable}}. Booking ref: {{3:variable}}. Need to reschedule or have questions? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'serviceName', 'Furniture Assembly'),
      text(2, 'appointmentTime', 'Saturday, October 25 at 10:00 AM'),
      text(3, 'bookingReference', 'BK-66BB65'),
    ],
    wiredToSender: true,
  },
  {
    key: 'job_reminder',
    label: 'Job reminder',
    description: 'Sent the day before a scheduled job.',
    secret: 'SENT_TEMPLATE_JOB_REMINDER',
    category: 'UTILITY',
    body: `Boxed2Built: Hi {{0:variable}}, a reminder that we'll see you {{1:variable}} for your {{2:variable}} appointment. Address: {{3:variable}}. Need to reschedule? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'appointmentTime', 'tomorrow at 10:00 AM'),
      text(2, 'serviceName', 'Furniture Assembly'),
      text(3, 'serviceAddress', '123 Main St, Spring Hill, TN'),
    ],
    wiredToSender: true,
  },
  {
    key: 'quote_ready',
    label: 'Quote ready',
    description: 'Sent when a quote is emailed to a customer.',
    secret: 'SENT_TEMPLATE_QUOTE_READY',
    category: 'UTILITY',
    body: `Boxed2Built: Hi {{0:variable}}, your quote {{1:variable}} for {{2:variable}} is ready. View it here: {{3:variable}} Questions? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'documentNumber', 'Q-1042'),
      text(2, 'amount', '$185.00'),
      link(3, 'viewLink', SAMPLE_PAY_LINK),
    ],
    wiredToSender: true,
  },
  {
    key: 'invoice_ready',
    label: 'Invoice ready',
    description: 'Sent when an invoice is emailed to a customer.',
    secret: 'SENT_TEMPLATE_INVOICE_READY',
    category: 'UTILITY',
    body: `Boxed2Built: Hi {{0:variable}}, invoice {{1:variable}} for {{2:variable}} is ready. View and pay online here: {{3:variable}} Questions? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'documentNumber', 'INV-1042'),
      text(2, 'amount', '$185.00'),
      link(3, 'viewLink', SAMPLE_PAY_LINK),
    ],
    wiredToSender: true,
  },
  {
    key: 'promotion',
    label: 'Promotion',
    description: 'A starter for offers and discounts. Only customers who ticked the promotional box may receive it.',
    secret: 'SENT_TEMPLATE_PROMOTION',
    category: 'MARKETING',
    body: `Boxed2Built: Hi {{0:variable}}, {{1:variable}} Details: {{2:variable}} Questions? ${CONTACT} Msg&data rates may apply. ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'offerText', 'take 10% off your next furniture assembly this month.'),
      link(2, 'offerLink', 'https://www.boxed2built.com/'),
    ],
    wiredToSender: false,
  },
];

export const MAX_BODY_LENGTH = 600;

const PLACEHOLDER = /\{\{(\d+):variable\}\}/g;

/** The message as a customer would see it, with each variable replaced by its sample. */
export function renderPreview(body: string, variables: TemplateVariable[]): string {
  return body.replace(PLACEHOLDER, (whole, id) => variables.find((v) => v.id === Number(id))?.sample ?? whole);
}

// The standard SMS alphabet (GSM 7-bit), written out for plain English text: printable ASCII
// without the backtick, plus a newline. ^ { } \ [ ] ~ | are in it but cost two characters each.
const GSM_PLAIN = /^[\n\x20-\x5F\x61-\x7E]$/;
const GSM_DOUBLE = new Set(['^', '{', '}', '\\', '[', ']', '~', '|']);

/** Characters that would push a text out of the standard SMS alphabet, without repeats. */
export function findNonGsmCharacters(text: string): string[] {
  const markerFree = text.replace(PLACEHOLDER, '');
  return [...new Set([...markerFree].filter((ch) => !GSM_PLAIN.test(ch)))];
}

/** How many text segments Sent will bill for this message, and whether it needs the 70-character alphabet. */
export function countSegments(text: string): { length: number; segments: number; unicode: boolean } {
  const unicode = findNonGsmCharacters(text).length > 0;
  if (unicode) {
    const length = [...text].length;
    return { length, segments: length <= 70 ? 1 : Math.ceil(length / 67), unicode };
  }
  const length = [...text].reduce((total, ch) => total + (GSM_DOUBLE.has(ch) ? 2 : 1), 0);
  return { length, segments: length <= 160 ? 1 : Math.ceil(length / 153), unicode };
}

/** Everything wrong with a draft, in plain English; empty means it can be sent. */
export function validateTemplate(body: string, variables: TemplateVariable[]): string[] {
  const problems: string[] = [];
  const trimmed = body.trim();
  if (!trimmed) return ['The message is empty.'];
  if (trimmed.length > MAX_BODY_LENGTH) problems.push(`The message is over ${MAX_BODY_LENGTH} characters.`);
  if (!/^Boxed2Built:/.test(trimmed)) problems.push('The message must start with "Boxed2Built:" so customers know who it is from.');
  if (!/reply\s+stop\b/i.test(trimmed)) problems.push('The message must tell customers they can reply STOP to opt out.');

  const odd = findNonGsmCharacters(trimmed);
  if (odd.length) {
    problems.push(
      `The message has characters outside the standard SMS alphabet (${odd.map((c) => `"${c}"`).join(' ')}), such as curly quotes, long dashes or emoji. They make every segment hold 70 characters instead of 160, which can triple the cost. Use plain keyboard characters.`,
    );
  }

  const used = [...trimmed.matchAll(PLACEHOLDER)].map((m) => Number(m[1]));
  const declared = variables.map((v) => v.id);
  if (new Set(used).size !== used.length) problems.push('A variable appears more than once in the message.');
  for (const id of used) {
    if (!declared.includes(id)) problems.push(`The message uses {{${id}:variable}} but no variable ${id} is defined.`);
  }
  for (const id of declared) {
    if (!used.includes(id)) problems.push(`Variable ${id} is defined but the message never uses it, so keep {{${id}:variable}} in the text.`);
  }
  for (const v of variables) {
    if (!v.sample.trim()) problems.push(`Variable ${v.id} (${v.name}) needs a sample value; Sent's reviewers see it.`);
  }
  return problems;
}
