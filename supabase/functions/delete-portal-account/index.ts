import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

/**
 * Permanently deletes portal accounts from the admin Portal Adoption page.
 *
 * For each customer id this removes, in order:
 *   1. files the customer uploaded to storage (portal documents, and the photos
 *      on their saved requests unless a kept inquiry still shows the same photo)
 *   2. requests they saved but never submitted
 *   3. their login, so they can no longer sign in
 *   4. the CRM `clients` record with the same email, and its notes
 *   5. the `customers` row; the database cascades the rest of the portal data
 *      (notifications, documents, support tickets, funnel history, consents ...)
 *
 * Jobs, invoices, bookings, inquiries and job completions are KEPT: their
 * foreign keys are ON DELETE SET NULL, so they stay in the books unlinked. A
 * saved request that became an inquiry is kept with it.
 *
 * An account with rows in the immutable privacy_audit_events table is refused
 * before anything is touched; see the check in deleteOne.
 *
 * The customers row goes last on purpose. Every earlier step is safe to repeat,
 * so if one fails the account is still listed and the admin can simply retry.
 *
 * A login is left alone when it belongs to staff (a platform admin or an
 * organization member), to the admin making the call, or to another customer
 * record that is not being deleted.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const MAX_BATCH = 50;
const FURNITURE_PHOTO_BUCKET = 'furniture-photos';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DeleteResult {
  customerId: string;
  success: boolean;
  error?: string;
  email?: string | null;
  loginDeleted?: boolean;
  /** Why the login was kept, when it was. */
  loginKeptReason?: string;
  clientsDeleted?: number;
  filesDeleted?: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Escapes LIKE wildcards so an email is matched literally by `ilike`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function removeFiles(admin: SupabaseClient, byBucket: Map<string, Set<string>>): Promise<number> {
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    const list = [...paths];
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`Could not delete uploaded files (${bucket}): ${error.message}`);
      removed += chunk.length;
    }
  }
  return removed;
}

