import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, BarChart3, Binoculars, Boxes, Briefcase, Building, Building2, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, CreditCard, DollarSign, Eye, EyeOff, ExternalLink, FileText, Flame, FlaskConical, FolderOpen, Gift, HandCoins, HardHat, History, Image, Inbox, KeyRound, LayoutDashboard, Link as LinkIcon, LogOut, Mail, MapPin, Maximize2, Megaphone, Menu, MessageCircle, MessageSquare, Minimize2, Navigation, Newspaper, Palette, Plug, QrCode, Receipt, ScrollText, Search, Send, Settings, ShieldCheck, Share2, ShoppingBag, Star, Target, Ticket, TrendingUp, TrendingUp as TrendingUpIcon, Users, Wand2, Wrench, X, Zap, CalendarCheck, CalendarClock } from 'lucide-react';
import { Youtube } from '../ui/BrandIcons';
import { supabase } from '../../lib/supabase';
import { useRealtimeInquiries } from '../../hooks/useRealtimeInquiries';
import { useSocialCommentsBadge } from '../../hooks/useSocialCommentsBadge';
import { useSocialMessagesBadge } from '../../hooks/useSocialMessagesBadge';
import { useNewsDraftsBadge } from '../../hooks/useNewsDraftsBadge';
import { requestNotificationPermission } from '../../utils/notificationService';
import CommandPalette from './CommandPalette';
import NotificationBell from './NotificationBell';
import { PrivacyModeProvider, usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
  ownerOnly?: boolean;
}

interface NavigationGroup {
  id: string;
  name: string;
  icon: React.ElementType;
  defaultExpanded: boolean;
  theme: string;
  items: NavigationItem[];
}

interface GroupTheme {
  header: string;
  headerActive: string;
  badge: string;
}

