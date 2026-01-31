import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  MapPin,
  Star,
  Clock,
  CreditCard,
  Share2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Image,
  BarChart3,
  Bell,
  Inbox,
  TrendingUp,
  Megaphone,
  Receipt,
  FileText,
  Target,
  ScrollText,
  QrCode,
  Search,
  CheckCircle2,
  Calendar,
  Wallet,
  Navigation,
  Maximize2,
  Minimize2,
  Zap,
  DollarSign,
  Building,
  TrendingUpIcon,
  Wrench,
  Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeInquiries } from '../../hooks/useRealtimeInquiries';
import { requestNotificationPermission } from '../../utils/notificationService';
import CommandPalette from './CommandPalette';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface NavigationGroup {
  id: string;
  name: string;
  icon: React.ElementType;
  defaultExpanded: boolean;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    id: 'core',
    name: 'Core Operations',
    icon: Zap,
    defaultExpanded: true,
    items: [
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Goals', href: '/admin/goals', icon: Target },
      { name: 'Inquiries', href: '/admin/inquiries', icon: Inbox },
      { name: 'Jobs', href: '/admin/jobs', icon: Briefcase },
      { name: 'Completions', href: '/admin/completions', icon: CheckCircle2 },
      { name: 'Reminders', href: '/admin/reminders', icon: Calendar },
    ],
  },
  {
    id: 'financial',
    name: 'Financial Management',
    icon: DollarSign,
    defaultExpanded: true,
    items: [
      { name: 'Invoices', href: '/admin/invoices', icon: FileText },
      { name: 'Finances', href: '/admin/finances', icon: Wallet },
      { name: 'Forecasting', href: '/admin/forecasting', icon: TrendingUp },
      { name: 'Tax Settings', href: '/admin/tax-settings', icon: Receipt },
      { name: 'Mileage Settings', href: '/admin/mileage-settings', icon: Navigation },
      { name: 'Invoice Settings', href: '/admin/invoice-settings', icon: Settings },
    ],
  },
  {
    id: 'business',
    name: 'Business Profile',
    icon: Building,
    defaultExpanded: false,
    items: [
      { name: 'Business Info', href: '/admin/business-info', icon: Building2 },
      { name: 'Services', href: '/admin/services', icon: Briefcase },
      { name: 'Service Areas', href: '/admin/service-areas', icon: MapPin },
      { name: 'Business Hours', href: '/admin/business-hours', icon: Clock },
      { name: 'Payment Methods', href: '/admin/payment-methods', icon: CreditCard },
      { name: 'Gallery', href: '/admin/gallery', icon: Image },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Engagement',
    icon: TrendingUpIcon,
    defaultExpanded: false,
    items: [
      { name: 'Reviews', href: '/admin/reviews', icon: Star },
      { name: 'QR Codes', href: '/admin/qr-codes', icon: QrCode },
      { name: 'Social Media', href: '/admin/social-media', icon: Share2 },
      { name: 'Notification Bar', href: '/admin/notification-bar', icon: Megaphone },
    ],
  },
  {
    id: 'system',
    name: 'System & Tools',
    icon: Wrench,
    defaultExpanded: false,
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Activity Logs', href: '/admin/activity-logs', icon: ScrollText },
      { name: 'Attributes', href: '/admin/attributes', icon: Settings },
    ],
  },
];

