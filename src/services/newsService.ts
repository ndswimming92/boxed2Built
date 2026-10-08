import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { readWithRetry } from '../utils/publicRead';
import { logAction, type ActionType } from './auditLogService';
import type {
  FurnitureType,
  NewsItem,
  NewsItemEdits,
  NewsStatus,
  NewsTopic,
  SaleFilterRow,
  SaleScope,
} from '../types/news';
import {
  centralToday,
  endingAfterCondition,
  isEndingOrder,
  type NewsCursor,
  type NewsOrder,
} from '../utils/news';

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
 * One page of the public feed, newest first unless `order` is 'oldest'. Pass the cursor from
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
  order?: NewsOrder;
  /** Sales only: `store_slug`, local or online, and a furniture type. Ignored on other topics. */
  store?: string | null;
  scope?: SaleScope | null;
  type?: FurnitureType | null;
} = {}): Promise<{ items: NewsItem[]; hasMore: boolean; total: number | null }> {
  const order = options.order ?? 'newest';
  const ascending = order === 'oldest';
  const byEndDate = isEndingOrder(order);
  const cursor = options.cursor ?? null;
  const alreadyShown = new Set(cursor?.idsAtCursor ?? []);

  // One extra row tells us whether there is another page without a count
  // query. The stories sharing the cursor's timestamp come back again (the
  // filter is "at or before", so a tie cannot hide one) and are dropped below,
  // so they are asked for on top of the page rather than out of it. An end-date
  // page starts strictly after the last sale shown, so it has no ties to ask for.
  const limit = byEndDate ? NEWS_PAGE_SIZE + 1 : NEWS_PAGE_SIZE + alreadyShown.size + 1;

  // Rebuilt for each attempt, because a query can only be sent once.
  const buildQuery = (client: SupabaseClient) => {
    // The total is only asked for on the first page; later pages keep it.
    let query = client
      .from('news_items')
      .select('*', cursor ? undefined : { count: 'exact' })
      .eq('status', 'published')
      .limit(limit);

    // Expired deals stay published but drop off the feed the day after ends_on.
    // RLS enforces this for visitors; this covers signed-in admins. An end-date
    // page carries its "after the last sale shown" condition in the same filter,
    // so there is one `or` and no doubt about how two of them would combine.
    const notExpired = `or(ends_on.is.null,ends_on.gte.${centralToday()})`;
    query =
      byEndDate && cursor
        ? query.or(`and(${notExpired},or(${endingAfterCondition(order, cursor)}))`)
        : query.or(`ends_on.is.null,ends_on.gte.${centralToday()}`);

    if (byEndDate) {
      // Nulls last in both directions; ties and open-ended sales newest first.
      query = query
        .order('ends_on', { ascending: order === 'ending_soonest', nullsFirst: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });
    } else {
      query = query
        .order('published_at', { ascending, nullsFirst: false })
        .order('id', { ascending });
    }

    if (options.topic) {
      query = query.eq('topic', options.topic);
    }
    if (options.topic === 'deals') {
      if (options.store) query = query.eq('store_slug', options.store);
      if (options.scope) query = query.eq('sale_scope', options.scope);
      if (options.type) query = query.contains('furniture_types', [options.type]);
    }
    if (cursor && !byEndDate) {
      query = ascending
        ? query.gte('published_at', cursor.publishedAt)
        : query.lte('published_at', cursor.publishedAt);
    }
    // The client would otherwise retry 503s and dropped connections on its own,
    // three times over seven seconds. readWithRetry owns the retry policy, and
    // stacked retries from a crowd of visitors are what hurts a struggling
    // database most.
    return query.retry(false);
  };

  const { data, error, count } = await readWithRetry(() => buildQuery(supabase));

  if (error) {
    console.error('Error fetching news:', error);
    throw new Error(`Failed to load news: ${error.message}`);
  }

  const rows = ((data || []) as NewsItem[]).filter((row) => !alreadyShown.has(row.id));
  return {
    items: rows.slice(0, NEWS_PAGE_SIZE),
    hasMore: rows.length > NEWS_PAGE_SIZE,
    total: count ?? null,
  };
}

