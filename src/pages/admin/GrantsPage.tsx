import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CalendarClock, ExternalLink, HandCoins, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getGrants } from '../../services/grantsService';
import {
  GRANT_SCOPE_LABELS,
  closingSoonLabel,
  formatGrantDeadline,
  formatGrantOpens,
  grantBucket,
  isNewGrant,
  isStale,
  lastCheckedOn,
  matchesGrantSearch,
  sortGrants,
  type GrantBucket,
} from '../../utils/grants';
import { centralToday, formatEndsOn, safeExternalUrl } from '../../utils/news';
import type { BusinessGrant } from '../../types/grants';

const TABS: Array<{ bucket: GrantBucket; label: string; empty: string }> = [
  {
    bucket: 'open',
    label: 'Open now',
    empty: 'No open grants saved yet. The daily grant finder adds them here each morning.',
  },
  {
    bucket: 'upcoming',
    label: 'Opening soon',
    empty: 'No upcoming grants. Programs that are between cycles show here with the date they reopen.',
  },
  {
    bucket: 'closed',
    label: 'Closed',
    empty: 'No closed grants. A grant moves here once its deadline passes.',
  },
];

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</dt>
      {/* Plain text on purpose: this is written by an automated check from web pages. */}
      <dd className="text-sm text-slate-700 whitespace-pre-line break-words">{value}</dd>
    </div>
  );
}

function GrantCard({ grant, bucket, today }: { grant: BusinessGrant; bucket: GrantBucket; today: string }) {
  const applyUrl = safeExternalUrl(grant.apply_url);
  const closingSoon = closingSoonLabel(grant, today);
  const lastChecked = formatEndsOn(grant.last_verified_on);

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6" aria-labelledby={`grant-${grant.id}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        {bucket !== 'closed' && isNewGrant(grant, today) && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded">New</span>
        )}
        {closingSoon && (
          <span className="px-2 py-1 bg-red-100 text-red-800 font-semibold rounded">{closingSoon}</span>
        )}
        {bucket === 'closed' && (
          <span className="px-2 py-1 bg-slate-200 text-slate-700 font-semibold rounded">Closed</span>
        )}
        <span className="px-2 py-1 bg-blue-100 text-blue-700 font-semibold rounded">
          {GRANT_SCOPE_LABELS[grant.funder_scope] ?? grant.funder_scope}
        </span>
        {grant.entry_fee && (
          <span className="px-2 py-1 bg-amber-100 text-amber-800 font-semibold rounded">
            Costs money to enter: {grant.entry_fee}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id={`grant-${grant.id}`} className="text-lg font-semibold text-slate-900 break-words">
            {grant.name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
            <span className="break-words">{grant.funder}</span>
          </p>
        </div>
        <div className="sm:text-right sm:max-w-xs flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
          <p className="text-base font-bold text-emerald-700 break-words">{grant.amount}</p>
        </div>
      </div>

      <p className="text-slate-700 whitespace-pre-line break-words mb-5">{grant.description}</p>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {bucket === 'upcoming' ? (
          <Detail label="Applications open" value={formatGrantOpens(grant)} />
        ) : null}
        <Detail label="Deadline" value={formatGrantDeadline(grant)} />
        <Detail label="Who can apply" value={grant.eligibility} />
        <Detail label="Fit for Boxed2Built" value={grant.fit_notes} />
        <Detail label="What the application asks for" value={grant.application_requirements} />
        <Detail label="Good to know" value={grant.other_notes} />
      </dl>

      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {applyUrl ? (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
          >
            {bucket === 'open' ? 'Go to the application' : 'View on the funder’s site'}
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-sm text-red-700">The saved link is not a valid web address.</span>
        )}
        <p className={`text-xs ${bucket !== 'closed' && isStale(grant, today) ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
          {lastChecked ? `Last checked ${lastChecked}` : 'Not checked yet'}
          {bucket !== 'closed' && isStale(grant, today) ? '. Confirm the details with the funder.' : ''}
        </p>
      </div>
    </article>
  );
}

/**
 * The list for one organization. Kept apart from the default export below so
 * the browser tests can mount it with an organization id and no sign-in.
 */
export function GrantsView({ organizationId }: { organizationId: string | null }) {
  // What was loaded, and for which organization. Keeping the two together means
  // a switch of organization can never show the last one's grants, or its
  // error, while the new list is on its way.
  const [loaded, setLoaded] = useState<{
    organizationId: string;
    grants: BusinessGrant[];
    error: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<GrantBucket>('open');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    getGrants(organizationId)
      .then((data) => {
        if (!cancelled) setLoaded({ organizationId, grants: data, error: null });
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoaded({
          organizationId,
          grants: [],
          error: cause instanceof Error ? cause.message : 'Failed to load grants',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const current = loaded && loaded.organizationId === organizationId ? loaded : null;
  const loading = organizationId !== null && current === null;
  const error = current?.error ?? null;
  const grants = useMemo(() => current?.grants ?? [], [current]);

  const today = centralToday();

  const { counts, visible } = useMemo(() => {
    const matching = grants.filter((grant) => matchesGrantSearch(grant, search));
    const tally: Record<GrantBucket, number> = { open: 0, upcoming: 0, closed: 0 };
    for (const grant of matching) tally[grantBucket(grant, today)] += 1;
    return {
      counts: tally,
      visible: sortGrants(
        matching.filter((grant) => grantBucket(grant, today) === activeTab),
        activeTab,
      ),
    };
  }, [grants, search, activeTab, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const tab = TABS.find((candidate) => candidate.bucket === activeTab) ?? TABS[0];
  const lastChecked = formatEndsOn(lastCheckedOn(grants));
  const searching = search.trim().length > 0;

  return (
    <div className="max-w-5xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Grants</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Grants Boxed2Built could apply for, found and checked by the daily grant finder. This is money that
          never has to be paid back. Only the business’s owners and admins can see this list.
        </p>
        {lastChecked && !error && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarClock className="w-4 h-4" aria-hidden="true" />
            Grant finder last ran {lastChecked}
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
            No organization is selected, so there are no grants to show. Sign out and back in, then try again.
          </p>
        </div>
      )}

      {/* A failed load says nothing about what is saved, so no tabs, counts or
          "no grants yet" message are shown beside the error. */}
      {organizationId && !error && (
        <>
          <div className="mb-4 relative max-w-md">
            <label htmlFor="grant-search" className="sr-only">
              Search grants
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="grant-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by grant, company or criteria"
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

          <div
            className="mb-6 flex gap-1 sm:gap-2 overflow-x-auto border-b border-slate-200"
            role="tablist"
            aria-label="Grants by status"
          >
            {TABS.map((candidate) => {
              const isActive = candidate.bucket === activeTab;
              return (
                <button
                  key={candidate.bucket}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(candidate.bucket)}
                  className={`px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {candidate.label}
                  <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                    {counts[candidate.bucket]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {visible.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <HandCoins className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
                <p className="text-slate-600">
                  {searching ? `No grants on this tab match "${search.trim()}".` : tab.empty}
                </p>
              </div>
            ) : (
              visible.map((grant) => <GrantCard key={grant.id} grant={grant} bucket={activeTab} today={today} />)
            )}
          </div>

          <p className="mt-8 text-xs text-slate-500">
            Each grant is checked against the funder’s own website, but programs change. Confirm the amount,
            deadline and rules with the funder before you apply. This is information, not legal, tax or financial
            advice.
          </p>
        </>
      )}
    </div>
  );
}

export default function GrantsPage() {
  const { currentOrganization } = useAuth();
  return <GrantsView organizationId={currentOrganization?.id ?? null} />;
}