async function deleteOne(
  admin: SupabaseClient,
  customerId: string,
  callerUserId: string | null,
  batchIds: Set<string>,
): Promise<DeleteResult> {
  const { data: customer, error: customerErr } = await admin
    .from('customers')
    .select('id, organization_id, auth_user_id, email, full_name')
    .eq('id', customerId)
    .maybeSingle();

  if (customerErr) throw new Error(customerErr.message);
  if (!customer) return { customerId, success: false, error: 'Account not found. It may already have been deleted.' };

  const authUserId: string | null = customer.auth_user_id;
  const email = (customer.email ?? '').trim();

  // privacy_audit_events is immutable: triggers reject every UPDATE and DELETE,
  // including the SET NULL its foreign keys perform when a customer or login is
  // removed. Check before anything destructive, so such an account is refused
  // whole rather than left half-deleted with no way to finish.
  const auditFilter = authUserId
    ? `customer_id.eq.${customerId},actor_user_id.eq.${authUserId}`
    : `customer_id.eq.${customerId}`;
  const { count: auditCount, error: auditErr } = await admin
    .from('privacy_audit_events')
    .select('id', { count: 'exact', head: true })
    .or(auditFilter);
  if (auditErr) throw new Error(auditErr.message);
  if ((auditCount ?? 0) > 0) {
    return {
      customerId,
      success: false,
      email: customer.email,
      error:
        'This account has privacy audit history (consent changes or privacy requests), which is locked against changes. Nothing was deleted.',
    };
  }

  // 1. Uploaded files.
  const files = new Map<string, Set<string>>();
  const addFile = (bucket: string, path: string) => {
    if (!bucket || !path) return;
    if (!files.has(bucket)) files.set(bucket, new Set());
    files.get(bucket)!.add(path);
  };

  const { data: documents, error: documentsErr } = await admin
    .from('portal_documents')
    .select('storage_bucket, storage_path')
    .eq('owner_customer_id', customerId);
  if (documentsErr) throw new Error(documentsErr.message);
  for (const doc of documents ?? []) addFile(doc.storage_bucket, doc.storage_path);

  // Requests the customer saved without submitting. One that became an inquiry
  // (inquiry_id set) is that inquiry's customer-facing copy, holding its
  // confirmation code and SMS consent record, so it is kept with the inquiry.
  // The contact form does not set customer_id, so match by email as well.
  type SavedRequest = { id: string; inquiry_id: string | null; furniture_image_path: string | null };
  const savedById = new Map<string, SavedRequest>();

  const { data: savedByCustomer, error: savedErr } = await admin
    .from('saved_requests')
    .select('id, inquiry_id, furniture_image_path')
    .eq('customer_id', customerId);
  if (savedErr) throw new Error(savedErr.message);
  for (const r of (savedByCustomer ?? []) as SavedRequest[]) savedById.set(r.id, r);

  if (email) {
    const { data: savedByEmail, error: savedEmailErr } = await admin
      .from('saved_requests')
      .select('id, inquiry_id, furniture_image_path')
      .eq('organization_id', customer.organization_id)
      .ilike('client_email', escapeLike(email));
    if (savedEmailErr) throw new Error(savedEmailErr.message);
    for (const r of (savedByEmail ?? []) as SavedRequest[]) savedById.set(r.id, r);
  }

  const savedRequests = [...savedById.values()].filter((r) => r.inquiry_id === null);

  const savedPhotoPaths = [
    ...new Set(savedRequests.map((r) => r.furniture_image_path).filter((p): p is string => !!p)),
  ];
  if (savedPhotoPaths.length > 0) {
    // A submitted inquiry reuses the saved request's photo. Inquiries are kept,
    // so their photo has to survive.
    const { data: inUse, error: inUseErr } = await admin
      .from('form_inquiries')
      .select('furniture_image_path')
      .in('furniture_image_path', savedPhotoPaths);
    if (inUseErr) throw new Error(inUseErr.message);
    const kept = new Set((inUse ?? []).map((r) => r.furniture_image_path));
    for (const path of savedPhotoPaths) {
      if (!kept.has(path)) addFile(FURNITURE_PHOTO_BUCKET, path);
    }
  }

  const filesDeleted = await removeFiles(admin, files);

  // 2. Unsubmitted saved requests.
  if (savedRequests.length > 0) {
    const { error } = await admin
      .from('saved_requests')
      .delete()
      .in('id', savedRequests.map((r) => r.id));
    if (error) throw new Error(`Could not delete saved requests: ${error.message}`);
  }

  // 3. Login.
  let loginDeleted = false;
  let loginKeptReason: string | undefined;

  if (authUserId) {
    if (authUserId === callerUserId) {
      loginKeptReason = 'This is the login you are signed in with.';
    } else {
      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(authUserId);
      const notFound = !!userErr && (userErr.status === 404 || /not found/i.test(userErr.message));
      if (userErr && !notFound) throw new Error(`Could not look up the login: ${userErr.message}`);

      if (userData?.user) {
        const appMeta = (userData.user.app_metadata || {}) as Record<string, unknown>;
        const isPlatformAdmin = appMeta.is_platform_admin === true || appMeta.is_platform_admin === 'true';

        const { count: memberCount, error: memberErr } = await admin
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUserId);
        if (memberErr) throw new Error(memberErr.message);

        const { data: siblings, error: siblingErr } = await admin
          .from('customers')
          .select('id')
          .eq('auth_user_id', authUserId)
          .neq('id', customerId);
        if (siblingErr) throw new Error(siblingErr.message);
        const sharedElsewhere = (siblings ?? []).some((s) => !batchIds.has(s.id));

        if (isPlatformAdmin || (memberCount ?? 0) > 0) {
          loginKeptReason = 'This login belongs to a staff member, so it was kept.';
        } else if (sharedElsewhere) {
          loginKeptReason = 'This login is also used by another customer record, so it was kept.';
        } else {
          // stripe_customers.user_id is NOT NULL with no ON DELETE action, so a
          // leftover mapping row would block the login from being removed.
          const { error: stripeErr } = await admin.from('stripe_customers').delete().eq('user_id', authUserId);
          if (stripeErr) throw new Error(`Could not clear the payment profile link: ${stripeErr.message}`);

          const { error: deleteUserErr } = await admin.auth.admin.deleteUser(authUserId);
          if (deleteUserErr) throw new Error(`Could not delete the login: ${deleteUserErr.message}`);
          loginDeleted = true;
        }
      }
    }
  }

  // 4. Matching CRM record (same email, same organization).
  let clientsDeleted = 0;
  if (email) {
    const { data: clients, error: clientsErr } = await admin
      .from('clients')
      .select('id, organization_id')
      .ilike('email', escapeLike(email));
    if (clientsErr) throw new Error(clientsErr.message);

    const clientIds = (clients ?? [])
      .filter((c) => c.organization_id === null || c.organization_id === customer.organization_id)
      .map((c) => c.id);

    if (clientIds.length > 0) {
      const { error } = await admin.from('clients').delete().in('id', clientIds);
      if (error) throw new Error(`Could not delete the CRM customer record: ${error.message}`);
      clientsDeleted = clientIds.length;
    }
  }

  // 5. The account itself. Everything portal-side cascades from here.
  const { error: deleteErr } = await admin.from('customers').delete().eq('id', customerId);
  if (deleteErr) throw new Error(`Could not delete the account: ${deleteErr.message}`);

  return {
    customerId,
    success: true,
    email: customer.email,
    loginDeleted,
    loginKeptReason,
    clientsDeleted,
    filesDeleted,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

    // Signed-in platform admins only. This is destructive, so there is no
    // service-key path: it must always be traceable to a person.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ success: false, error: auth.error }, auth.status ?? 401);
    if (!auth.user) return json({ success: false, error: 'Forbidden' }, 403);

    const body = (await req.json().catch(() => null)) as { customerIds?: unknown } | null;
    const rawIds = Array.isArray(body?.customerIds) ? body!.customerIds : [];
    const customerIds = [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)))];

    if (customerIds.length === 0 || customerIds.length !== rawIds.length) {
      return json({ success: false, error: 'customerIds must be a list of unique account ids.' }, 400);
    }
    if (customerIds.length > MAX_BATCH) {
      return json({ success: false, error: `You can delete at most ${MAX_BATCH} accounts at a time.` }, 400);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const batchIds = new Set(customerIds);
    const results: DeleteResult[] = [];
    for (const customerId of customerIds) {
      try {
        results.push(await deleteOne(admin, customerId, auth.user.id, batchIds));
      } catch (err) {
        console.error('delete-portal-account failed', { customerId, error: err });
        results.push({
          customerId,
          success: false,
          error: err instanceof Error ? err.message : 'Unexpected error while deleting this account.',
        });
      }
    }

    return json({ success: results.every((r) => r.success), results });
  } catch (err) {
    console.error('delete-portal-account error', err);
    return json({ success: false, error: 'Unexpected error.' }, 500);
  }
});
