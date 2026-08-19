import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface AuthorizeResult {
  ok: boolean;
  /** Populated when the caller is a signed-in platform admin. */
  user?: { id: string; email: string | null; fullName: string | null };
  /** True when the caller presented the service role key (internal/cron call). */
  service?: boolean;
  status?: number;
  error?: string;
}

function bearer(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

/**
 * The published anon key is itself a valid JWT, so `verify_jwt` alone proves
 * nothing about the caller. Every privileged function resolves the bearer token
 * to a real user here, or accepts the service role key for internal calls made
 * by other edge functions, webhooks and cron jobs.
 */
export async function authorizeAdminOrService(
  req: Request,
  options: { allowAdminUser?: boolean } = {},
): Promise<AuthorizeResult> {
  const allowAdminUser = options.allowAdminUser !== false;
  const token = bearer(req);

  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: true, service: true };
  }

  if (!allowAdminUser) return { ok: false, status: 401, error: 'Unauthorized' };

  // Anything that is not the service role key must resolve to a real user.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' };

  const appMeta = (data.user.app_metadata || {}) as Record<string, unknown>;
  if (appMeta.is_platform_admin !== true && appMeta.is_platform_admin !== 'true') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      fullName: (data.user.user_metadata?.full_name as string | undefined) ?? null,
    },
  };
}

/** Resolves the bearer token to any signed-in user (no admin requirement). */
export async function authorizeUser(req: Request): Promise<AuthorizeResult> {
  const token = bearer(req);
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' };

  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      fullName: (data.user.user_metadata?.full_name as string | undefined) ?? null,
    },
  };
}
