import { User } from '@supabase/supabase-js';

export function getAuthorizedEmails(): string[] {
  const emailsEnv = import.meta.env.VITE_AUTHORIZED_ADMIN_EMAILS;

  if (!emailsEnv) {
    console.warn('VITE_AUTHORIZED_ADMIN_EMAILS not configured. No admin access will be granted.');
    return [];
  }

  return emailsEnv
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter((email: string) => email.length > 0);
}

export function isUserAuthorized(user: User | null): boolean {
  if (!user || !user.email) {
    return false;
  }

  const authorizedEmails = getAuthorizedEmails();
  const userEmail = user.email.toLowerCase();

  return authorizedEmails.includes(userEmail);
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
