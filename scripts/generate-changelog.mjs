// Builds src/data/changelog.json from git history for the admin Changelog page.
// Run `npm run changelog` (needs full history: `git fetch --unshallow` if needed).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/data/changelog.json');

const SEP = '\x1e';
const FIELD = '\x1f';
const raw = execFileSync(
  'git',
  ['log', '--first-parent', `--format=%H${FIELD}%ad${FIELD}%an${FIELD}%s${FIELD}%b${SEP}`, '--date=short'],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const FILE_EDIT = /^(?:Updated|Added|Update|Create|Created|Delete|Deleted|Rename|Upload|Uploaded) ([\w@./ -]+\.[A-Za-z0-9]{1,5})$/;

const CATEGORIES = [
  ['Security', /secur|rls|row.level|password|passkey|auth|permission|csp|vulnerab|xss|csrf|token|leak|privacy|cors|rate.limit/i],
  ['SEO', /\bseo\b|schema|sitemap|structured data|meta (tag|desc)|canonical|search console|local seo|robots|keyword|open graph/i],
  ['Store', /\bstore\b|shop|product|cart|checkout|stripe|apple.pay|gift.?card|coupon|print.?shop|order/i],
  ['Invoices & Money', /invoice|payment|expense|tax|mileage|forecast|burn|goal|revenue|balance|quote|estimate|subscription/i],
  ['Jobs & Clients', /\bjob|client|contractor|booking|schedule|calendar|reminder|follow.?up|inquir|portal|lead|completion|travel|crew/i],
  ['Content & Gallery', /gallery|image|photo|video|youtube|news|deal|sale|review|testimonial|faq|about|blog|model|3d|stl|qr|referral|social|partner|landing|service|pric|guarantee|legal|fine print|competitor|grant|facebook|footer|page/i],
  ['Email & Notifications', /e-?mail|notif|sms|text message|sign.?in link|reply|resend|message/i],
  ['Design & Mobile', /mobile|responsive|layout|style|design|navbar|menu|hero|button|animation|theme|color|font|spacing|header|footer|modal|ui\b|ux\b|dark/i],
  ['Performance & Fixes', /fix|bug|error|crash|broken|perf|speed|lazy|cache|hydrat|lint|type|test|ci\b|build|deploy|dependabot|bump|dependenc/i],
];

function categorize(title) {
  for (const [name, re] of CATEGORIES) if (re.test(title)) return name;
  return 'Other';
}

const entries = [];
const editsByDate = new Map();

for (const rec of raw.split(SEP)) {
  const text = rec.replace(/^\n/, '');
  if (!text.trim()) continue;
  const [sha, date, author, subject, body = ''] = text.split(FIELD);
  let title = subject.trim();
  let pr;

  const merge = title.match(/^Merge pull request #(\d+) from /);
  if (merge) {
    pr = Number(merge[1]);
    const firstLine = body.trim().split('\n')[0]?.trim();
    title = firstLine || title;
  } else if (/^Merge (branch|remote)/.test(title)) {
    continue;
  } else {
    const squash = title.match(/^(.*) \(#(\d+)\)$/);
    if (squash) {
      title = squash[1].trim();
      pr = Number(squash[2]);
    }
  }

  const fileEdit = title.match(FILE_EDIT);
  if (fileEdit && !pr) {
    const day = editsByDate.get(date) ?? new Set();
    day.add(fileEdit[1].trim());
    editsByDate.set(date, day);
    continue;
  }

  entries.push({
    date,
    title,
    category: categorize(title),
    ...(pr ? { pr } : {}),
    sha: sha.slice(0, 7),
    by: /\[bot\]$/.test(author) ? 'bot' : author === 'Claude' ? 'claude' : 'owner',
  });
}

for (const [date, files] of editsByDate) {
  const list = [...files].sort();
  entries.push({
    date,
    title: `Minor edits to ${list.length} file${list.length === 1 ? '' : 's'}`,
    category: 'Minor edits',
    files: list,
    sha: '',
    by: 'owner',
  });
}

entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), entries }, null, 1) + '\n');
console.log(`Wrote ${entries.length} entries to ${out}`);