// Full class strings so Tailwind can see them at build time.
const groupThemes: Record<string, GroupTheme> = {
  emerald: { header: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200', headerActive: 'ring-2 ring-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  blue: { header: 'bg-blue-100 text-blue-800 hover:bg-blue-200', headerActive: 'ring-2 ring-blue-500', badge: 'bg-blue-100 text-blue-700' },
  violet: { header: 'bg-violet-100 text-violet-800 hover:bg-violet-200', headerActive: 'ring-2 ring-violet-500', badge: 'bg-violet-100 text-violet-700' },
  orange: { header: 'bg-orange-100 text-orange-800 hover:bg-orange-200', headerActive: 'ring-2 ring-orange-500', badge: 'bg-orange-100 text-orange-700' },
  rose: { header: 'bg-rose-100 text-rose-800 hover:bg-rose-200', headerActive: 'ring-2 ring-rose-500', badge: 'bg-rose-100 text-rose-700' },
  slate: { header: 'bg-slate-200 text-slate-800 hover:bg-slate-300', headerActive: 'ring-2 ring-slate-500', badge: 'bg-slate-200 text-slate-700' },
  cyan: { header: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200', headerActive: 'ring-2 ring-cyan-500', badge: 'bg-cyan-100 text-cyan-700' },
  amber: { header: 'bg-amber-100 text-amber-800', headerActive: 'ring-2 ring-amber-500', badge: 'bg-amber-100 text-amber-700' },
};

const QUICK_ACCESS_LIMIT = 5;
const QUICK_ACCESS_MIN_SCORE = 2;
const USAGE_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

// Each visit adds 1 to a score that halves every week, so recent visits count most.
interface UsageEntry {
  score: number;
  updatedAt: number;
}

const decayedScore = (entry: UsageEntry, now: number) =>
  entry.score * Math.pow(0.5, (now - entry.updatedAt) / USAGE_HALF_LIFE_MS);

function addVisit(usage: Record<string, UsageEntry>, href: string): Record<string, UsageEntry> {
  const now = Date.now();
  return { ...usage, [href]: { score: (usage[href] ? decayedScore(usage[href], now) : 0) + 1, updatedAt: now } };
}

// Older versions stored plain visit counts; treat them as if they happened just now.
function normalizeUsage(raw: Record<string, number | UsageEntry>): Record<string, UsageEntry> {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(raw).map(([href, value]) => [
      href,
      typeof value === 'number' ? { score: value, updatedAt: now } : value,
    ])
  );
}

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

const navigationGroups: NavigationGroup[] = [
  {
    id: 'core',
    theme: 'emerald',
    name: 'Core Operations',
    icon: Zap,
    defaultExpanded: false,
    items: [
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Goals', href: '/admin/goals', icon: Target },
      { name: 'Inquiries', href: '/admin/inquiries', icon: Inbox },
      { name: 'Jobs', href: '/admin/jobs', icon: Briefcase },
      { name: 'Bookings', href: '/admin/bookings', icon: CalendarCheck },
      { name: 'Contractors', href: '/admin/contractors', icon: HardHat },
      { name: 'Completions', href: '/admin/completions', icon: CheckCircle2 },
      { name: 'Reminders', href: '/admin/reminders', icon: Calendar },
    ],
  },
  {
    id: 'financial',
    theme: 'blue',
    name: 'Financial Management',
    icon: DollarSign,
    defaultExpanded: false,
    items: [
      { name: 'Invoices', href: '/admin/invoices', icon: FileText },
      { name: 'Burn Rate', href: '/admin/burn-rate', icon: Flame },
      { name: 'Forecasting', href: '/admin/forecasting', icon: TrendingUp },
      { name: 'Grants', href: '/admin/grants', icon: HandCoins },
      { name: 'Gift Cards', href: '/admin/gift-cards', icon: Gift },
      { name: 'Coupons', href: '/admin/coupons', icon: Ticket },
      { name: 'Tax Settings', href: '/admin/tax-settings', icon: Receipt },
      { name: 'Mileage Settings', href: '/admin/mileage-settings', icon: Navigation },
      { name: 'Invoice Settings', href: '/admin/invoice-settings', icon: Settings },
    ],
  },
  {
    id: 'business',
    theme: 'violet',
    name: 'Business Profile',
    icon: Building,
    defaultExpanded: false,
    items: [
      { name: 'Business Info', href: '/admin/business-info', icon: Building2 },
      { name: 'Services', href: '/admin/services', icon: Briefcase },
      { name: 'Service Areas', href: '/admin/service-areas', icon: MapPin },
      { name: 'Business Hours', href: '/admin/business-hours', icon: Clock },
      { name: 'Booking Availability', href: '/admin/booking-availability', icon: CalendarClock },
      { name: 'Payment Methods', href: '/admin/payment-methods', icon: CreditCard },
      { name: 'Gallery', href: '/admin/gallery', icon: Image },
    ],
  },
  {
    id: 'store',
    theme: 'orange',
    name: 'Print Shop',
    icon: ShoppingBag,
    defaultExpanded: false,
    items: [
      { name: 'Store Products', href: '/admin/store', icon: Boxes },
      { name: 'Store Orders', href: '/admin/store-orders', icon: ShoppingBag },
      { name: 'Model Studio', href: '/admin/model-studio', icon: Wand2 },
    ],
  },
  {
    id: 'marketing',
    theme: 'rose',
    name: 'Marketing & Engagement',
    icon: TrendingUpIcon,
    defaultExpanded: false,
    items: [
      { name: 'Customers', href: '/admin/clients', icon: Users },
      { name: 'Reviews', href: '/admin/reviews', icon: Star },
      { name: 'News Feed', href: '/admin/news', icon: Newspaper },
      { name: 'Sales Subscribers', href: '/admin/sales-subscribers', icon: Mail },
      { name: 'Competitor Watch', href: '/admin/competitors', icon: Binoculars },
      { name: 'QR Codes', href: '/admin/qr-codes', icon: QrCode },
      { name: 'Social Media', href: '/admin/social-media', icon: Share2 },
      { name: 'Social Metrics', href: '/admin/social-metrics', icon: Activity },
      { name: 'YouTube Stats', href: '/admin/youtube-stats', icon: Youtube },
      { name: 'Social Comments', href: '/admin/social-comments', icon: MessageCircle },
      { name: 'Direct Messages', href: '/admin/social-messages', icon: Send },
      { name: 'UTM Link Builder', href: '/admin/utm-link-builder', icon: LinkIcon },
      { name: 'Notification Bar', href: '/admin/notification-bar', icon: Megaphone },
      { name: 'SMS Opt-In', href: '/admin/sms-opt-in', icon: MessageCircle },
      { name: 'SMS Consent Log', href: '/admin/sms-consent-log', icon: ScrollText },
    ],
  },
  {
    id: 'system',
    theme: 'slate',
    name: 'System & Tools',
    icon: Wrench,
    defaultExpanded: false,
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Scheduled Emails', href: '/admin/scheduled-emails', icon: CalendarClock },
      { name: 'Email Activity', href: '/admin/email-activity', icon: Mail },
      { name: 'Activity Logs', href: '/admin/activity-logs', icon: ScrollText },
      { name: 'Changelog', href: '/admin/changelog', icon: History, ownerOnly: true },
      { name: 'API Keys', href: '/admin/api-keys', icon: KeyRound },
      { name: 'Security', href: '/admin/security', icon: ShieldCheck },
      { name: 'Connections', href: '/admin/connections', icon: Plug },
      { name: 'Claude Usage', href: '/admin/claude-usage', icon: DollarSign },
      { name: 'Attributes', href: '/admin/attributes', icon: Settings },
      { name: 'Branding', href: '/admin/branding', icon: Palette },
      { name: 'Test Identifiers', href: '/admin/test-identifiers', icon: FlaskConical },
    ],
  },
  {
    id: 'client-admin',
    theme: 'cyan',
    name: 'Customer Admin',
    icon: Users,
    defaultExpanded: false,
    items: [
      { name: 'Documents', href: '/admin/documents', icon: FolderOpen },
      { name: 'Account Link Review', href: '/admin/account-link-review', icon: Search },
      { name: 'Support Queue', href: '/admin/support', icon: MessageSquare },
      { name: 'Portal Adoption', href: '/admin/portal-adoption', icon: Users },
    ],
  },
];

function AdminLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    return stored === 'true';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { user, signOut, currentRole } = useAuth();
  const visibleGroups = useMemo(
    () =>
      navigationGroups.map(group => ({
        ...group,
        items: group.items.filter(item => !item.ownerOnly || currentRole === 'owner'),
      })),
    [currentRole]
  );
  const visibleNavigation = useMemo(
    () => visibleGroups.flatMap(group => group.items.map(item => ({ ...item, category: group.name }))),
    [visibleGroups]
  );
  const location = useLocation();
  const { unviewedCount } = useRealtimeInquiries({
    businessId,
    enableNotifications: true
  });
  const unrepliedCommentCount = useSocialCommentsBadge();
  const needsReplyMessageCount = useSocialMessagesBadge();
  const newsDraftCount = useNewsDraftsBadge();

  const [favorites, setFavorites] = useState<string[]>(() => readStoredJson<string[]>('admin-nav-favorites', []));
  const [usage, setUsage] = useState<Record<string, UsageEntry>>(() =>
    normalizeUsage(readStoredJson<Record<string, number | UsageEntry>>('admin-nav-usage', {}))
  );
  // Auto-pinned pages the user has manually removed from Quick Access.
  const [dismissed, setDismissed] = useState<string[]>(() => readStoredJson<string[]>('admin-nav-dismissed', []));

  const navLookup = useMemo(() => {
    const map = new Map<string, { item: NavigationItem; theme: GroupTheme }>();
    visibleGroups.forEach(group =>
      group.items.forEach(item => map.set(item.href, { item, theme: groupThemes[group.theme] }))
    );
    return map;
  }, [visibleGroups]);

  // Scores are ranked as of page load; they refresh on the next load.
  const [loadedAt] = useState(() => Date.now());

  const quickAccessHrefs = useMemo(() => {
    const starred = favorites.filter(href => navLookup.has(href));
    const auto = Object.entries(usage)
      .map(([href, entry]) => [href, decayedScore(entry, loadedAt)] as const)
      .filter(([href, score]) => navLookup.has(href) && !starred.includes(href) && !dismissed.includes(href) && score >= QUICK_ACCESS_MIN_SCORE)
      .sort((a, b) => b[1] - a[1])
      .map(([href]) => href);
    return [...starred, ...auto].slice(0, Math.max(QUICK_ACCESS_LIMIT, starred.length));
  }, [favorites, usage, dismissed, navLookup, loadedAt]);

  // Star toggles a manual pin. On an auto-pinned page it removes it from Quick Access instead.
  const toggleFavorite = (href: string) => {
    if (favorites.includes(href)) {
      setFavorites(prev => prev.filter(h => h !== href));
    } else if (quickAccessHrefs.includes(href)) {
      setDismissed(prev => [...prev, href]);
    } else {
      setFavorites(prev => [...prev, href]);
      setDismissed(prev => prev.filter(h => h !== href));
    }
  };

  useEffect(() => {
    localStorage.setItem('admin-nav-dismissed', JSON.stringify(dismissed));
  }, [dismissed]);

  useEffect(() => {
    localStorage.setItem('admin-nav-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('admin-nav-usage', JSON.stringify(usage));
  }, [usage]);

  const recordVisit = (href: string) => {
    setUsage(prev => addVisit(prev, href));
  };

  const getInitialExpandedState = (): Record<string, boolean> => {
    const stored = localStorage.getItem('admin-nav-expanded-v2');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    // No saved choice yet: groups stay closed unless they hold the current page.
    return {};
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(getInitialExpandedState);

  useEffect(() => {
    localStorage.setItem('admin-nav-expanded-v2', JSON.stringify(expandedCategories));
  }, [expandedCategories]);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const isGroupActive = (groupId: string) =>
    !!visibleGroups.find(group => group.id === groupId)?.items.some(item => item.href === location.pathname);

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
        [categoryId]: !(prev[categoryId] ?? isGroupActive(categoryId))
      }));
    }
  };

  const expandAll = () => {
    const allExpanded = visibleGroups.reduce((acc, group) => {
      acc[group.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedCategories(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = visibleGroups.reduce((acc, group) => {
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

  const renderNavItem = (item: NavigationItem, theme: GroupTheme) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.href;
    const isFavorite = favorites.includes(item.href);
    const isAutoPinned = !isFavorite && quickAccessHrefs.includes(item.href);
    const badgeCount =
      item.name === 'Inquiries'
        ? unviewedCount
        : item.name === 'Social Comments'
        ? unrepliedCommentCount
        : item.name === 'Direct Messages'
        ? needsReplyMessageCount
        : item.name === 'News Feed'
        ? newsDraftCount
        : 0;
    const showBadge = badgeCount > 0;

    return (
      <li
        key={item.href}
        className={`group/item flex items-center rounded-md border transition-colors ${
          isActive
            ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
        }`}
      >
        <Link
          to={item.href}
          onClick={() => {
            recordVisit(item.href);
            setSidebarOpen(false);
          }}
          aria-current={isActive ? 'page' : undefined}
          className="flex flex-1 min-w-0 items-center gap-2 pl-1.5 pr-1 py-1"
        >
          <span className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-600 text-white' : theme.badge}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
          {showBadge && (
            <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full min-w-[20px]">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(item.href)}
          aria-label={
            isFavorite
              ? `Unpin ${item.name}`
              : isAutoPinned
              ? `Remove ${item.name} from Quick Access`
              : `Pin ${item.name} to Quick Access`
          }
          aria-pressed={isFavorite}
          title={isFavorite ? 'Unpin' : isAutoPinned ? 'Remove from Quick Access' : 'Pin to Quick Access'}
          className={`flex-shrink-0 mr-1 p-1 rounded transition-opacity focus:opacity-100 ${
            isFavorite
              ? 'opacity-100 text-amber-500'
              : isAutoPinned
              ? 'opacity-60 hover:opacity-100 text-amber-500'
              : 'opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-amber-500'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : isAutoPinned ? 'fill-amber-100' : ''}`} />
        </button>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        navigation={visibleNavigation}
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

          {/* Expand/Collapse All — sticky, outside scroll area */}
          {!sidebarCollapsed && (
            <div className="flex gap-2 px-4 py-2 border-b border-slate-200 bg-white shrink-0">
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
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {/* Navigation Groups */}
            <div className="space-y-3">
              {!sidebarCollapsed && (
                <div>
                  <div className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg ${groupThemes.amber.header}`}>
                    <Star className="w-4 h-4 flex-shrink-0 fill-current" />
                    <span>Quick Access</span>
                  </div>
                  {quickAccessHrefs.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {quickAccessHrefs.map(href => {
                        const entry = navLookup.get(href);
                        return entry ? renderNavItem(entry.item, entry.theme) : null;
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 px-3 text-xs text-slate-500">
                      Star a page, or keep using the menu, and your most-used pages will show up here.
                    </p>
                  )}
                </div>
              )}
              {visibleGroups.map((group, groupIndex) => {
                const theme = groupThemes[group.theme];
                const isExpanded = expandedCategories[group.id] ?? group.items.some(item => item.href === location.pathname);
                const GroupIcon = group.icon;
                const hasActiveItem = group.items.some(item => location.pathname === item.href);

                return (
                  <div
                    key={group.id}
                    className={`group relative ${groupIndex > 0 ? 'border-t border-slate-100 pt-3' : ''}`}
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(group.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors relative group ${
                        sidebarCollapsed ? 'lg:justify-center' : ''
                      } ${
                        hasActiveItem
                          ? `${theme.header} ${theme.headerActive}`
                          : theme.header
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
                      <ul className="mt-1.5 space-y-1">
                        {group.items.map(item => renderNavItem(item, theme))}
                      </ul>
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
              className={`hidden lg:flex w-full items-center gap-3 rounded-lg transition-colors px-4 py-2 text-slate-500 hover:bg-slate-50 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-4 h-4 flex-shrink-0" />
              <span className={`text-sm font-normal transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>

            {/* User info - hidden when collapsed */}
            <div className={`px-4 py-1.5 bg-slate-50 rounded-lg transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-xs text-slate-400 mb-0.5">Signed in as</p>
              <p className="text-xs text-slate-500 truncate">
                {user?.email}
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className={`w-full flex items-center gap-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors relative group ${
                sidebarCollapsed ? 'lg:justify-center lg:px-0 lg:py-2' : 'px-4 py-2'
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className={`text-sm font-normal transition-opacity duration-200 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Sign Out</span>

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

            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 ml-auto">
              <PrivacyModeToggleButton />
              <NotificationBell />
              <Link
                to="/admin/inquiries"
                className="group relative p-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Inbox className="w-5 h-5" />
                {unviewedCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
                    {unviewedCount > 99 ? '99+' : unviewedCount}
                  </span>
                )}
                <span className="pointer-events-none hidden lg:block absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  View Inquiries
                </span>
              </Link>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 whitespace-nowrap p-2 sm:p-0 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                aria-label="View website"
              >
                <span className="hidden sm:inline">View Website →</span>
                <ExternalLink className="w-5 h-5 sm:hidden" aria-hidden="true" />
              </a>
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

function PrivacyModeToggleButton() {
  const { privacyModeEnabled, togglePrivacyMode } = usePrivacyMode();

  return (
    <button
      onClick={togglePrivacyMode}
      className={`group relative p-2 rounded-lg transition-colors ${
        privacyModeEnabled
          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
          : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50'
      }`}
      aria-label={privacyModeEnabled ? 'Disable privacy mode' : 'Enable privacy mode'}
    >
      {privacyModeEnabled ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      <span className="pointer-events-none hidden lg:block absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {privacyModeEnabled ? 'Privacy Mode On' : 'Privacy Mode Off'}
      </span>
    </button>
  );
}

export default function AdminLayout() {
  return (
    <PrivacyModeProvider>
      <AdminLayoutContent />
    </PrivacyModeProvider>
  );
}
