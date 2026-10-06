import { supabase } from '../lib/supabase';
import { logAction, type ActionType } from './auditLogService';
import type { NewsItem, NewsItemEdits, NewsStatus, NewsTopic } from '../types/news';

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
 * One page of the public feed, newest first.
 *
 * The `status = 'published'` filter is not redundant with RLS. Anonymous
 * visitors can only read published rows anyway, but a signed-in admin can read
 * drafts too, and without the filter their own drafts would show up on the
 * public page while they were logged in.
 */
export async function getPublishedNews(options: {
  topic?: NewsTopic | null;
  offset?: number;
} = {}): Promise<{ items: NewsItem[]; hasMore: boolean }> {
  const offset = options.offset ?? 0;

  let query = supabase
    .from('news_items')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    // One extra row tells us whether there is another page without a count query.
    .range(offset, offset + NEWS_PAGE_SIZE);

  if (options.topic) {
    query = query.eq('topic', options.topic);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching news:', error);
    throw new Error(`Failed to load news: ${error.message}`);
  }

  const rows = (data || []) as NewsItem[];
  return {
    items: rows.slice(0, NEWS_PAGE_SIZE),
    hasMore: rows.length > NEWS_PAGE_SIZE,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin review queue
 * ────────────────────────────────────────────────────────────────────────── */

/** Every item the signed-in admin's organization owns, newest first. */
export async function getAdminNewsItems(): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching news items:', error);
    throw new Error(`Failed to load news items: ${error.message}`);
  }

  return (data || []) as NewsItem[];
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
