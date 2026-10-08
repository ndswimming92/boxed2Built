import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Head } from 'vite-react-ssg';
import { ArrowRight, ChevronDown, ExternalLink, Newspaper } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import CallButton from '../components/ui/CallButton';
import NewsScrollBar from '../components/ui/NewsScrollBar';
import SaleFilters from '../components/ui/SaleFilters';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';
import { getPublishedNews, getSaleFilterOptions } from '../services/newsService';
import { trackEvent } from '../utils/analytics';
import {
  NEWS_TOPIC_LABELS,
  NO_SALES_FILTERS,
  SALE_SCOPE_LABELS,
  defaultOrderFor,
  formatEndsOn,
  formatNewsDate,
  hasSalesFilters,
  isEndingOrder,
  newsCursor,
  newsViewToSearch,
  parseNewsView,
  safeExternalUrl,
  type NewsOrder,
  type NewsView,
  type SalesFilters,
  type TopicFilter,
} from '../utils/news';
import type { NewsItem, SaleFilterRow } from '../types/news';

const TOPIC_FILTERS: Array<{ value: TopicFilter; label: string }> = [
  { value: 'all', label: 'All news' },
  { value: 'flat_pack', label: NEWS_TOPIC_LABELS.flat_pack },
  { value: 'furniture_assembly', label: NEWS_TOPIC_LABELS.furniture_assembly },
  { value: 'deals', label: NEWS_TOPIC_LABELS.deals },
];

const ORDER_OPTIONS: Array<{ value: NewsOrder; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

/** Only sales have an end date, so these are offered on the Sales tab alone. */
const SALES_ORDER_OPTIONS: Array<{ value: NewsOrder; label: string }> = [
  { value: 'ending_soonest', label: 'Ending soonest' },
  { value: 'ending_latest', label: 'Ending latest' },
  ...ORDER_OPTIONS,
];

/** Identifies a view, so a slow response for one the visitor has left can be dropped. */
const viewKey = (view: NewsView) => `${view.topic}|${newsViewToSearch(view)}`;

const ALL_NEWS_VIEW: NewsView = { topic: 'all', order: 'newest', ...NO_SALES_FILTERS };

/**
 * The page link is the source of truth for what is on screen, so a filtered
 * view can be shared, bookmarked and stepped through with the back button. It
 * is read through useSyncExternalStore: the pre-rendered page has no link, so
 * hydration uses the empty one and React then switches to the real one.
 */
const LOCATION_CHANGE_EVENT = 'news-view-change';
const subscribeToLocation = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  window.addEventListener(LOCATION_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener('popstate', notify);
    window.removeEventListener(LOCATION_CHANGE_EVENT, notify);
  };
};
const getSearch = () => window.location.search;
const getServerSearch = () => '';
const subscribeNever = () => () => {};

