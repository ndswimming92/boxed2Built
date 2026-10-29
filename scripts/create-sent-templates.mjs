#!/usr/bin/env node
/**
 * Creates the four customer SMS templates in Sent (sent.dm) and submits them
 * for review, then prints the Supabase secrets to set from their IDs.
 *
 *   SENT_DM_API_KEY=sk_live_... node scripts/create-sent-templates.mjs
 *
 * Admin > SMS Templates does the same from the browser and is the easier way.
 * This is the fallback; keep its wording in step with src/constants/smsTemplates.ts.
 *
 * The variable names here are the parameter names the edge functions send
 * (supabase/functions/_shared/sentSms.ts callers), so edit both together.
 * Run it once: each run creates new templates.
 */

const apiKey = process.env.SENT_DM_API_KEY?.trim();
if (!apiKey) {
  console.error('Set SENT_DM_API_KEY first.');
  process.exit(1);
}

const CONTACT = 'Call (615) 403-4538 or email nicholas.davidson@boxed2built.com.';
const STOP = 'Reply STOP to opt out.';
const SAMPLE_PAY_LINK =
  'https://www.boxed2built.com/pay/8f3c2a1e-5b7d-4c9a-9e21-3d6f7a1b2c4d/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const text = (id, name, sample) => ({ id, name, type: 'variable', props: { variableType: 'text', sample } });
const link = (id, name, sample) => ({ id, name, type: 'variable', props: { variableType: 'link', sample } });

const TEMPLATES = [
  {
    secret: 'SENT_TEMPLATE_BOOKING_CONFIRMED',
    template: `Boxed2Built: Hi {{0:variable}}, your {{1:variable}} is confirmed for {{2:variable}}. Booking ref: {{3:variable}}. Need to reschedule or have questions? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'serviceName', 'Furniture Assembly'),
      text(2, 'appointmentTime', 'Saturday, October 25 at 10:00 AM'),
      text(3, 'bookingReference', 'BK-66BB65'),
    ],
  },
  {
    secret: 'SENT_TEMPLATE_JOB_REMINDER',
    template: `Boxed2Built: Hi {{0:variable}}, a reminder that we'll see you {{1:variable}} for your {{2:variable}} appointment. Address: {{3:variable}}. Need to reschedule? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'appointmentTime', 'tomorrow at 10:00 AM'),
      text(2, 'serviceName', 'Furniture Assembly'),
      text(3, 'serviceAddress', '123 Main St, Spring Hill, TN'),
    ],
  },
  {
    secret: 'SENT_TEMPLATE_QUOTE_READY',
    template: `Boxed2Built: Hi {{0:variable}}, your quote {{1:variable}} for {{2:variable}} is ready. View it here: {{3:variable}} Questions? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'documentNumber', 'Q-1042'),
      text(2, 'amount', '$185.00'),
      link(3, 'viewLink', SAMPLE_PAY_LINK),
    ],
  },
  {
    secret: 'SENT_TEMPLATE_INVOICE_READY',
    template: `Boxed2Built: Hi {{0:variable}}, invoice {{1:variable}} for {{2:variable}} is ready. View and pay online here: {{3:variable}} Questions? ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'documentNumber', 'INV-1042'),
      text(2, 'amount', '$185.00'),
      link(3, 'viewLink', SAMPLE_PAY_LINK),
    ],
  },
];

const secrets = [];
for (const { secret, template, variables } of TEMPLATES) {
  const response = await fetch('https://api.sent.dm/v3/templates', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'UTILITY',
      language: 'en_US',
      submit_for_review: true,
      definition: { body: { multiChannel: { type: 'text', template, variables } } },
    }),
  });
  const body = await response.json().catch(() => null);
  const id = body?.data?.id ?? body?.data?.template_id;
  if (!response.ok || !id) {
    console.error(`${secret}: failed (${response.status})`, JSON.stringify(body?.error ?? body));
    continue;
  }
  secrets.push(`${secret}=${id}`);
  console.log(`${secret}: created ${id} (${body?.data?.status ?? 'submitted'})`);
}

if (secrets.length) {
  console.log('\nAdd these under Supabase -> Edge Functions -> Secrets:\n');
  for (const line of secrets) console.log(line);
}
