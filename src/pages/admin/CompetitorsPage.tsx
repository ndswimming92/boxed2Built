import { useEffect, useMemo, useState, type ElementType } from 'react';
import {
  AlertCircle,
  Binoculars,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Globe,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Search,
  Trash2,
  Undo2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getActionItems,
  getCompetitors,
  setActionItemStatus,
  setCompetitorRemoved,
} from '../../services/competitorService';
import {
  ACTION_CATEGORY_LABELS,
  COMPETITOR_CATEGORIES,
  COMPETITOR_CATEGORY_LABELS,
  EFFORT_LABELS,
  PRIORITY_LABELS,
  competitorLinks,
  isNewThisWeek,
  isWatchStale,
  lastRanOn,
  mailtoHref,
  matchesCompetitorSearch,
  sortActionItems,
  sortCompetitors,
  telHref,
  websiteLabel,
} from '../../utils/competitors';
import { toPoints } from '../../utils/grants';
import { centralToday, formatEndsOn, safeExternalUrl } from '../../utils/news';
import type {
  ActionItemStatus,
  Competitor,
  CompetitorActionItem,
  CompetitorCategory,
} from '../../types/competitors';

const ITEM_TABS: Array<{ status: ActionItemStatus; label: string; empty: string }> = [
  {
    status: 'open',
    label: 'To do',
    empty: 'Nothing to work on right now. The weekly competitor watch adds new items here every Monday morning.',
  },
  {
    status: 'done',
    label: 'Done',
    empty: 'Nothing ticked off yet. Tick an item on the To do tab and it moves here.',
  },
  {
    status: 'dismissed',
    label: 'Removed',
    empty: 'Nothing removed. Items you remove are kept here so they are not suggested again.',
  },
];

type CompetitorFilter = CompetitorCategory | 'all' | 'removed';

/**
 * A block of saved text as a short list, one point per line, or as a plain
 * paragraph when there is only one point.
 *
 * Plain text on purpose: this is written by an automated check from web pages,
 * so it is never treated as HTML and a web address in it is not made a link.
 */
function Points({ text }: { text: string | null }) {
  const points = toPoints(text);
  if (points.length === 0) return null;
  if (points.length === 1) {
    return <p className="text-sm leading-relaxed break-words text-slate-700">{points[0]}</p>;
  }
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed marker:text-slate-400 text-slate-700">
      {points.map((point, index) => (
        <li key={index} className="break-words pl-0.5">
          {point}
        </li>
      ))}
    </ul>
  );
}

/** A titled part of a competitor card: the heading in a narrow left column, its points beside it. */
function Section({ title, text }: { title: string; text: string | null }) {
  if (toPoints(text).length === 0) return null;
  return (
    <section className="py-4 first:pt-0 last:pb-0 md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
      <h4 className="text-sm font-semibold text-slate-900 mb-2 md:mb-0">{title}</h4>
      <div className="max-w-prose">
        <Points text={text} />
      </div>
    </section>
  );
}

const PRIORITY_STYLES: Record<CompetitorActionItem['priority'], string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
};

