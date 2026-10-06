import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ExternalLink,
  EyeOff,
  Newspaper,
  Send,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteNewsItem,
  getAdminNewsItems,
  publishNewsToFacebook,
  setNewsPostToFacebook,
  setNewsStatus,
  updateNewsItem,
} from '../../services/newsService';
import {
  NEWS_SUMMARY_MAX,
  NEWS_TITLE_MAX,
  NEWS_TOPIC_LABELS,
  formatEndsOn,
  formatNewsDate,
  isNewsExpired,
  safeExternalUrl,
} from '../../utils/news';
import type { NewsItem, NewsItemEdits, NewsStatus, NewsTopic } from '../../types/news';

const TABS: Array<{ status: NewsStatus; label: string; empty: string }> = [
  {
    status: 'draft',
    label: 'Drafts',
    empty: 'No drafts waiting. New items arrive from the daily news check each morning.',
  },
  {
    status: 'published',
    label: 'Published',
    empty: 'Nothing published yet. Approve a draft and it appears on the News page right away.',
  },
  { status: 'rejected', label: 'Rejected', empty: 'No rejected items.' },
];

function formatAddedOn(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NewsStatus>('draft');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<NewsItemEdits>({ title: '', summary: '', topic: 'flat_pack', ends_on: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    if (type === 'success') {
      setTimeout(() => setMessage((current) => (current?.text === text ? null : current)), 3000);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getAdminNewsItems()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load news items',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const replaceItem = (updated: NewsItem) =>
    setItems((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));

  const postToFacebook = async (item: NewsItem): Promise<string | null> => {
    try {
      const result = await publishNewsToFacebook(item);
      replaceItem(result.item);
      return result.error;
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to post to Facebook';
    }
  };

  const changeStatus = async (item: NewsItem, status: NewsStatus, successText: string) => {
    setBusyId(item.id);
    try {
      const updated = await setNewsStatus(item, status);
      replaceItem(updated);
      if (editingId === item.id) setEditingId(null);
      if (status === 'published' && updated.post_to_facebook) {
        const facebookError = await postToFacebook(updated);
        if (facebookError) {
          showMessage('error', `Published to the News page, but the Facebook post failed: ${facebookError}`);
        } else {
          showMessage('success', `${successText} Also posted to Facebook.`);
        }
        return;
      }
      showMessage('success', successText);
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update news item');
    } finally {
      setBusyId(null);
    }
  };

  const startEditing = (item: NewsItem) => {
    setEditingId(item.id);
    setEdits({ title: item.title, summary: item.summary, topic: item.topic, ends_on: item.ends_on });
  };

  const saveEdits = async (item: NewsItem): Promise<NewsItem | null> => {
    if (!edits.title.trim() || !edits.summary.trim()) {
      showMessage('error', 'A title and a summary are both required.');
      return null;
    }
    setBusyId(item.id);
    try {
      const updated = await updateNewsItem(item, edits);
      replaceItem(updated);
      setEditingId(null);
      showMessage('success', 'Changes saved.');
      return updated;
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to save news item');
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const toggleFacebook = async (item: NewsItem, value: boolean) => {
    setBusyId(item.id);
    try {
      replaceItem(await setNewsPostToFacebook(item, value));
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update news item');
    } finally {
      setBusyId(null);
    }
  };

  const handleFacebookPost = async (item: NewsItem) => {
    if (item.facebook_posted_at && !confirm('This story was already posted to Facebook. Post it again?')) {
      return;
    }
    setBusyId(item.id);
    const facebookError = await postToFacebook(item);
    setBusyId(null);
    if (facebookError) showMessage('error', `Facebook post failed: ${facebookError}`);
    else showMessage('success', 'Posted to Facebook.');
  };

  const handleDelete = async (item: NewsItem) => {
    if (!confirm('Delete this item permanently? The daily news check may save the same story again.')) {
      return;
    }
    setBusyId(item.id);
    try {
      await deleteNewsItem(item);
      setItems((previous) => previous.filter((existing) => existing.id !== item.id));
      showMessage('success', 'Item deleted.');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to delete news item');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const counts: Record<NewsStatus, number> = { draft: 0, published: 0, rejected: 0 };
  for (const item of items) counts[item.status] += 1;

  const tab = TABS.find((candidate) => candidate.status === activeTab) ?? TABS[0];
  const visibleItems = items.filter((item) => item.status === activeTab);

  return (
    <div className="max-w-5xl px-0">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">News Feed</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Review what the daily news check found. Only approved items appear on the public News page.
          </p>
        </div>
        <a
          href="/news"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <ExternalLink className="w-4 h-4" />
          View News page
        </a>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p className={`text-sm flex-1 ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {message.text}
          </p>
          {message.type === 'error' && (
            <button
              onClick={() => setMessage(null)}
              aria-label="Dismiss"
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="mb-6 flex gap-1 sm:gap-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="News items by status">
        {TABS.map((candidate) => {
          const isActive = candidate.status === activeTab;
          return (
            <button
              key={candidate.status}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(candidate.status);
                setEditingId(null);
              }}
              className={`px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {candidate.label}
              <span
                className={`inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  candidate.status === 'draft' && counts.draft > 0
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {counts[candidate.status]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {visibleItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">{tab.empty}</p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const isEditing = editingId === item.id;
            const isBusy = busyId === item.id;
            const sourceUrl = safeExternalUrl(item.source_url);
            const sourceDate = formatNewsDate({
              source_published_on: item.source_published_on,
              published_at: null,
            });

            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 font-semibold rounded">
                    {NEWS_TOPIC_LABELS[item.topic] ?? item.topic}
                  </span>
                  <span className="text-slate-500">
                    {sourceDate ? `Source dated ${sourceDate}` : 'Source date not confirmed'}
                  </span>
                  <span className="text-slate-400" aria-hidden="true">·</span>
                  <span className="text-slate-500">Added {formatAddedOn(item.created_at)}</span>
                  {item.topic === 'deals' && (
                    <>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span className="text-slate-500">
                        {formatEndsOn(item.ends_on) ? `Ends ${formatEndsOn(item.ends_on)}` : 'No end date'}
                      </span>
                    </>
                  )}
                  {item.status === 'published' && isNewsExpired(item) && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 font-semibold rounded">
                      Expired, hidden from the News page
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor={`news-title-${item.id}`} className="block text-sm font-medium text-slate-700 mb-2">
                        Title
                      </label>
                      <input
                        id={`news-title-${item.id}`}
                        type="text"
                        value={edits.title}
                        maxLength={NEWS_TITLE_MAX}
                        onChange={(event) => setEdits({ ...edits, title: event.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`news-summary-${item.id}`} className="block text-sm font-medium text-slate-700 mb-2">
                        Summary
                      </label>
                      <textarea
                        id={`news-summary-${item.id}`}
                        value={edits.summary}
                        maxLength={NEWS_SUMMARY_MAX}
                        rows={4}
                        onChange={(event) => setEdits({ ...edits, summary: event.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {edits.summary.length} / {NEWS_SUMMARY_MAX} characters
                      </p>
                    </div>
                    <div>
                      <label htmlFor={`news-topic-${item.id}`} className="block text-sm font-medium text-slate-700 mb-2">
                        Topic
                      </label>
                      <select
                        id={`news-topic-${item.id}`}
                        value={edits.topic}
                        onChange={(event) => setEdits({ ...edits, topic: event.target.value as NewsTopic })}
                        className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        {(Object.keys(NEWS_TOPIC_LABELS) as NewsTopic[]).map((topic) => (
                          <option key={topic} value={topic}>
                            {NEWS_TOPIC_LABELS[topic]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`news-ends-on-${item.id}`} className="block text-sm font-medium text-slate-700 mb-2">
                        Deal ends on (optional)
                      </label>
                      <input
                        id={`news-ends-on-${item.id}`}
                        type="date"
                        value={edits.ends_on ?? ''}
                        onChange={(event) => setEdits({ ...edits, ends_on: event.target.value || null })}
                        className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        The deal shows through this date and drops off the News page the next day (Central time).
                        Leave blank to keep it up until you unpublish it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h2>
                    <p className="text-slate-600 mb-3">{item.summary}</p>
                  </>
                )}

                <p className="mt-3 text-sm">
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 font-medium underline underline-offset-2 break-all"
                    >
                      Check the source: {item.source_name}
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-red-700">
                      Source link is not a valid web address ({item.source_name}). Reject this item.
                    </span>
                  )}
                </p>

                {item.status === 'draft' && (
                  <label className="mt-4 flex items-center gap-3 cursor-pointer select-none w-fit">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={item.post_to_facebook}
                      disabled={isBusy}
                      onChange={(event) => toggleFacebook(item, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      Also post to the Boxed2Built Facebook page when approved
                    </span>
                  </label>
                )}

                {item.status === 'published' && item.facebook_posted_at && (
                  <p className="mt-4 text-sm text-emerald-700">
                    Posted to Facebook on {formatAddedOn(item.facebook_posted_at)}
                  </p>
                )}
                {item.status === 'published' && item.facebook_post_error && (
                  <p className="mt-2 text-sm text-red-700">
                    Last Facebook post attempt failed: {item.facebook_post_error}
                  </p>
                )}

                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdits(item)}
                        disabled={isBusy}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                      >
                        <Save className="w-4 h-4" /> Save
                      </button>
                      {item.status === 'draft' && (
                        <button
                          onClick={async () => {
                            const saved = await saveEdits(item);
                            if (saved) await changeStatus(saved, 'published', 'Saved and published to the News page.');
                          }}
                          disabled={isBusy || !sourceUrl}
                          className="px-4 py-2 bg-white border border-emerald-600 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                          <Check className="w-4 h-4" /> Save and approve
                        </button>
                      )}
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={isBusy}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {item.status === 'draft' && (
                        <>
                          <button
                            onClick={() => changeStatus(item, 'published', 'Published to the News page.')}
                            disabled={isBusy || !sourceUrl}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                          >
                            <Check className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => changeStatus(item, 'rejected', 'Item rejected.')}
                            disabled={isBusy}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                      {item.status === 'published' && (
                        <button
                          onClick={() => handleFacebookPost(item)}
                          disabled={isBusy || !sourceUrl}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                          <Send className="w-4 h-4" /> {item.facebook_posted_at ? 'Post to Facebook again' : 'Post to Facebook'}
                        </button>
                      )}
                      {item.status === 'published' && (
                        <button
                          onClick={() => changeStatus(item, 'draft', 'Removed from the News page and moved back to drafts.')}
                          disabled={isBusy}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                          <EyeOff className="w-4 h-4" /> Unpublish
                        </button>
                      )}
                      {item.status === 'rejected' && (
                        <button
                          onClick={() => changeStatus(item, 'draft', 'Moved back to drafts.')}
                          disabled={isBusy}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                          <RotateCcw className="w-4 h-4" /> Restore to drafts
                        </button>
                      )}
                      {item.status !== 'rejected' && (
                        <button
                          onClick={() => startEditing(item)}
                          disabled={isBusy}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                      )}
                      {item.status === 'rejected' && (
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={isBusy}
                          className="px-4 py-2 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-60 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