const navigation: Array<NavigationItem & { category?: string }> = navigationGroups.flatMap(group =>
  group.items.map(item => ({ ...item, category: group.name }))
);

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { unviewedCount } = useRealtimeInquiries({
    businessId,
    enableNotifications: true
  });

  const getInitialExpandedState = (): Record<string, boolean> => {
    const stored = localStorage.getItem('admin-nav-expanded');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return navigationGroups.reduce((acc, group) => {
      acc[group.id] = group.defaultExpanded;
      return acc;
    }, {} as Record<string, boolean>);
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(getInitialExpandedState);

  useEffect(() => {
    localStorage.setItem('admin-nav-expanded', JSON.stringify(expandedCategories));
  }, [expandedCategories]);

  const toggleCategory = (categoryId: string) => {
    // If sidebar is collapsed, expand it first, then expand the category
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedCategories(prev => ({
        ...prev,
        [categoryId]: true
      }));
    } else {
      setExpandedCategories(prev => ({
        ...prev,
        [categoryId]: !prev[categoryId]
      }));
    }
  };

  const expandAll = () => {
    const allExpanded = navigationGroups.reduce((acc, group) => {
      acc[group.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedCategories(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = navigationGroups.reduce((acc, group) => {
      acc[group.id] = false;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedCategories(allCollapsed);
  };

  useEffect(() => {
    const fetchBusinessId = async () => {
      const { data } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (data) {
        setBusinessId(data.id);
      }
    };
    fetchBusinessId();
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      supabase.realtime.disconnect();
    };

    const handlePageShow = () => {
      supabase.realtime.connect();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        navigation={navigation}
      />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center border-b border-slate-200 p-6 ${sidebarCollapsed ? 'lg:justify-center' : 'justify-between'}`}>
            <Link to="/admin/dashboard" className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-2'}`}>
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className={`font-bold text-xl text-slate-900 transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Admin</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-500 hover:text-slate-700"
              aria-label="Close sidebar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {/* Quick Actions */}
            {!sidebarCollapsed && (
              <div className="mb-4">
                {/* Expand/Collapse All */}
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors flex-1"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors flex-1"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    Collapse All
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Groups */}
            <div className="space-y-3">
              {navigationGroups.map((group, groupIndex) => {
                const isExpanded = expandedCategories[group.id];
                const GroupIcon = group.icon;
                const hasActiveItem = group.items.some(item => location.pathname === item.href);

                return (
                  <div
                    key={group.id}
                    className={groupIndex > 0 ? 'border-t border-slate-100 pt-3' : ''}
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(group.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors relative group ${
                        sidebarCollapsed ? 'lg:justify-center' : ''
                      } ${
                        hasActiveItem
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <GroupIcon className="w-4 h-4 flex-shrink-0" />
                      <span className={`flex-1 text-left transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                        {group.name}
                      </span>
                      {!sidebarCollapsed && (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <ChevronUp className="w-4 h-4 flex-shrink-0" />
                        )
                      )}

                      {/* Tooltip for collapsed state */}
                      {sidebarCollapsed && (
                        <div className="hidden lg:block absolute left-full ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                          {group.name}
                          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                        </div>
                      )}
                    </button>

                    {/* Category Items */}
                    {isExpanded && !sidebarCollapsed && (
                      <ul className="mt-1 space-y-0.5 ml-1">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = location.pathname === item.href;
                          const showBadge = item.name === 'Inquiries' && unviewedCount > 0;

                          return (
                            <li key={item.name}>
                              <Link
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors relative ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="font-medium text-sm">{item.name}</span>
                                {showBadge && (
                                  <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full min-w-[20px]">
                                    {unviewedCount > 99 ? '99+' : unviewedCount}
                                  </span>
                                )}
                                {isActive && !showBadge && <ChevronRight className="w-4 h-4 ml-auto" />}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Collapsed sidebar submenu on hover */}
                    {sidebarCollapsed && (
                      <div className="hidden lg:block absolute left-full top-0 ml-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-50">
                        <div className="bg-white border border-slate-200 rounded-lg shadow-lg py-2 min-w-[200px]">
                          <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 mb-1">
                            {group.name}
                          </div>
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.href;
                            const showBadge = item.name === 'Inquiries' && unviewedCount > 0;

                            return (
                              <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="font-medium text-sm">{item.name}</span>
                                {showBadge && (
                                  <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full min-w-[20px]">
                                    {unviewedCount > 99 ? '99+' : unviewedCount}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Toggle button and logout */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            {/* Toggle collapse button - desktop only */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`hidden lg:flex w-full items-center gap-3 rounded-lg transition-colors px-4 py-3 text-slate-700 hover:bg-slate-50 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-5 h-5 flex-shrink-0" />
              <span className={`font-medium transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>

            {/* User info - hidden when collapsed */}
            <div className={`px-4 py-2 bg-slate-50 rounded-lg transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-xs text-slate-500 mb-1">Signed in as</p>
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.email}
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className={`w-full flex items-center gap-3 text-red-700 hover:bg-red-50 rounded-lg transition-colors relative group ${
                sidebarCollapsed ? 'lg:justify-center lg:px-0 lg:py-3' : 'px-4 py-3'
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={`font-medium transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Sign Out</span>

              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && (
                <div className="hidden lg:block absolute left-full ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                  Sign Out
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-700"
              aria-label="Open sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>

            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors lg:ml-0"
              aria-label="Open search"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden lg:inline-block px-2 py-0.5 text-xs bg-white border border-slate-300 rounded text-slate-700 font-mono">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}K
              </kbd>
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <OrganizationSwitcher />

              <Link
                to="/admin/inquiries"
                className="relative p-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
                title="View Inquiries"
              >
                <Bell className="w-5 h-5" />
                {unviewedCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
                    {unviewedCount > 99 ? '99+' : unviewedCount}
                  </span>
                )}
              </Link>
              <Link
                to="/"
                className="text-sm text-slate-600 hover:text-emerald-600 transition-colors"
              >
                View Website →
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
