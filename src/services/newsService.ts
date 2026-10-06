import { supabase } from '../lib/supabase';
import { logAction, type ActionType } from './auditLogService';
import type { NewsItem, NewsItemEdits, NewsStatus, NewsTopic } from '../types/news';
import type { NewsCursor } from '../utils/news';

export const NEWS_PAGE_SIZE = 25;

/** Fired after an admin changes an item so the sidebar badge can refresh. */
export const NEWS_DRAFTS_CHANGED_EVENT = 'news-drafts-changed';

function notifyDraftsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NEWS_DRAFTS_CHANGED_EVENT));
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public feed
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One page of the public feed, newest first. Pass the cursor from
 * `newsCursor(itemsAlreadyShown)` to get the page after it.
 *
 * The `status = 'published'` filter is not redundant with RLS. Anonymous
 * visitors can only read published rows anyway, but a signed-in admin can read
 * drafts too, and without the filter their own drafts would show up on the
 * public page while they were logged in.
 */
export async function getPublishedNews(options: {
  topic?: NewsTopic | null;
  cursor?: NewsCursor | null;
} = {}): Promise<{ items: NewsItem[]; hasMore: boolean }> {
  const cursor = options.cursor ?? null;
  const alreadyShown = new Set(cursor?.idsAtCursor ?? []);

  // One extra row tells us whether there is another page without a count
  // query. The stories sharing the cursor's timestamp come back again (the
  // filter is "at or before", so a tie cannot hide one) and are dropped below,
  // so they are asked for on top of the page rather than out of it.
  const limit = NEWS_PAGE_SIZE + alreadyShown.size + 1;

  let query = supabase
    .from('news_items')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (options.topic) {
    query = query.eq('topic', options.topic);
  }
  if (cursor) {
    query = query.lte('published_at', cursor.publishedAt);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching news:', error);
    throw new Error(`Failed to load news: ${error.message}`);
  }

  const rows = ((data || []) as NewsItem[]).filter((row) => !alreadyShown.has(row.id));
  return {
    items: rows.slice(0, NEWS_PAGE_SIZE),
    hasMore: rows.length > NEWS_PAGE_SIZE,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin review queue
 * ────────────────────────────────────────────────────────────────────────── */

const ADMIN_FETCH_SIZE = 1000;
/** A runaway guard, not a real limit: 200 requests is 200,000 stories. */
const ADMIN_FETCH_MAX_REQUESTS = 200;

/**
 * Every item the signed-in admin's organization owns, newest first.
 *
 * Read in pages until one comes back empty rather than with a single capped
 * query. Rejected items are kept on purpose, so the table only grows, and a
 * fixed cap would one day drop the oldest stories from the screen without a
 * word: the tab counts would be wrong and an old published story could no
 * longer be found to unpublish. Stopping on an empty page, not a short one,
 * also holds if the API is configured to return fewer rows than asked for.
 */
export async function getAdminNewsItems(): Promise<NewsItem[]> {
  const rows: NewsItem[] = [];

  for (let request = 0; request < ADMIN_FETCH_MAX_REQUESTS; request += 1) {
    const { data, error } = await supabase
      .from('news_items')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + ADMIN_FETCH_SIZE - 1);

    if (error) {
      console.error('Error fetching news items:', error);
      throw new Error(`Failed to load news items: ${error.message}`);
    }

    const page = (data || []) as NewsItem[];
    if (page.length === 0) break;
    rows.push(...page);
  }

  // Rows can shift between requests if something is added mid-read.
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}

export async function getDraftNewsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('news_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft');

  if (error) throw new Error(error.message);
  return count ?? 0;
}

const STATUS_ACTION: Record<NewsStatus, ActionType> = {
  published: 'APPROVE',
  rejected: 'REJECT',
  // Back to the queue: either an unpublish or a rejected item being restored.
  draft: 'RESTORE',
};

export async function setNewsStatus(item: NewsItem, status: NewsStatus): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news_items')
    .update({ status })
    .eq('id', item.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating news status:', error);
    throw new Error(`Failed to update news item: ${error.message}`);
  }

  await logAction({
    actionType: STATUS_ACTION[status],
    tableName: 'news_items',
    recordId: item.id,
    recordIdentifier: item.title,
    oldValues: { status: item.status },
    newValues: { status },
  });

  notifyDraftsChanged();
  return data as NewsItem;
}

export async function updateNewsItem(item: NewsItem, edits: NewsItemEdits): Promise<NewsItem> {
  const changes: NewsItemEdits = {
    title: edits.title.trim(),
    summary: edits.summary.trim(),
    topic: edits.topic,
  };

  const { data, error } = await supabase
    .from('news_items')
    .update(changes)
    .eq('id', item.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating news item:', error);
    throw new Error(`Failed to save news item: ${error.message}`);
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'news_items',
    recordId: item.id,
    recordIdentifier: changes.title,
    oldValues: { title: item.title, summary: item.summary, topic: item.topic },
    newValues: { ...changes },
  });

  return data as NewsItem;
}

export async function setNewsPostToFacebook(item: NewsItem, postToFacebook: boolean): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news_items')
    .update({ post_to_facebook: postToFacebook })
    .eq('id', item.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating Facebook toggle:', error);
    throw new Error(`Failed to update news item: ${error.message}`);
  }

  return data as NewsItem;
}

/**
 * Posts a published item to the Facebook Page. The edge function records the
 * outcome on the row, so the caller should refetch it afterwards.
 */
export async function publishNewsToFacebook(
  item: NewsItem,
): Promise<{ item: NewsItem; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish-news-to-facebook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ news_item_id: item.id }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to post to Facebook');

  const failure = body?.facebook?.success === false ? body.facebook.error : null;

  const { data, error } = await supabase.from('news_items').select('*').eq('id', item.id).single();
  if (error) throw new Error(`Posted, but failed to reload the item: ${error.message}`);

  if (failure) return { item: data as NewsItem, error: failure || 'Unknown Facebook error' };

  await logAction({
    actionType: 'UPDATE',
    tableName: 'news_items',
    recordId: item.id,
    recordIdentifier: item.title,
    newValues: { facebook_post_id: body?.facebook?.post_id ?? null },
  });

  return { item: data as NewsItem, error: null };
}

export async function deleteNewsItem(item: NewsItem): Promise<void> {
  const { error } = await supabase.from('news_items').delete().eq('id', item.id);

  if (error) {
    console.error('Error deleting news item:', error);
    throw new Error(`Failed to delete news item: ${error.message}`);
  }

  await logAction({
    actionType: 'DELETE',
    tableName: 'news_items',
    recordId: item.id,
    recordIdentifier: item.title,
    oldValues: { status: item.status, source_url: item.source_url },
  });

  notifyDraftsChanged();
}
