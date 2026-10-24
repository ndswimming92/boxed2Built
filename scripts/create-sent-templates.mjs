#!/usr/bin/env node
/**
 * Creates the four customer SMS templates in Sent (sent.dm) and submits them
 * for review, then prints the Supabase secrets to set from their IDs.
 *
 *   SENT_DM_API_KEY=sk_live_... node scripts/create-sent-templates.mjs
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

const CONTACT = 'Questions? Email nicholas.davidson@boxed2built.com.';
const STOP = 'Reply STOP to opt out.';

const text = (id, name, sample) => ({ id, name, type: 'variable', props: { variableType: 'text', sample } });
const link = (id, name, sample) => ({ id, name, type: 'variable', props: { variableType: 'link', sample } });

const TEMPLATES = [
  {
    secret: 'SENT_TEMPLATE_BOOKING_CONFIRMED',
    template: `Boxed2Built: Hi {{0:variable}}, you're confirmed for {{1:variable}}. ${CONTACT} ${STOP}`,
    variables: [text(0, 'customerName', 'Jamie'), text(1, 'appointmentTime', 'Saturday, October 25 at 10:00 AM')],
  },
  {
    secret: 'SENT_TEMPLATE_JOB_REMINDER',
    template: `Boxed2Built: Hi {{0:variable}}, a reminder that we'll see you {{1:variable}}. Address: {{2:variable}}. ${CONTACT} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'appointmentTime', 'tomorrow at 10:00 AM'),
      text(2, 'serviceAddress', '123 Main St, Spring Hill, TN'),
    ],
  },
  {
    secret: 'SENT_TEMPLATE_QUOTE_READY',
    template: `Boxed2Built: Hi {{0:variable}}, your quote {{1:variable}} for {{2:variable}} is ready: {{3:variable}} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'documentNumber', 'Q-1042'),
      text(2, 'amount', '$185.00'),
      link(3, 'viewLink', 'https://www.boxed2built.com/pay/example'),
    ],
  },
  {
    secret: 'SENT_TEMPLATE_INVOICE_READY',
    template: `Boxed2Built: Hi {{0:variable}}, invoice {{1:variable}} for {{2:variable}} is ready to view and pay: {{3:variable}} ${STOP}`,
    variables: [
      text(0, 'customerName', 'Jamie'),
      text(1, 'documentNumber', 'INV-1042'),
      text(2, 'amount', '$185.00'),
      link(3, 'viewLink', 'https://www.boxed2built.com/pay/example'),
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