/**
 * The stores, local/online choices and furniture types among the live sales,
 * with counts, for the Sales tab's filters. Returns an empty list if the
 * database function is not there yet, so the page just shows no filters.
 */
export async function getSaleFilterOptions(): Promise<SaleFilterRow[]> {
  const { data, error } = await readWithRetry(() =>
    supabase.rpc('news_sale_filter_options').retry(false),
  );
  if (error) {
    console.error('Error fetching sale filter options:', error);
    return [];
  }
  return ((data || []) as SaleFilterRow[]).map((row) => ({
    ...row,
    furniture_types: row.furniture_types ?? [],
    sale_count: Number(row.sale_count),
  }));
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
  const unique = rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));

  const facebook = await getFacebookPostResults();
  return unique.map((row) => withFacebookResult(row, facebook.get(row.id)));
}

interface FacebookPostResult {
  news_item_id: string;
  post_id: string | null;
  posted_at: string | null;
  last_error: string | null;
}

/** Admin-only table, so Graph API errors never ride along on public rows. */
async function getFacebookPostResults(newsItemId?: string): Promise<Map<string, FacebookPostResult>> {
  const results = new Map<string, FacebookPostResult>();

  for (let request = 0; request < ADMIN_FETCH_MAX_REQUESTS; request += 1) {
    let query = supabase
      .from('news_facebook_posts')
      .select('news_item_id, post_id, posted_at, last_error')
      .order('news_item_id')
      .range(results.size, results.size + ADMIN_FETCH_SIZE - 1);
    if (newsItemId) query = query.eq('news_item_id', newsItemId);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching Facebook post results:', error);
      throw new Error(`Failed to load Facebook post results: ${error.message}`);
    }

    const page = (data || []) as FacebookPostResult[];
    if (page.length === 0) break;
    for (const row of page) results.set(row.news_item_id, row);
  }

  return results;
}

/** Updates return the bare news_items row, which carries no Facebook result. */
function keepFacebookResult(previous: NewsItem, updated: NewsItem): NewsItem {
  return {
    ...updated,
    facebook_post_id: previous.facebook_post_id,
    facebook_posted_at: previous.facebook_posted_at,
    facebook_post_error: previous.facebook_post_error,
  };
}

function withFacebookResult(item: NewsItem, result: FacebookPostResult | undefined): NewsItem {
  return {
    ...item,
    facebook_post_id: result?.post_id ?? null,
    facebook_posted_at: result?.posted_at ?? null,
    facebook_post_error: result?.last_error ?? null,
  };
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
  return keepFacebookResult(item, data as NewsItem);
}

export async function updateNewsItem(item: NewsItem, edits: NewsItemEdits): Promise<NewsItem> {
  const changes: NewsItemEdits = {
    title: edits.title.trim(),
    summary: edits.summary.trim(),
    topic: edits.topic,
    // Only deals expire; an end date on any other topic would hide a news story.
    ends_on: edits.topic === 'deals' ? edits.ends_on || null : null,
    // Store details only mean something on a sale.
    store_name: edits.topic === 'deals' ? edits.store_name?.trim() || null : null,
    sale_scope: edits.topic === 'deals' ? edits.sale_scope || null : null,
    furniture_types: edits.topic === 'deals' ? edits.furniture_types : [],
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
    oldValues: {
      title: item.title,
      summary: item.summary,
      topic: item.topic,
      ends_on: item.ends_on,
      store_name: item.store_name,
      sale_scope: item.sale_scope,
      furniture_types: item.furniture_types,
    },
    newValues: { ...changes },
  });

  return keepFacebookResult(item, data as NewsItem);
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

  return keepFacebookResult(item, data as NewsItem);
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
  const facebook = await getFacebookPostResults(item.id);
  const reloaded = withFacebookResult(data as NewsItem, facebook.get(item.id));

  if (failure) return { item: reloaded, error: failure || 'Unknown Facebook error' };

  await logAction({
    actionType: 'UPDATE',
    tableName: 'news_items',
    recordId: item.id,
    recordIdentifier: item.title,
    newValues: { facebook_post_id: body?.facebook?.post_id ?? null },
  });

  return { item: reloaded, error: body?.tracking_error ?? null };
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
