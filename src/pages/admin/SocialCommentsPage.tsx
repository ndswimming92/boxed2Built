import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, RefreshCw, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import {
  getSocialComments,
  replySocialComment,
  SocialComment,
  SocialCommentsResult,
} from '../../services/apiPlatformService';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SocialCommentsPage() {
  const [result, setResult] = useState<SocialCommentsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'needs_reply' | 'all'>('needs_reply');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Record<string, string>>({});

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getSocialComments();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReply = async (comment: SocialComment) => {
    const message = (drafts[comment.id] || '').trim();
    if (!message) return;
    setSendingId(comment.id);
    setSendError((prev) => ({ ...prev, [comment.id]: '' }));
    try {
      await replySocialComment(comment.platform, comment.id, message);
      setDrafts((prev) => ({ ...prev, [comment.id]: '' }));
      await fetchData(true);
    } catch (err) {
      setSendError((prev) => ({
        ...prev,
        [comment.id]: err instanceof Error ? err.message : 'Failed to send reply.',
      }));
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Social Comments</h1>
          <p className="text-sm sm:text-base text-slate-600">Reply to Facebook and Instagram comments without leaving the admin.</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium mb-1">{error}</p>
            <p>
              Make sure Facebook is connected under{' '}
              <Link to="/admin/connections" className="underline">
                Admin → Connections
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const comments = filter === 'needs_reply' ? result.comments.filter((c) => !c.replied) : result.comments;
  const platformError = result.facebook_error || result.instagram_error;

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Social Comments</h1>
          <p className="text-sm sm:text-base text-slate-600">Reply to Facebook and Instagram comments without leaving the admin.</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {platformError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{platformError}</p>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('needs_reply')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            filter === 'needs_reply' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Needs Reply ({result.comments.filter((c) => !c.replied).length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All ({result.comments.length})
        </button>
      </div>

      {comments.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            {filter === 'needs_reply' ? "You're all caught up — no comments waiting on a reply." : 'No comments found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${comment.platform === 'facebook' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                  {comment.platform === 'facebook' ? (
                    <Facebook className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Instagram className="w-4 h-4 text-pink-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                    <p className="text-xs text-slate-500">{formatDate(comment.created_time)}</p>
                    {comment.replied && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Replied
                      </span>
                    )}
                    {comment.post_permalink && (
                      <a
                        href={comment.post_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        View post
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{comment.message}</p>

                  {!comment.replied && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={drafts[comment.id] || ''}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleReply(comment);
                        }}
                        placeholder="Write a reply…"
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={() => handleReply(comment)}
                        disabled={sendingId === comment.id || !(drafts[comment.id] || '').trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sendingId === comment.id ? 'Sending…' : 'Reply'}
                      </button>
                    </div>
                  )}
                  {sendError[comment.id] && (
                    <p className="text-xs text-red-600 mt-1">{sendError[comment.id]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
