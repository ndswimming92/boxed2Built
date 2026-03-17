import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { customerPortalService, PortalServiceError, type CustomerPortalProfile } from '../../services/customerPortalService';
import { supportTicketService } from '../../services/supportTicketService';
import { hasUnreadSupportUpdate } from '../../utils/supportUnread';

interface PortalLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const navItems = [
  { to: '/portal/dashboard', label: 'Dashboard' },
  { to: '/portal/jobs', label: 'Jobs' },
  { to: '/portal/invoices', label: 'Invoices' },
  { to: '/portal/documents', label: 'Documents' },
  { to: '/portal/notifications', label: 'Notifications' },
  { to: '/portal/support', label: 'Support' },
  { to: '/portal/profile', label: 'Profile' },
  { to: '/portal/link-account', label: 'Link Account' },
];

export default function PortalLayout({ title, subtitle, children }: PortalLayoutProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [accountLinked, setAccountLinked] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  const [hasUnreadSupportMessages, setHasUnreadSupportMessages] = useState(false);

  useEffect(() => {
    const determineAccountLinking = async () => {
      try {
        const myProfile = await customerPortalService.getMyProfile();
        setProfile(myProfile);
        setAccountLinked(true);
      } catch (error) {
        if (error instanceof PortalServiceError && error.code === 'NOT_FOUND') {
          setAccountLinked(false);
          return;
        }

        // Keep navigation available if portal profile endpoint is unavailable.
        setAccountLinked(false);
      }
    };

    void determineAccountLinking();
  }, []);

  useEffect(() => {
    const loadSupportUnreadState = async () => {
      try {
        const myTickets = await supportTicketService.getMyTickets();
        setHasUnreadSupportMessages(myTickets.some((ticket) => hasUnreadSupportUpdate(ticket.id, ticket.last_admin_message_at)));
      } catch {
        setHasUnreadSupportMessages(false);
      }
    };

    const handleStorage = () => {
      void loadSupportUnreadState();
    };

    void loadSupportUnreadState();
    const interval = window.setInterval(() => {
      void loadSupportUnreadState();
    }, 60000);
    window.addEventListener('focus', handleStorage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const displayName = useMemo(() => {
    const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    return profile?.full_name || metadataName || user?.email?.split('@')[0] || 'Customer';
  }, [profile?.full_name, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.name]);

  const displayEmail = profile?.email || user?.email || 'Unknown email';
  const visibleNavItems = navItems.filter((item) => item.to !== '/portal/link-account' || accountLinked === false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <header className="border-b border-indigo-100/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Account Center</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Client Portal</h1>
                <p className="max-w-xl text-sm text-slate-600">Manage your projects, invoices, and account details in one place.</p>
              </div>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-indigo-50 px-4 py-2.5 text-xs text-slate-600 shadow-sm">
                  <p>
                    Logged in as <span className="font-semibold text-slate-900">{displayName}</span>
                  </p>
                  <p className="truncate text-slate-500">{displayEmail}</p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 p-1.5 shadow-inner">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow'
                        : 'text-slate-700 hover:bg-white hover:text-indigo-700'
                    }`
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    {item.to === '/portal/support' && hasUnreadSupportMessages ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-label="Unread support update" />
                    ) : null}
                  </span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/50 to-sky-50/60 p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