/** One line of the checklist: a tick box, what it is, and a way to remove it. */
function ActionItemRow({
  item,
  today,
  saving,
  onStatus,
}: {
  item: CompetitorActionItem;
  today: string;
  saving: boolean;
  onStatus: (item: CompetitorActionItem, status: ActionItemStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sourceUrl = safeExternalUrl(item.source_url);
  const hasMore = Boolean(item.suggestion?.trim()) || Boolean(sourceUrl);
  const done = item.status === 'done';
  const removed = item.status === 'dismissed';

  return (
    <li className="flex items-start gap-3 px-4 sm:px-5 py-4" aria-label={item.title}>
      {!removed && (
        <input
          type="checkbox"
          checked={done}
          disabled={saving}
          onChange={() => onStatus(item, done ? 'open' : 'done')}
          aria-label={done ? `Move back to To do: ${item.title}` : `Mark as done: ${item.title}`}
          className="mt-1 h-5 w-5 flex-shrink-0 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
        />
      )}

      <div className="min-w-0 flex-1">
        <h3
          className={`text-[15px] font-semibold leading-snug break-words ${
            done || removed ? 'text-slate-500' : 'text-slate-900'
          } ${done ? 'line-through' : ''}`}
        >
          {item.title}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {item.status === 'open' && isNewThisWeek(item.created_at, today) && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded">New</span>
          )}
          <span className={`px-2 py-0.5 font-semibold rounded ${PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low}`}>
            {PRIORITY_LABELS[item.priority] ?? item.priority}
          </span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded">
            {EFFORT_LABELS[item.effort] ?? item.effort}
          </span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded">
            {ACTION_CATEGORY_LABELS[item.category] ?? item.category}
          </span>
        </div>

        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-700 break-words">{item.detail}</p>

        {item.competitor_names.length > 0 && (
          <p className="mt-1.5 text-xs text-slate-500 break-words">
            <span className="font-medium text-slate-600">Seen at:</span> {item.competitor_names.join(', ')}
          </p>
        )}

        {hasMore && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls={`item-more-${item.id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              How Boxed2Built could do it
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {expanded && (
              <div
                id={`item-more-${item.id}`}
                className="mt-2 max-w-prose rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-3.5 py-3"
              >
                <Points text={item.suggestion} />
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={`inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline ${
                      item.suggestion?.trim() ? 'mt-2' : ''
                    }`}
                  >
                    See an example
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {removed ? (
        <button
          type="button"
          onClick={() => onStatus(item, 'open')}
          disabled={saving}
          aria-label={`Put back on the list: ${item.title}`}
          className="flex-shrink-0 px-2.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
          Put back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onStatus(item, 'dismissed')}
          disabled={saving}
          aria-label={`Remove: ${item.title}`}
          title="Remove — not relevant"
          className="flex-shrink-0 p-2 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/** One contact detail in an open competitor card. "Not found" is said plainly, not left blank. */
function Contact({
  icon: Icon,
  label,
  value,
  href,
  external = false,
}: {
  icon: ElementType;
  label: string;
  value: string | null;
  href?: string | null;
  external?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words">
        {!value ? (
          <span className="text-slate-400">Not found</span>
        ) : href ? (
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
            className="font-medium text-emerald-700 hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="font-medium text-slate-900">{value}</span>
        )}
      </dd>
    </div>
  );
}

function CompetitorCard({
  competitor,
  today,
  saving,
  onRemoved,
}: {
  competitor: Competitor;
  today: string;
  saving: boolean;
  onRemoved: (competitor: Competitor, removed: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const website = safeExternalUrl(competitor.website_url);
  const links = competitorLinks(competitor.links);
  const lastChecked = formatEndsOn(competitor.last_verified_on);
  const removed = competitor.removed_at !== null;
  const stale = !removed && isWatchStale(competitor.last_verified_on, today);

  return (
    <article
      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      aria-labelledby={`competitor-${competitor.id}`}
    >
      {/* Collapsed, a card is the name, what kind of competitor it is and one line on who they are.
          The name is a real button so the keyboard can open it; its click bubbles up here. */}
      <div onClick={() => setExpanded((open) => !open)} className="cursor-pointer px-5 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 font-semibold rounded">
            {COMPETITOR_CATEGORY_LABELS[competitor.category] ?? competitor.category}
          </span>
          {!removed && isNewThisWeek(competitor.created_at, today) && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded">New</span>
          )}
          {competitor.operating_status === 'closed' && (
            <span className="px-2 py-1 bg-slate-200 text-slate-700 font-semibold rounded">Closed down</span>
          )}
          {removed && (
            <span className="px-2 py-1 bg-slate-200 text-slate-700 font-semibold rounded">Removed</span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 id={`competitor-${competitor.id}`} className="text-lg font-bold text-slate-900 break-words">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`competitor-details-${competitor.id}`}
              className="text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {competitor.name}
            </button>
          </h3>
          <ChevronDown
            className={`w-5 h-5 mt-1 flex-shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
        {(competitor.location || website) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            {competitor.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                <span className="break-words">{competitor.location}</span>
              </span>
            )}
            {website && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                <span className="break-all">{websiteLabel(website)}</span>
              </span>
            )}
          </p>
        )}
        <p
          className={`mt-2 max-w-prose text-sm leading-relaxed text-slate-700 break-words ${
            expanded ? '' : 'line-clamp-2'
          }`}
        >
          {competitor.summary}
        </p>
      </div>

      {expanded && (
        <>
          <div id={`competitor-details-${competitor.id}`} className="border-t border-slate-200">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200">
              <Contact
                icon={Globe}
                label="Website"
                value={website ? websiteLabel(website) : null}
                href={website}
                external
              />
              <Contact icon={User} label="Owner / founder" value={competitor.owner_name} />
              <Contact
                icon={Mail}
                label="Email"
                value={competitor.email}
                href={mailtoHref(competitor.email)}
              />
              <Contact icon={Phone} label="Phone" value={competitor.phone} href={telHref(competitor.phone)} />
            </dl>

            <div className="px-5 sm:px-6 py-5 divide-y divide-slate-100">
              <Section title="Area they serve" text={competitor.service_area} />
              <Section title="Services" text={competitor.services} />
              <Section title="Pricing" text={competitor.pricing} />
              <Section title="How customers book" text={competitor.booking} />
              <Section title="What stands out" text={competitor.standout} />
              <Section title="Reviews" text={competitor.reviews} />
              <Section title="Good to know" text={competitor.other_notes} />
              {links.length > 0 && (
                <section className="py-4 first:pt-0 last:pb-0 md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2 md:mb-0">Find them online</h4>
                  <ul className="flex flex-wrap gap-2">
                    {links.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {link.label}
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          <footer className="px-5 sm:px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${stale ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
              {lastChecked ? `Last checked ${lastChecked}` : 'Not checked yet'}
              {stale ? '. These details may be out of date.' : ''}
            </p>
            {removed ? (
              <button
                type="button"
                onClick={() => onRemoved(competitor, false)}
                disabled={saving}
                className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Undo2 className="w-4 h-4" aria-hidden="true" />
                Put back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRemoved(competitor, true)}
                disabled={saving}
                className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-red-50 hover:border-red-300 hover:text-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Not a competitor
              </button>
            )}
          </footer>
        </>
      )}
    </article>
  );
}

interface Loaded {
  organizationId: string;
  competitors: Competitor[];
  items: CompetitorActionItem[];
  error: string | null;
}

/**
 * Both lists for one organization. Kept apart from the default export below so
 * the browser tests can mount it with an organization id and no sign-in.
 */
export function CompetitorWatchView({ organizationId }: { organizationId: string | null }) {
  // What was loaded, and for which organization. Keeping the two together means
  // a switch of organization can never show the last one's lists, or its
  // error, while the new ones are on their way.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [itemTab, setItemTab] = useState<ActionItemStatus>('open');
  const [filter, setFilter] = useState<CompetitorFilter>('all');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    Promise.all([getCompetitors(organizationId), getActionItems(organizationId)])
      .then(([competitors, items]) => {
        if (!cancelled) setLoaded({ organizationId, competitors, items, error: null });
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoaded({
          organizationId,
          competitors: [],
          items: [],
          error: cause instanceof Error ? cause.message : 'Failed to load Competitor Watch',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const save = async (id: string, change: () => Promise<(previous: Loaded) => Loaded>) => {
    if (!organizationId) return;
    setSavingId(id);
    setSaveError(null);
    try {
      const apply = await change();
      setLoaded((previous) =>
        previous && previous.organizationId === organizationId ? apply(previous) : previous,
      );
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const saveItemStatus = (item: CompetitorActionItem, status: ActionItemStatus) =>
    save(item.id, async () => {
      const saved = await setActionItemStatus(item.id, organizationId as string, status);
      return (previous) => ({
        ...previous,
        items: previous.items.map((row) => (row.id === saved.id ? saved : row)),
      });
    });

  const saveCompetitorRemoved = (competitor: Competitor, removed: boolean) =>
    save(competitor.id, async () => {
      const saved = await setCompetitorRemoved(competitor.id, organizationId as string, removed);
      return (previous) => ({
        ...previous,
        competitors: previous.competitors.map((row) => (row.id === saved.id ? saved : row)),
      });
    });

  const current = loaded && loaded.organizationId === organizationId ? loaded : null;
  const loading = organizationId !== null && current === null;
  const error = current?.error ?? null;
  const competitors = useMemo(() => current?.competitors ?? [], [current]);
  const items = useMemo(() => current?.items ?? [], [current]);

  const today = centralToday();

  const { itemCounts, visibleItems } = useMemo(() => {
    const tally: Record<ActionItemStatus, number> = { open: 0, done: 0, dismissed: 0 };
    for (const item of items) if (item.status in tally) tally[item.status] += 1;
    return {
      itemCounts: tally,
      visibleItems: sortActionItems(
        items.filter((item) => item.status === itemTab),
        itemTab,
      ),
    };
  }, [items, itemTab]);

  const { filterCounts, visibleCompetitors } = useMemo(() => {
    const matching = competitors.filter((competitor) => matchesCompetitorSearch(competitor, search));
    const kept = matching.filter((competitor) => competitor.removed_at === null);
    const tally: Record<CompetitorFilter, number> = {
      all: kept.length,
      local: 0,
      platform: 0,
      retailer: 0,
      out_of_area: 0,
      removed: matching.length - kept.length,
    };
    for (const competitor of kept) if (competitor.category in tally) tally[competitor.category] += 1;
    const shown =
      filter === 'removed'
        ? matching.filter((competitor) => competitor.removed_at !== null)
        : kept.filter((competitor) => filter === 'all' || competitor.category === filter);
    return { filterCounts: tally, visibleCompetitors: sortCompetitors(shown) };
  }, [competitors, search, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const itemTabInfo = ITEM_TABS.find((candidate) => candidate.status === itemTab) ?? ITEM_TABS[0];
  const lastRan = lastRanOn(competitors, items);
  const lastRanLabel = formatEndsOn(lastRan);
  const stale = isWatchStale(lastRan, today);
  const searching = search.trim().length > 0;
  const removedCount = competitors.filter((competitor) => competitor.removed_at !== null).length;

  const filters: Array<{ value: CompetitorFilter; label: string }> = [
    { value: 'all', label: 'All' },
    ...COMPETITOR_CATEGORIES.map((category) => ({
      value: category as CompetitorFilter,
      label: COMPETITOR_CATEGORY_LABELS[category],
    })),
    // Only offered once something has been removed, or while it is the filter in use.
    ...(removedCount > 0 || filter === 'removed' ? [{ value: 'removed' as const, label: 'Removed' }] : []),
  ];

  return (
    <div className="max-w-5xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Competitor Watch</h1>
        <p className="text-sm sm:text-base text-slate-600">
          What other furniture assembly businesses are doing that Boxed2Built is not doing yet, and who they
          are. Checked every Monday morning. Only the business’s owners and admins can see this page.
        </p>
        {lastRanLabel && !error && (
          <p
            className={`mt-2 inline-flex items-center gap-1.5 text-sm ${
              stale ? 'text-amber-700 font-medium' : 'text-slate-500'
            }`}
          >
            <CalendarClock className="w-4 h-4" aria-hidden="true" />
            Last checked {lastRanLabel}
            {stale ? '. The weekly check has not run since, so this may be out of date.' : ''}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm flex-1 text-red-800">{error}. Reload the page to try again.</p>
        </div>
      )}

      {!organizationId && (
        <div role="alert" className="mb-6 p-4 rounded-lg flex items-start gap-3 bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm flex-1 text-amber-900">
            No organization is selected, so there is nothing to show. Sign out and back in, then try again.
          </p>
        </div>
      )}

      {/* A failed load says nothing about what is saved, so no tabs, counts or
          "nothing yet" messages are shown beside the error. */}
      {organizationId && !error && (
        <>
          {saveError && (
            <div role="alert" className="mb-4 p-3 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm flex-1 text-red-800">{saveError}</p>
            </div>
          )}

          <section aria-labelledby="watch-items" className="mb-10 sm:mb-12">
            <h2 id="watch-items" className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              Things to work on
            </h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              Tick an item when it is done. Use the bin to remove one that does not apply; it will not be
              suggested again.
            </p>

            <div
              className="mb-4 flex gap-1 sm:gap-2 overflow-x-auto border-b border-slate-200"
              role="tablist"
              aria-label="Checklist by status"
            >
              {ITEM_TABS.map((candidate) => {
                const isActive = candidate.status === itemTab;
                return (
                  <button
                    key={candidate.status}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setItemTab(candidate.status)}
                    className={`px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {candidate.label}
                    <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                      {itemCounts[candidate.status]}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-slate-600">{itemTabInfo.empty}</p>
              </div>
            ) : (
              <ul
                aria-label={`${itemTabInfo.label} items`}
                className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200"
              >
                {visibleItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    today={today}
                    saving={savingId === item.id}
                    onStatus={saveItemStatus}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="watch-competitors">
            <h2 id="watch-competitors" className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Binoculars className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              Competitors
            </h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              Click a business to open everything found about it: website, owner, contact details, services
              and pricing.
            </p>

            <div className="mb-3 relative max-w-md">
              <label htmlFor="competitor-search" className="sr-only">
                Search competitors
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                id="competitor-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, town, owner or service"
                className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              {searching && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter competitors">
              {filters.map((candidate) => {
                const isActive = candidate.value === filter;
                return (
                  <button
                    key={candidate.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setFilter(candidate.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {candidate.label}
                    <span className={`text-xs font-bold ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {filterCounts[candidate.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {visibleCompetitors.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                  <Binoculars className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-slate-600">
                    {searching
                      ? `No competitors here match "${search.trim()}".`
                      : filter === 'all'
                        ? 'No competitors saved yet. The weekly competitor watch adds them here every Monday morning.'
                        : 'No competitors in this group.'}
                  </p>
                </div>
              ) : (
                visibleCompetitors.map((competitor) => (
                  <CompetitorCard
                    key={competitor.id}
                    competitor={competitor}
                    today={today}
                    saving={savingId === competitor.id}
                    onRemoved={saveCompetitorRemoved}
                  />
                ))
              )}
            </div>
          </section>

          <p className="mt-8 text-xs text-slate-500">
            Everything here comes from each business’s own website and public listings, and businesses change.
            Check a price or an offer on their site before acting on it. Contact details are the ones a
            business publishes for customers.
          </p>
        </>
      )}
    </div>
  );
}

export default function CompetitorsPage() {
  const { currentOrganization } = useAuth();
  return <CompetitorWatchView organizationId={currentOrganization?.id ?? null} />;
}
