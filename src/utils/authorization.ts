import { User } from '@supabase/supabase-js';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getEnvList(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((entry: string) => entry.trim().toLowerCase())
    .filter((entry: string) => entry.length > 0);
}

function emailDomainMatches(email: string, allowedDomains: string[]): boolean {
  const emailDomain = normalizeEmail(email).split('@')[1];
  if (!emailDomain) return false;
  return allowedDomains.includes(emailDomain);
}

export function getAuthorizedEmails(): string[] {
  const emailsEnv = import.meta.env.VITE_AUTHORIZED_ADMIN_EMAILS;

  if (!emailsEnv) {
    console.warn('VITE_AUTHORIZED_ADMIN_EMAILS not configured. No admin access will be granted.');
    return [];
  }

  return getEnvList(emailsEnv);
}

export function getAuthorizedAdminDomains(): string[] {
  return getEnvList(import.meta.env.VITE_AUTHORIZED_ADMIN_DOMAINS);
}

export function isUserAuthorized(user: User | null): boolean {
  if (!user || !user.email) {
    return false;
  }

  const authorizedEmails = getAuthorizedEmails();
  const authorizedDomains = getAuthorizedAdminDomains();
  const userEmail = normalizeEmail(user.email);

  if (authorizedEmails.includes(userEmail)) {
    return true;
  }

  if (authorizedDomains.length > 0 && emailDomainMatches(userEmail, authorizedDomains)) {
    return true;
  }

  return false;
}

export function getAuthorizedClientEmails(): string[] {
  const emailsEnv = import.meta.env.VITE_AUTHORIZED_CLIENT_EMAILS;

  if (!emailsEnv) {
    console.warn('VITE_AUTHORIZED_CLIENT_EMAILS not configured. Portal access defaults to non-admin users.');
    return [];
  }

  return getEnvList(emailsEnv);
}

export function getAuthorizedClientDomains(): string[] {
  return getEnvList(import.meta.env.VITE_AUTHORIZED_CLIENT_DOMAINS);
}

export function isClientAuthorized(user: User | null): boolean {
  if (!user || !user.email) {
    return false;
  }

  if (isUserAuthorized(user)) {
    return false;
  }

  const userEmail = normalizeEmail(user.email);
  const authorizedClientEmails = getAuthorizedClientEmails();
  if (authorizedClientEmails.length > 0) {
    return authorizedClientEmails.includes(userEmail);
  }

  const authorizedClientDomains = getAuthorizedClientDomains();
  if (authorizedClientDomains.length > 0) {
    return emailDomainMatches(userEmail, authorizedClientDomains);
  }

  return true;
}

export function isAdminUser(user: User | null): boolean {
  return isUserAuthorized(user);
}

export function getAuthorizationError(user: User | null): string {
  if (!user) {
    return 'Authentication required';
  }

  if (!user.email) {
    return 'User email not found';
  }

  return `Access denied: ${user.email} is not authorized to access the admin portal`;
}

export function getAccountLinkingError(user: User | null): string | null {
  if (!user?.email) return 'User email not found';

  // Authorized admins are trusted: their identities are managed intentionally
  // (e.g. a Google account whose email differs from the primary), so the
  // account-linking heuristics below must never sign them out.
  if (isUserAuthorized(user)) return null;

  const primaryEmail = normalizeEmail(user.email);
  const identities = user.identities ?? [];

  const duplicateProviders = new Set<string>();
  const seenProviders = new Set<string>();

  for (const identity of identities) {
    const provider = identity.provider;
    if (seenProviders.has(provider)) {
      duplicateProviders.add(provider);
    }
    seenProviders.add(provider);
  }

  for (const identity of identities) {
    const identityEmail = identity.identity_data?.email
      ? normalizeEmail(identity.identity_data.email)
      : primaryEmail;

    if (identityEmail !== primaryEmail) {
      return 'Account linking denied: provider identity email does not match the primary account email.';
    }
  }

  if (duplicateProviders.size > 0) {
    return `Account linking denied: duplicate provider identities detected (${Array.from(duplicateProviders).join(', ')}).`;
  }

  return null;
}