const NewsCard: React.FC<{ item: NewsItem }> = ({ item }) => {
  const date = formatNewsDate(item);
  const endsOn = formatEndsOn(item.ends_on);
  const sourceUrl = safeExternalUrl(item.source_url);

  return (
    <article data-news-card className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            item.topic === 'deals' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'
          }`}
        >
          {NEWS_TOPIC_LABELS[item.topic] ?? 'News'}
        </span>
        {item.store_name && (
          <span className="text-sm font-semibold text-gray-900">
            {item.store_name}
            {item.sale_scope && (
              <span className="ml-2 font-normal text-gray-500">{SALE_SCOPE_LABELS[item.sale_scope]}</span>
            )}
          </span>
        )}
        {date && (
          <time
            dateTime={item.source_published_on ?? item.published_at ?? undefined}
            className="text-sm text-gray-500"
          >
            {date}
          </time>
        )}
        {endsOn && (
          <span className="text-sm font-medium text-emerald-800">Ends {endsOn}</span>
        )}
      </div>

      {/* Title and summary are plain text on purpose. They are written by an
          automated check, so they are never rendered as HTML. */}
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h2>
      <p className="text-gray-600 leading-relaxed mb-4">{item.summary}</p>

      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() =>
            trackEvent('news_source_click', 'news_feed', {
              event_category: 'engagement',
              event_label: item.source_name,
              element_type: 'link',
              action_type: 'outbound_click',
              action_value: sourceUrl,
            })
          }
          className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 font-medium underline underline-offset-2"
        >
          Read at {item.source_name}
          <ExternalLink size={16} aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <p className="text-sm text-gray-500">Source: {item.source_name}</p>
      )}
    </article>
  );
};

const NewsPage: React.FC = () => {
  const search = useSyncExternalStore(subscribeToLocation, getSearch, getServerSearch);
  // False while hydrating, so the first load waits for the real page link.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const parsed = useMemo(() => parseNewsView(search), [search]);

  // The page opens on Sales. If that first load finds no sales, fall back to
  // All news once; after that the visitor's own choices (or a page link that
  // asked for something specific) are never overridden.
  const awaitingFirstLoad = useRef<boolean | null>(null);
  const [fellBackToAll, setFellBackToAll] = useState(false);

  const view = fellBackToAll ? ALL_NEWS_VIEW : parsed.view;
  const { topic, order, store, scope, type } = view;
  const filters: SalesFilters = { store, scope, type };
  const key = viewKey(view);

  const [saleOptions, setSaleOptions] = useState<SaleFilterRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Each of these remembers which view it is about, so changing the view
  // clears them without anything having to reset them.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
  const loading = loadedKey !== key;
  const error = failedKey === key;
  const loadingMore = loadingMoreKey === key;

  // The view the visitor is on right now, so a slow "load more" for one they
  // have already left cannot append to the wrong list.
  const currentView = useRef(key);
  useEffect(() => {
    currentView.current = key;
  }, [key]);

  // The back button leaves the fallback behind along with the view it replaced.
  useEffect(() => {
    const leaveFallback = () => setFellBackToAll(false);
    window.addEventListener('popstate', leaveFallback);
    return () => window.removeEventListener('popstate', leaveFallback);
  }, []);

  const showView = (next: NewsView) => {
    setFellBackToAll(false);
    window.history.pushState(null, '', `${window.location.pathname}${newsViewToSearch(next)}`);
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  };

  // The stores, local/online split and furniture types among the live sales.
  useEffect(() => {
    let cancelled = false;
    getSaleFilterOptions().then((rows) => {
      if (!cancelled) setSaleOptions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // First page, on load and whenever the view changes or a retry is asked for.
  useEffect(() => {
    if (!hydrated) return undefined;
    if (awaitingFirstLoad.current === null) awaitingFirstLoad.current = !parsed.explicit;
    let cancelled = false;
    let fellBack = false;

    getPublishedNews({ topic: topic === 'all' ? null : topic, order, store, scope, type })
      .then((result) => {
        if (cancelled) return;
        if (awaitingFirstLoad.current) {
          awaitingFirstLoad.current = false;
          if (topic === 'deals' && result.items.length === 0) {
            // Stay in the loading state; the view changing reruns this effect.
            fellBack = true;
            setFellBackToAll(true);
            return;
          }
        }
        setItems(result.items);
        setHasMore(result.hasMore);
        setTotal(result.total);
        // A failure recorded for this view earlier no longer applies.
        setFailedKey((failed) => (failed === key ? null : failed));
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
        setTotal(null);
        setFailedKey(key);
      })
      .finally(() => {
        if (!cancelled && !fellBack) setLoadedKey(key);
      });

    return () => {
      cancelled = true;
    };
    // `key` and `parsed` follow the view's own fields, listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, topic, order, store, scope, type, reloadKey]);

  const handleTopicChange = (nextTopic: TopicFilter) => {
    if (nextTopic === topic) return;
    // Entering Sales starts on "Ending soonest"; leaving it drops an end-date
    // order, which means nothing on the other tabs. Store filters belong to Sales.
    const nextOrder =
      nextTopic === 'deals' ? defaultOrderFor('deals') : isEndingOrder(order) ? 'newest' : order;
    showView({ topic: nextTopic, order: nextOrder, ...NO_SALES_FILTERS });
    trackEvent('news_filter', 'news_feed', {
      event_category: 'engagement',
      event_label: nextTopic,
      element_type: 'button',
      action_type: 'filter',
    });
  };

  const handleOrderChange = (nextOrder: NewsOrder) => {
    if (nextOrder === order) return;
    showView({ ...view, order: nextOrder });
    trackEvent('news_sort', 'news_feed', {
      event_category: 'engagement',
      event_label: nextOrder,
      element_type: 'button',
      action_type: 'sort',
    });
  };

  const handleSaleFiltersChange = (next: SalesFilters) => {
    showView({ ...view, ...next });
    const changed = (['store', 'scope', 'type'] as const).find((field) => next[field] !== filters[field]);
    trackEvent('news_sale_filter', 'news_feed', {
      event_category: 'engagement',
      event_label: changed ? `${changed}:${next[changed] ?? 'all'}` : 'none',
      element_type: 'button',
      action_type: 'filter',
    });
  };

  const handleRetry = () => {
    setFailedKey(null);
    setLoadedKey(null);
    setReloadKey((n) => n + 1);
  };

  const handleLoadMore = async () => {
    const requestedTopic = topic;
    const requestedView = key;
    // Paged by "older than the last story shown", so a story approved or
    // unpublished since the first page loaded cannot repeat or skip one.
    const cursor = newsCursor(items, order);
    if (!cursor) {
      // Nothing to anchor on, so there is no next page to ask for.
      setHasMore(false);
      return;
    }
    setLoadingMoreKey(requestedView);
    setFailedKey(null);
    try {
      const result = await getPublishedNews({
        topic: requestedTopic === 'all' ? null : requestedTopic,
        cursor,
        order,
        store,
        scope,
        type,
      });
      if (currentView.current !== requestedView) return;
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...result.items.filter((item) => !seen.has(item.id))];
      });
      setHasMore(result.hasMore);
    } catch {
      if (currentView.current === requestedView) setFailedKey(requestedView);
    } finally {
      setLoadingMoreKey((current) => (current === requestedView ? null : current));
    }
  };

  // Sits at the end of the Sales filter row, or on its own on the other tabs.
  const sortControl = (
    <label className="relative flex items-center gap-2 text-[15px]">
      <span className="whitespace-nowrap text-gray-600">Sort by</span>
      <select
        value={order}
        onChange={(event) => handleOrderChange(event.target.value as NewsOrder)}
        className="h-11 cursor-pointer appearance-none rounded-lg bg-transparent pl-1 pr-8 font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        {(topic === 'deals' ? SALES_ORDER_OPTIONS : ORDER_OPTIONS).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-900"
        aria-hidden="true"
      />
    </label>
  );

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.news.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.news.description} />
        <link rel="canonical" href="https://boxed2built.com/news" />
        <meta property="og:url" content="https://boxed2built.com/news" />
        <meta property="og:title" content="Furniture Assembly & Flat Pack News | Boxed2Built" />
        <meta property="og:description" content="Flat pack furniture and furniture assembly news, plus current furniture sales near Spring Hill, TN, with links to the sources." />
        <meta name="twitter:title" content="Furniture Assembly & Flat Pack News | Boxed2Built" />
        <meta name="twitter:description" content="Flat pack furniture and furniture assembly news, plus current furniture sales near Spring Hill, TN, with links to the sources." />
      </Head>
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'News', href: '/news', current: true },
                ]}
                className="mb-6"
              />

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Furniture Assembly and Flat Pack News
              </h1>
              <p className="text-xl text-gray-600">
                Recent news on flat pack furniture and furniture assembly, from retailer
                updates and new product lines to recalls and safety notices. Each item is a
                short summary with a link to the original source. The Sales tab lists current
                furniture sales, including stores in and around Spring Hill, TN.
              </p>
            </div>
          </div>
        </section>

        {/* Feed */}
        <section className="py-12 bg-white" aria-labelledby="news-feed-heading">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 id="news-feed-heading" className="sr-only">
                Latest news
              </h2>

              <div
                className="mb-6 flex gap-7 overflow-x-auto border-b border-gray-200"
                role="group"
                aria-label="Filter news by topic"
              >
                {TOPIC_FILTERS.map((filter) => {
                  const isActive = topic === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleTopicChange(filter.value)}
                      className={`-mb-px h-12 flex-none whitespace-nowrap border-b-2 px-0.5 text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                        isActive
                          ? 'border-blue-700 font-semibold text-gray-900'
                          : 'border-transparent font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {topic === 'deals' ? (
                <SaleFilters
                  rows={saleOptions}
                  filters={filters}
                  resultCount={loading ? null : total}
                  onChange={handleSaleFiltersChange}
                  sort={sortControl}
                />
              ) : (
                <div className="mb-8 flex justify-end">{sortControl}</div>
              )}

              <div aria-live="polite" aria-busy={loading}>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div
                      className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
                      role="status"
                      aria-label="Loading news"
                    ></div>
                  </div>
                ) : error && items.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <p className="text-red-700 mb-4">
                      The news feed could not be loaded. Please try again.
                    </p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="rounded-lg bg-white border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-10 text-center">
                    <Newspaper className="w-10 h-10 text-gray-400 mx-auto mb-4" aria-hidden="true" />
                    <p className="text-gray-700 font-medium">
                      {topic === 'all'
                        ? 'No news posted yet. Check back soon.'
                        : topic === 'deals'
                          ? hasSalesFilters(filters)
                            ? 'No sales match those filters.'
                            : 'No furniture sales posted right now. Check back soon.'
                          : 'Nothing posted on this topic yet.'}
                    </p>
                    {topic === 'deals' && hasSalesFilters(filters) && (
                      <button
                        type="button"
                        onClick={() => handleSaleFiltersChange(NO_SALES_FILTERS)}
                        className="mt-3 mr-4 text-blue-700 hover:text-blue-800 font-medium underline"
                      >
                        Clear filters
                      </button>
                    )}
                    {topic !== 'all' && (
                      <button
                        type="button"
                        onClick={() => handleTopicChange('all')}
                        className="mt-3 text-blue-700 hover:text-blue-800 font-medium underline"
                      >
                        Show all news
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div ref={listRef} className="space-y-6">
                      {items.map((item) => (
                        <NewsCard key={item.id} item={item} />
                      ))}
                    </div>

                    {error && (
                      <p className="mt-6 text-center text-sm text-red-700">
                        More news could not be loaded. Please try again.
                      </p>
                    )}

                    {hasMore && (
                      <div className="mt-8 text-center">
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          disabled={loadingMore}
                          className="rounded-lg border-2 border-blue-700 px-6 py-2.5 font-medium text-blue-700 hover:bg-blue-50 transition-colors disabled:border-gray-400 disabled:text-gray-500 disabled:cursor-not-allowed"
                        >
                          {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <p className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500">
                Summaries are prepared with AI assistance and reviewed before posting. They are
                brief by design, so follow the source link for the full story. Sales are set by
                the stores, not by Boxed2Built, and can change or end without notice, so confirm
                the details with the store before you buy.
              </p>
            </div>
          </div>
        </section>

        {/* Related Services */}
        <section className="py-8 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
                Have furniture waiting in a box?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <a
                  href="/services/furniture-assembly"
                  className="group flex items-center justify-between bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-5 py-4 shadow-sm transition-colors"
                  onClick={() =>
                    trackEvent('link_click', 'news_page', {
                      event_category: 'navigation',
                      event_label: 'news_to_furniture_assembly',
                      action_value: '/services/furniture-assembly',
                    })
                  }
                >
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">Furniture Assembly Service</p>
                    <p className="text-gray-500 text-xs mt-0.5">IKEA, Wayfair, Amazon &amp; all brands</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </a>
                <a
                  href="/faq"
                  className="group flex items-center justify-between bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-5 py-4 shadow-sm transition-colors"
                  onClick={() =>
                    trackEvent('link_click', 'news_page', {
                      event_category: 'navigation',
                      event_label: 'news_to_faq',
                      action_value: '/faq',
                    })
                  }
                >
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">Furniture Assembly FAQ</p>
                    <p className="text-gray-500 text-xs mt-0.5">Pricing, scheduling &amp; what to expect</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </a>
              </div>

              <div className="flex justify-center mt-6">
                <CallButton size="md" pageSection="news_page_cta" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <NewsScrollBar listRef={listRef} total={total} loaded={items.length} />
      <Footer />
    </>
  );
};

export default NewsPage;
