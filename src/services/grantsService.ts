import { supabase } from '../lib/supabase';
import type { BusinessGrant } from '../types/grants';

const FETCH_SIZE = 1000;
/** A runaway guard, not a real limit. */
const FETCH_MAX_REQUESTS = 50;

/**
 * Every grant the daily grant finder has saved for one organization.
 *
 * The organization filter is not redundant with RLS. RLS decides which rows
 * the signed-in admin may read, and an admin of several organizations (or a
 * platform admin, who may read them all) would otherwise get every
 * organization's grants in one list under one business's name.
 *
 * Read-only on purpose: the grant finder is the only writer, and the browser is
 * granted SELECT and nothing else on this table. Closed grants are kept, so the
 * table only grows; it is read in pages until one comes back empty rather than
 * with a single capped query, the same way the News Feed is.
 */
export async function getGrants(organizationId: string): Promise<BusinessGrant[]> {
  const rows: BusinessGrant[] = [];

  for (let request = 0; request < FETCH_MAX_REQUESTS; request += 1) {
    const { data, error } = await supabase
      .from('business_grants')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + FETCH_SIZE - 1);

    if (error) {
      console.error('Error fetching grants:', error);
      throw new Error(`Failed to load grants: ${error.message}`);
    }

    const page = (data || []) as BusinessGrant[];
    if (page.length === 0) break;
    rows.push(...page);
  }

  // Rows can shift between requests if the grant finder saves mid-read.
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}
