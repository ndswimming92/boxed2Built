import React, { useEffect, useRef, useState } from 'react';
import { Head } from 'vite-react-ssg';
import { ArrowRight, ExternalLink, Newspaper } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import CallButton from '../components/ui/CallButton';
import NewsScrollBar from '../components/ui/NewsScrollBar';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';
import { getPublishedNews } from '../services/newsService';
import { trackEvent } from '../utils/analytics';
import { NEWS_TOPIC_LABELS, formatEndsOn, formatNewsDate, newsCursor, safeExternalUrl, type NewsOrder } from '../utils/news';
import type { NewsItem, NewsTopic } from '../types/news';

type TopicFilter = NewsTopic | 'all';

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
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [order, setOrder] = useState<NewsOrder>('newest');
  const [total, setTotal] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Which filter and order the visitor is looking at right now, so a slow
  // "load more" for a view they have already left cannot append to the wrong list.
  const currentView = useRef('all|newest');

  // First page, on load and whenever the filter changes or a retry is asked for.
  useEffect(() => {
    let cancelled = false;

    getPublishedNews({ topic: topic === 'all' ? null : topic, order })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setHasMore(result.hasMore);
        setTotal(result.total);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
        setTotal(null);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [topic, order, reloadKey]);

  const handleTopicChange = (nextTopic: TopicFilter) => {
    if (nextTopic === topic) return;
    currentView.current = `${nextTopic}|${order}`;
    setLoading(true);
    setLoadingMore(false);
    setError(false);
    setTopic(nextTopic);
    trackEvent('news_filter', 'news_feed', {
      event_category: 'engagement',
      event_label: nextTopic,
      element_type: 'button',
      action_type: 'filter',
    });
  };

  const handleOrderChange = (nextOrder: NewsOrder) => {
    if (nextOrder === order) return;
    currentView.current = `${topic}|${nextOrder}`;
    setLoading(true);
    setLoadingMore(false);
    setError(false);
    setOrder(nextOrder);
    trackEvent('news_sort', 'news_feed', {
      event_category: 'engagement',
      event_label: nextOrder,
      element_type: 'button',
      action_type: 'sort',
    });
  };

  const handleRetry = () => {
    setLoading(true);
    setError(false);
    setReloadKey((key) => key + 1);
  };

  const handleLoadMore = async () => {
    const requestedTopic = topic;
    const requestedView = `${topic}|${order}`;
    // Paged by "older than the last story shown", so a story approved or
    // unpublished since the first page loaded cannot repeat or skip one.
    const cursor = newsCursor(items);
    if (!cursor) {
      // Nothing to anchor on, so there is no next page to ask for.
      setHasMore(false);
      return;
    }
    setLoadingMore(true);
    setError(false);
    try {
      const result = await getPublishedNews({
        topic: requestedTopic === 'all' ? null : requestedTopic,
        cursor,
        order,
      });
      if (currentView.current !== requestedView) return;
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...result.items.filter((item) => !seen.has(item.id))];
      });
      setHasMore(result.hasMore);
    } catch {
      if (currentView.current === requestedView) setError(true);
    } finally {
      if (currentView.current === requestedView) setLoadingMore(false);
    }
  };

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

              <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div
                className="flex flex-wrap gap-2"
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
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        isActive
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Sort</span>
                <select
                  value={order}
                  onChange={(event) => handleOrderChange(event.target.value as NewsOrder)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ORDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              </div>

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
                          ? 'No furniture sales posted right now. Check back soon.'
                          : 'Nothing posted on this topic yet.'}
                    </p>
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
