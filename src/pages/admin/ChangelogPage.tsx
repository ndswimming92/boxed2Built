import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, ScrollText, Search, X } from 'lucide-react';
import changelog from '../../data/changelog.json';

interface ChangelogEntry {
  date: string;
  title: string;
  category: string;
  pr?: number;
  sha: string;
  by: string;
  files?: string[];
}

const ENTRIES = changelog.entries as ChangelogEntry[];
const REPO_URL = 'https://github.com/ndswimming92/boxed2Built';

const CATEGORY_STYLES: Record<string, string> = {
  Security: 'bg-red-50 text-red-700',
  SEO: 'bg-green-50 text-green-700',
  Store: 'bg-purple-50 text-purple-700',
  'Invoices & Money': 'bg-emerald-50 text-emerald-700',
  'Jobs & Clients': 'bg-blue-50 text-blue-700',
  'Content & Gallery': 'bg-amber-50 text-amber-700',
  'Email & Notifications': 'bg-sky-50 text-sky-700',
  'Design & Mobile': 'bg-pink-50 text-pink-700',
  'Performance & Fixes': 'bg-orange-50 text-orange-700',
  'Minor edits': 'bg-gray-100 text-gray-600',
  Other: 'bg-gray-100 text-gray-600',
};

const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatMonth = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function ChangelogPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [showMinor, setShowMinor] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of ENTRIES) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return ENTRIES.filter((e) => {
      if (!showMinor && e.category === 'Minor edits') return false;
      if (category !== 'All' && e.category !== category) return false;
      if (terms.length === 0) return true;
      const haystack = [e.title, e.category, e.date, formatDay(e.date), e.pr ? `#${e.pr}` : '', (e.files ?? []).join(' ')]
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [query, category, showMinor]);

  const grouped = useMemo(() => {
    const months: { month: string; days: { date: string; items: ChangelogEntry[] }[] }[] = [];
    for (const e of filtered) {
      const month = formatMonth(e.date);
      let m = months[months.length - 1];
      if (!m || m.month !== month) {
        m = { month, days: [] };
        months.push(m);
      }
      let d = m.days[m.days.length - 1];
      if (!d || d.date !== e.date) {
        d = { date: e.date, items: [] };
        m.days.push(d);
      }
      d.items.push(e);
    }
    return months;
  }, [filtered]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const oldest = ENTRIES[ENTRIES.length - 1]?.date;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ScrollText className="w-6 h-6" /> Changelog
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every change made to the site, newest first
          {oldest ? `, going back to ${formatDay(oldest)}` : ''}. Last updated {changelog.generatedAt}.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search changes, e.g. invoice, mobile menu, grants, 2026-03, #250"
            aria-label="Search changelog"
            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {[['All', ENTRIES.length] as const, ...categories].map(([name, count]) => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                category === name
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {name} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {filtered.length} of {ENTRIES.length} entries
          </span>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showMinor} onChange={(e) => setShowMinor(e.target.checked)} />
            Include minor file edits
          </label>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          No changes match your search.
        </div>
      ) : (
        grouped.map((m) => (
          <section key={m.month} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 sticky top-0 bg-gray-50 py-2 z-10">{m.month}</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
              {m.days.map((d) => (
                <div key={d.date} className="p-4 sm:flex gap-6">
                  <div className="sm:w-40 shrink-0 text-sm font-medium text-gray-700 mb-2 sm:mb-0">
                    {formatDay(d.date)}
                  </div>
                  <ul className="flex-1 space-y-2">
                    {d.items.map((e, i) => {
                      const key = `${e.date}-${e.sha}-${i}`;
                      const isMinor = e.category === 'Minor edits';
                      return (
                        <li key={key} className="text-sm text-gray-900">
                          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                CATEGORY_STYLES[e.category] ?? CATEGORY_STYLES.Other
                              }`}
                            >
                              {e.category}
                            </span>
                            <span className="flex-1 min-w-0 break-words">{e.title}</span>
                            {e.pr && (
                              <a
                                href={`${REPO_URL}/pull/${e.pr}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                #{e.pr} <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {isMinor && e.files && (
                              <button
                                onClick={() => toggle(key)}
                                className="inline-flex items-center text-xs text-blue-600 hover:underline"
                              >
                                {expanded.has(key) ? 'Hide files' : 'Show files'}
                                {expanded.has(key) ? (
                                  <ChevronUp className="w-3 h-3 ml-0.5" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 ml-0.5" />
                                )}
                              </button>
                            )}
                          </div>
                          {isMinor && e.files && expanded.has(key) && (
                            <p className="mt-1 ml-1 text-xs text-gray-500 break-words">{e.files.join(', ')}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
