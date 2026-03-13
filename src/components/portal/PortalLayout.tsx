import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-600">Manage your projects and account details</p>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
