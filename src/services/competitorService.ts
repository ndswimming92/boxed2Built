import { supabase } from '../lib/supabase';
import type { ActionItemStatus, Competitor, CompetitorActionItem } from '../types/competitors';

const FETCH_SIZE = 1000;
/** A runaway guard, not a real limit. */
const FETCH_MAX_REQUESTS = 50;

/**
 * Every row of one Competitor Watch table for one organization.
 *
 * The organization filter is not redundant with RLS. RLS decides which rows
 * the signed-in admin may read, and an admin of several organizations (or a
 * platform admin, who may read them all) would otherwise get every
 * organization's rows in one list under one business's name.
 *
 * Removed competitors and ticked-off items are kept, so the tables only grow;
 * they are read in pages until one comes back empty rather than with a single
 * capped query, the same way Grants is.
 */
async function fetchAll<T extends { id: string }>(
  table: 'competitors' | 'competitor_action_items',
  organizationId: string,
  what: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let request = 0; request < FETCH_MAX_REQUESTS; request += 1) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + FETCH_SIZE - 1);

    if (error) {
      console.error(`Error fetching ${what}:`, error);
      throw new Error(`Failed to load ${what}: ${error.message}`);
    }

    const page = (data || []) as T[];
    if (page.length === 0) break;
    rows.push(...page);
  }

  // Rows can shift between requests if the weekly run saves mid-read.
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}

export function getCompetitors(organizationId: string): Promise<Competitor[]> {
  return fetchAll<Competitor>('competitors', organizationId, 'competitors');
}

export function getActionItems(organizationId: string): Promise<CompetitorActionItem[]> {
  return fetchAll<CompetitorActionItem>('competitor_action_items', organizationId, 'the checklist');
}

/**
 * Tick an item off, remove it, or put it back on the list.
 *
 * `status` is the only column the database lets the browser write here, and
 * only for owners and admins. Who changed it and when are set there.
 */
export async function setActionItemStatus(
  itemId: string,
  organizationId: string,
  status: ActionItemStatus,
): Promise<CompetitorActionItem> {
  const { data, error } = await supabase
    .from('competitor_action_items')
    .update({ status })
    .eq('id', itemId)
    .eq('organization_id', organizationId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error updating checklist item:', error);
    throw new Error(`Failed to save: ${error.message}`);
  }
  if (!data) throw new Error('Failed to save: you may not have permission to change this item');
  return data as CompetitorActionItem;
}

/**
 * Take a business off the competitor list, or put it back.
 *
 * The row is kept either way: the weekly run reads removed rows so it does not
 * add the same business again. The database stores its own clock's time and
 * the signed-in user, whatever timestamp is sent here.
 */
export async function setCompetitorRemoved(
  competitorId: string,
  organizationId: string,
  removed: boolean,
): Promise<Competitor> {
  const { data, error } = await supabase
    .from('competitors')
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq('id', competitorId)
    .eq('organization_id', organizationId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error updating competitor:', error);
    throw new Error(`Failed to save: ${error.message}`);
  }
  if (!data) throw new Error('Failed to save: you may not have permission to change this competitor');
  return data as Competitor;
}
