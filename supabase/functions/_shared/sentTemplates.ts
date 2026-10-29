/**
 * Checks and payload building for the Admin > SMS Templates page.
 *
 * Kept free of Deno APIs so `node --test` can import it; the network and
 * database side lives in manage-sent-templates/index.ts. Twin file for the
 * browser: src/constants/smsTemplates.ts.
 */

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export interface TemplateVariable {
  id: number;
  name: string;
  variableType: 'text' | 'link';
  sample: string;
}

export interface TemplateDraft {
  /** SENT_TEMPLATE_* secret this template's ID belongs in, or null for a custom one. */
  secret: string | null;
  category: TemplateCategory;
  body: string;
  variables: TemplateVariable[];
}

export const MAX_BODY_LENGTH = 600;

const PLACEHOLDER = /\{\{(\d+):variable\}\}/g;

/** Variable positions used in the body, in order of appearance. */
export function placeholderIds(body: string): number[] {
  return [...body.matchAll(PLACEHOLDER)].map((m) => Number(m[1]));
}

// The standard SMS alphabet (GSM 7-bit), written out for plain English text: printable ASCII
// without the backtick, plus a newline. One character outside it (a curly quote, a long dash,
// an emoji) makes Sent send the whole message in 70-character segments instead of 160.
const GSM_PLAIN = /^[\n\x20-\x5F\x61-\x7E]$/;

/** Characters that would push a text out of the standard SMS alphabet, without repeats. */
export function findNonGsmCharacters(text: string): string[] {
  const markerFree = text.replace(PLACEHOLDER, '');
  return [...new Set([...markerFree].filter((ch) => !GSM_PLAIN.test(ch)))];
}

/** Everything wrong with a draft, in plain English; empty means it can be sent. */
export function validateTemplate(draft: TemplateDraft): string[] {
  const problems: string[] = [];
  const body = draft.body.trim();

  if (!body) return ['The message is empty.'];
  if (body.length > MAX_BODY_LENGTH) problems.push(`The message is over ${MAX_BODY_LENGTH} characters.`);
  if (!/^Boxed2Built:/.test(body)) problems.push('The message must start with "Boxed2Built:" so customers know who it is from.');
  if (!/reply\s+stop\b/i.test(body)) problems.push('The message must tell customers they can reply STOP to opt out.');

  const odd = findNonGsmCharacters(body);
  if (odd.length) {
    problems.push(
      `The message has characters outside the standard SMS alphabet (${odd.map((c) => `"${c}"`).join(' ')}), such as curly quotes, long dashes or emoji. Use plain keyboard characters.`,
    );
  }

  const used = placeholderIds(body);
  const declared = draft.variables.map((v) => v.id);
  if (new Set(used).size !== used.length) problems.push('A variable appears more than once in the message.');
  for (const id of used) {
    if (!declared.includes(id)) problems.push(`The message uses {{${id}:variable}} but no variable ${id} is defined.`);
  }
  for (const id of declared) {
    if (!used.includes(id)) problems.push(`Variable ${id} is defined but the message never uses it.`);
  }
  for (const v of draft.variables) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(v.name)) problems.push(`Variable ${v.id} needs a one-word name (letters and numbers).`);
    if (!v.sample.trim()) problems.push(`Variable ${v.id} needs a sample value; Sent's reviewers see it.`);
  }
  return problems;
}

/** The JSON body for POST https://api.sent.dm/v3/templates. */
export function buildSentPayload(draft: TemplateDraft) {
  return {
    category: draft.category,
    language: 'en_US',
    submit_for_review: true,
    definition: {
      body: {
        multiChannel: {
          type: 'text',
          template: draft.body.trim(),
          variables: draft.variables.map((v) => ({
            id: v.id,
            name: v.name,
            type: 'variable',
            props: { variableType: v.variableType, sample: v.sample.trim() },
          })),
        },
      },
    },
  };
}
