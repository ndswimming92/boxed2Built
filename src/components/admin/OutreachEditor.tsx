import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bold,
  Eye,
  Italic,
  Link2,
  List,
  ListOrdered,
  MousePointerClick,
  Pencil,
  Underline,
  X,
} from 'lucide-react';
import {
  OUTREACH_QUICK_LINKS,
  isSafeLinkUrl,
  renderOutreach,
} from '../../../supabase/functions/_shared/partnerOutreach';

/**
 * The outreach message editor: a toolbar that writes the little markup the
 * server understands (**bold**, *italic*, __underline__, [text](url), bullet
 * and numbered lines, and a [button: …](url) line), over a plain textarea, with
 * a live preview of the finished, branded email beside it.
 *
 * The preview is rendered by the very function the server sends with
 * (`renderOutreach`), so what Nicholas sees as he types is what goes out — only
 * the footer address can be overridden by a server secret, which the Review
 * step shows. Nothing here sends; it only edits the draft text.
 */

type Selection = { start: number; end: number; value: string };

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // Keep the textarea's selection when the toolbar is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {children}
    </button>
  );
}

export function OutreachEditor({
  subject,
  body,
  leadName = null,
  maxLength,
  onChange,
}: {
  subject: string;
  body: string;
  /** The business being emailed; button links carry it as utm_term, as in the sent email. */
  leadName?: string | null;
  maxLength: number;
  onChange: (next: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [linkOpen, setLinkOpen] = useState<null | 'link' | 'button'>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://boxed2built.com/');
  const [showPreviewOnMobile, setShowPreviewOnMobile] = useState(false);

  const preview = useMemo(() => {
    if (!body.trim()) return null;
    try {
      return renderOutreach({ subject, body, postalAddress: null, leadName });
    } catch {
      return null;
    }
  }, [subject, body, leadName]);

  const read = (): Selection => {
    const el = textareaRef.current;
    if (!el) return { start: body.length, end: body.length, value: body };
    return { start: el.selectionStart, end: el.selectionEnd, value: el.value };
  };

  /** Replace [start,end) with `next` and leave the cursor selecting `select`. */
  const apply = (start: number, end: number, next: string, select?: { from: number; to: number }) => {
    const value = textareaRef.current?.value ?? body;
    const updated = value.slice(0, start) + next + value.slice(end);
    if (updated.length > maxLength) return;
    onChange(updated);
    const caretFrom = select ? select.from : start + next.length;
    const caretTo = select ? select.to : caretFrom;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caretFrom, caretTo);
    });
  };

  const wrap = (marker: string, placeholder: string) => {
    const { start, end, value } = read();
    const selected = value.slice(start, end) || placeholder;
    const next = `${marker}${selected}${marker}`;
    // Select the inner text so typing replaces the placeholder.
    apply(start, end, next, { from: start + marker.length, to: start + marker.length + selected.length });
  };

  /** Turn each selected line into a list item with the given prefix. */
  const listify = (ordered: boolean) => {
    const { start, end, value } = read();
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const chosen = value.slice(lineStart, lineEnd) || 'List item';
    const prefixed = chosen
      .split('\n')
      .map((line, index) => {
        const text = line.replace(/^(\s*([-*•]|\d{1,3}[.)])\s+)/, '').trim() || 'List item';
        return ordered ? `${index + 1}. ${text}` : `- ${text}`;
      })
      .join('\n');
    const padBefore = lineStart > 0 && value[lineStart - 1] !== '\n' ? '\n' : '';
    apply(lineStart, lineEnd, `${padBefore}${prefixed}`);
  };

  const openLinkForm = (kind: 'link' | 'button') => {
    const { start, end, value } = read();
    setLinkText(value.slice(start, end) || (kind === 'button' ? 'Book online' : ''));
    setLinkUrl(kind === 'button' ? 'https://boxed2built.com/book' : 'https://boxed2built.com/');
    setLinkOpen(kind);
  };

  const insertLink = () => {
    if (linkOpen === null) return;
    const url = linkUrl.trim();
    if (!isSafeLinkUrl(url)) return;
    const { start, end, value } = read();
    if (linkOpen === 'button') {
      const label = linkText.trim() || 'Book online';
      const before = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
      apply(start, end, `${before}[button: ${label}](${url})\n`);
    } else {
      const label = (linkText.trim() || value.slice(start, end) || url.replace(/^https?:\/\//, '')).replace(/[[\]()]/g, '');
      apply(start, end, `[${label}](${url})`);
    }
    setLinkOpen(null);
  };

  const remaining = maxLength - body.length;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
            <ToolbarButton label="Bold" onClick={() => wrap('**', 'bold text')}>
              <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton label="Italic" onClick={() => wrap('*', 'italic text')}>
              <Italic className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton label="Underline" onClick={() => wrap('__', 'underlined text')}>
              <Underline className="w-4 h-4" />
            </ToolbarButton>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton label="Add link" onClick={() => openLinkForm('link')}>
              <Link2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton label="Bulleted list" onClick={() => listify(false)}>
              <List className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton label="Numbered list" onClick={() => listify(true)}>
              <ListOrdered className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton label="Insert button" onClick={() => openLinkForm('button')}>
              <MousePointerClick className="w-4 h-4" />
            </ToolbarButton>
            <button
              type="button"
              onClick={() => setShowPreviewOnMobile((open) => !open)}
              className="lg:hidden ml-auto inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {showPreviewOnMobile ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreviewOnMobile ? 'Edit' : 'Preview'}
            </button>
          </div>

          {linkOpen && (
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-blue-50/60 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {linkOpen === 'button' ? 'Insert a button' : 'Add a link'}
                </span>
                <button type="button" onClick={() => setLinkOpen(null)} aria-label="Cancel" className="p-0.5 text-slate-500 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                placeholder={linkOpen === 'button' ? 'Button text (e.g. Book online)' : 'Link text'}
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
              />
              <input
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                placeholder="https://boxed2built.com/…"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), insertLink())}
              />
              <div className="flex flex-wrap gap-1.5">
                {OUTREACH_QUICK_LINKS.map((link) => (
                  <button
                    key={link.url}
                    type="button"
                    onClick={() => {
                      setLinkUrl(link.url);
                      if (!linkText.trim()) setLinkText(link.text);
                    }}
                    className="px-2 py-1 rounded-full border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  onClick={insertLink}
                  disabled={!isSafeLinkUrl(linkUrl)}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {linkOpen === 'button' ? 'Insert' : 'Add link'}
                </button>
                {!isSafeLinkUrl(linkUrl) && (
                  <span className="ml-2 text-xs text-red-700">Enter an http(s), mailto: or tel: link.</span>
                )}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            className={`w-full min-h-[18rem] px-3 py-2.5 text-sm leading-relaxed text-slate-900 focus:outline-none resize-y ${
              showPreviewOnMobile ? 'hidden lg:block' : 'block'
            }`}
            value={body}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Message"
          />

          {/* Mobile-only preview, shown in place of the textarea when toggled. */}
          {showPreviewOnMobile && (
            <div className="lg:hidden p-2">
              <PreviewFrame html={preview?.html ?? null} />
            </div>
          )}
        </div>

        <div className="hidden lg:flex flex-col rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
            <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Live preview
          </div>
          {subject.trim() && (
            <div className="px-3 py-2 border-b border-slate-200 text-xs text-slate-600 bg-white">
              <span className="font-semibold text-slate-500">Subject:</span> {subject}
            </div>
          )}
          <div className="p-2 flex-1">
            <PreviewFrame html={preview?.html ?? null} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 max-w-prose">
          Your Boxed2Built contact card, website link, social icons, a one-line opt-out and your mailing address are
          added automatically. End with your own closing (e.g. “Thanks for your time,”); if you don’t, one is added
          for you.
        </p>
        <span className={`text-xs ${remaining < 200 ? 'text-amber-700' : 'text-slate-400'}`}>{remaining} left</span>
      </div>
    </div>
  );
}

function PreviewFrame({ html }: { html: string | null }) {
  if (!html) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400 px-4">
        Start typing to see your email here.
      </div>
    );
  }
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={html}
      className="w-full h-[26rem] rounded-md border border-slate-200 bg-white"
    />
  );
}
