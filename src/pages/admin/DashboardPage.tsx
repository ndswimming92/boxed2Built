import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useRealtimeJobs } from '../../hooks/useRealtimeJobs';
import { getRecentInquiries, getInquiryStats } from '../../services/inquiryService';
import { getGoalStats, getUpcomingGoals } from '../../services/goalsService';
import { getReferralStats } from '../../services/clientService';
import { calculateClientTimeSaved } from '../../services/analyticsService';
import type { Goal } from '../../lib/supabase';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Briefcase,
  MapPin,
  Star,
  TrendingUp,
  Clock,
  BarChart3,
  ArrowRight,
  Inbox,
  Mail,
  MessageSquare,
  AlertCircle,
  Target,
  Gift,
  Users,
  DollarSign,
  Bell,
  Phone,
  Calendar,
} from 'lucide-react';

interface Stats {
  services: number;
  serviceAreas: number;
  reviews: number;
  avgRating: number;
  paymentMethods: number;
  socialMedia: number;
  jobs: number;
  totalRevenue: number;
  totalHoursSaved: number;
  inquiries: number;
  pendingInquiries: number;
  conversionRate: number;
  remindersDueToday: number;
  remindersOverdue: number;
}

interface DashboardReminder {
  id: string;
  scheduled_date: string;
  reminder_type: string;
  admin_notes: string | null;
  job: {
    client_name: string;
    client_phone: string;
    job_type: string;
  } | null;
}

export default function DashboardPage() {
  const { maskFinancialValue } = usePrivacyMode();
  const { currentOrganization } = useAuth();
  const [referralStats, setReferralStats] = useState<{
    totalCodes: number;
    totalReferrals: number;
    creditsIssuedAllTime: number;
    creditsRedeemedAllTime: number;
  } | null>(null);
  const [stats, setStats] = useState<Stats>({
    services: 0,
    serviceAreas: 0,
    reviews: 0,
    avgRating: 0,
    paymentMethods: 0,
    socialMedia: 0,
    jobs: 0,
    totalRevenue: 0,
    totalHoursSaved: 0,
    inquiries: 0,
    pendingInquiries: 0,
    conversionRate: 0,
    remindersDueToday: 0,
    remindersOverdue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [goalStats, setGoalStats] = useState({ totalGoals: 0, completedGoals: 0, overdueGoals: 0, completionRate: 0 });
  const [upcomingGoals, setUpcomingGoals] = useState<Goal[]>([]);
  const [pendingReminders, setPendingReminders] = useState<DashboardReminder[]>([]);
  const { jobs: realtimeJobs } = useRealtimeJobs(businessId);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (currentOrganization?.id) {
      getReferralStats(currentOrganization.id)
        .then(setReferralStats)
        .catch(() => {});
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (realtimeJobs.length > 0 && businessId) {
      updateRevenueFromJobs();
    }
  }, [realtimeJobs, businessId]);

  const updateRevenueFromJobs = () => {
    const completedJobs = realtimeJobs.filter(job => job.date_completed);
    const totalRevenue = completedJobs.reduce((sum, job) => sum + (Number(job.final_price) || 0), 0);
    const clientTimeSaved = calculateClientTimeSaved(completedJobs.map(job => job.hours_worked));

    setStats(prev => ({
      ...prev,
      jobs: realtimeJobs.length,
      totalRevenue,
      totalHoursSaved: clientTimeSaved.rawHours,
    }));
  };

  const fetchStats = async () => {
    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id, name')
        .eq('is_active', true)
        .maybeSingle();

      if (businessInfo) {
        setBusinessName(businessInfo.name);
        setBusinessId(businessInfo.id);
      }

      if (!businessInfo) {
        setLoading(false);
        return;
      }

      const [
        { count: servicesCount },
        { count: serviceAreasCount },
        { data: reviewsData },
        { count: paymentMethodsCount },
        { count: socialMediaCount },
        { count: jobsCount },
        { data: jobsData },
        inquiryStats,
        recentInquiriesData,
        goalStatsData,
        upcomingGoalsData,
        { data: remindersData }
      ] = await Promise.all([
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('service_areas').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customer_reviews').select('rating_value').eq('is_active', true),
        supabase.from('payment_methods').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('social_media').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('business_id', businessInfo.id).eq('is_active', true),
        supabase.from('jobs').select('final_price, date_completed, hours_worked').eq('business_id', businessInfo.id).eq('is_active', true).not('date_completed', 'is', null),
        getInquiryStats(businessInfo.id),
        getRecentInquiries(businessInfo.id, 5),
        getGoalStats(businessInfo.id),
        getUpcomingGoals(businessInfo.id, 3),
        supabase.from('job_completion_reminders').select('id, scheduled_date, reminder_type, admin_notes, job:jobs!job_id(client_name, client_phone, job_type)').eq('status', 'pending').order('scheduled_date', { ascending: true })
      ]);

      setRecentInquiries(recentInquiriesData);
      setGoalStats(goalStatsData);
      setUpcomingGoals(upcomingGoalsData);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reminders = (remindersData || []) as DashboardReminder[];
      let dueToday = 0;
      let overdue = 0;
      for (const r of reminders) {
        const d = new Date(r.scheduled_date);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) dueToday++;
        else if (d < today) overdue++;
      }
      setPendingReminders(reminders.slice(0, 5));

      const avgRating = reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum, r) => sum + r.rating_value, 0) / reviewsData.length
        : 0;

      const totalRevenue = jobsData && jobsData.length > 0
        ? jobsData.reduce((sum, job) => sum + (Number(job.final_price) || 0), 0)
        : 0;

      const clientTimeSaved = calculateClientTimeSaved((jobsData || []).map(job => job.hours_worked));

      setStats({
        services: servicesCount || 0,
        serviceAreas: serviceAreasCount || 0,
        reviews: reviewsData?.length || 0,
        avgRating: Math.round(avgRating * 10) / 10,
        paymentMethods: paymentMethodsCount || 0,
        socialMedia: socialMediaCount || 0,
        jobs: jobsCount || 0,
        totalRevenue,
        totalHoursSaved: clientTimeSaved.rawHours,
        inquiries: inquiryStats.total,
        pendingInquiries: inquiryStats.pending,
        conversionRate: inquiryStats.conversionRate,
        remindersDueToday: dueToday,
        remindersOverdue: overdue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const clientTimeSaved = calculateClientTimeSaved([stats.totalHoursSaved]);

  const statCards = [
    {
      name: 'Total Jobs',
      value: stats.jobs,
      icon: Briefcase,
      link: '/admin/jobs',
      color: 'bg-blue-500'
    },
    {
      name: 'Total Revenue',
      value: maskFinancialValue(formatCurrency(stats.totalRevenue)),
      icon: TrendingUp,
      link: '/admin/jobs',
      color: 'bg-emerald-500'
    },
    {
      name: clientTimeSaved.title,
      value: clientTimeSaved.label,
      subtitle: clientTimeSaved.subtitle,
      icon: Clock,
      link: '/admin/analytics',
      color: 'bg-violet-500'
    },
    {
      name: 'Services',
      value: stats.services,
      icon: Briefcase,
      link: '/admin/services',
      color: 'bg-indigo-500'
    },
    {
      name: 'Service Areas',
      value: stats.serviceAreas,
      icon: MapPin,
      link: '/admin/service-areas',
      color: 'bg-teal-500'
    },
    {
      name: 'Reviews',
      value: stats.reviews,
      icon: Star,
      link: '/admin/reviews',
      color: 'bg-amber-500'
    },
    {
      name: 'Avg Rating',
      value: stats.avgRating > 0 ? `${stats.avgRating}/5` : 'N/A',
      icon: Star,
      link: '/admin/reviews',
      color: 'bg-yellow-500'
    },
    {
      name: 'Pending Inquiries',
      value: stats.pendingInquiries,
      icon: AlertCircle,
      link: '/admin/inquiries',
      color: 'bg-orange-500',
      highlight: stats.pendingInquiries > 0
    },
    {
      name: 'Reminders Due',
      value: stats.remindersDueToday + stats.remindersOverdue,
      subtitle: stats.remindersOverdue > 0 ? `${stats.remindersOverdue} overdue` : undefined,
      icon: Bell,
      link: '/admin/reminders',
      color: 'bg-rose-500',
      highlight: (stats.remindersDueToday + stats.remindersOverdue) > 0
    },
    {
      name: 'Total Inquiries',
      value: stats.inquiries,
      icon: Inbox,
      link: '/admin/inquiries',
      color: 'bg-cyan-500'
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
          Welcome back!
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          {businessName ? `Managing ${businessName}` : 'Manage your business content'}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 md:p-6 border border-slate-200 animate-pulse">
              <div className="h-8 w-8 md:h-12 md:w-12 bg-slate-200 rounded-lg mb-2 md:mb-4"></div>
              <div className="h-3 md:h-4 bg-slate-200 rounded w-20 mb-1 md:mb-2"></div>
              <div className="h-5 md:h-8 bg-slate-200 rounded w-12 md:w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isHighlighted = 'highlight' in card && card.highlight;
            return (
              <Link
                key={card.name}
                to={card.link}
                className={`bg-white rounded-xl p-3 md:p-6 border transition-all group ${
                  isHighlighted
                    ? 'border-orange-300 shadow-md hover:shadow-lg'
                    : 'border-slate-200 hover:shadow-lg hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2 md:mb-4">
                  <div className={`p-2 md:p-3 ${card.color} rounded-lg`}>
                    <Icon className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  {isHighlighted && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 leading-tight">
                      Action
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-600 mb-0.5 md:mb-1">{card.name}</p>
                <p className="text-xl md:text-3xl font-bold text-slate-900">{card.value}</p>
                {'subtitle' in card && card.subtitle && (
                  <p className="text-xs text-slate-500 mt-1 md:mt-2">{card.subtitle}</p>
                )}
                <p className="text-xs md:text-sm text-emerald-600 mt-1 md:mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage →
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && referralStats && (
        <div className="mt-8">
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl p-6 border border-blue-800">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-blue-200" />
                <h2 className="text-base font-semibold text-white">Referral Program</h2>
              </div>
              <Link
                to="/admin/clients?segment=referrals"
                className="text-xs font-medium text-blue-200 hover:text-white flex items-center gap-1 transition-colors"
              >
                View Referrals
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Gift className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-2xl font-bold text-white">{referralStats.totalCodes}</p>
                <p className="text-xs text-blue-200 mt-1">Active Codes</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-2xl font-bold text-white">{referralStats.totalReferrals}</p>
                <p className="text-xs text-blue-200 mt-1">Total Referrals</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-2xl font-bold text-white">{maskFinancialValue(`$${referralStats.creditsIssuedAllTime.toFixed(0)}`)}</p>
                <p className="text-xs text-blue-200 mt-1">Credits Issued</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-2xl font-bold text-white">{maskFinancialValue(`$${referralStats.creditsRedeemedAllTime.toFixed(0)}`)}</p>
                <p className="text-xs text-blue-200 mt-1">Credits Redeemed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && pendingReminders.length > 0 && (
        <div className="mt-12">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-rose-500" />
                Follow-up Reminders
              </h2>
              <Link
                to="/admin/reminders"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex items-center gap-3 mb-5">
              {stats.remindersOverdue > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {stats.remindersOverdue} Overdue
                </span>
              )}
              {stats.remindersDueToday > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                  <Clock className="w-3.5 h-3.5" />
                  {stats.remindersDueToday} Due Today
                </span>
              )}
              {pendingReminders.length - stats.remindersOverdue - stats.remindersDueToday > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
                  <Calendar className="w-3.5 h-3.5" />
                  {pendingReminders.length - stats.remindersOverdue - stats.remindersDueToday} Upcoming
                </span>
              )}
            </div>

            <div className="space-y-3">
              {pendingReminders.map((reminder) => {
                const scheduledDate = new Date(reminder.scheduled_date);
                scheduledDate.setHours(0, 0, 0, 0);
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const isOverdue = scheduledDate < todayDate;
                const isDueToday = scheduledDate.getTime() === todayDate.getTime();

                const getReminderTypeLabel = (type: string) => {
                  switch (type) {
                    case 'follow_up_call': return 'Follow-up Call';
                    case 'warranty_check': return 'Warranty Check';
                    case 'repeat_business': return 'Repeat Business';
                    case 'custom': return 'Custom';
                    default: return type;
                  }
                };

                const getReminderTypeColor = (type: string) => {
                  switch (type) {
                    case 'follow_up_call': return 'bg-blue-100 text-blue-800 border-blue-200';
                    case 'warranty_check': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    case 'repeat_business': return 'bg-teal-100 text-teal-800 border-teal-200';
                    case 'custom': return 'bg-slate-100 text-slate-800 border-slate-200';
                    default: return 'bg-slate-100 text-slate-800 border-slate-200';
                  }
                };

                return (
                  <Link
                    key={reminder.id}
                    to="/admin/reminders"
                    className={`block px-4 py-3 rounded-lg border transition-all hover:shadow-md ${
                      isOverdue
                        ? 'bg-red-50 border-red-200'
                        : isDueToday
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isOverdue && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-600 text-white">
                              OVERDUE
                            </span>
                          )}
                          {isDueToday && !isOverdue && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-600 text-white">
                              TODAY
                            </span>
                          )}
                          <p className="font-semibold text-slate-900 truncate">
                            {reminder.job?.client_name || 'Unknown Client'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600 mb-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {reminder.job?.client_phone && (
                            <>
                              <span className="text-slate-400">|</span>
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {reminder.job.client_phone}
                              </span>
                            </>
                          )}
                        </div>
                        {reminder.admin_notes && (
                          <p className="text-xs text-slate-500 truncate">{reminder.admin_notes}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getReminderTypeColor(reminder.reminder_type)}`}>
                        {getReminderTypeLabel(reminder.reminder_type)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && recentInquiries.length > 0 && (
        <div className="mt-12">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                Recent Inquiries
              </h2>
              <Link
                to="/admin/inquiries"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentInquiries.map((inquiry) => {
                const formatDate = (dateString: string) => {
                  const date = new Date(dateString);
                  const now = new Date();
                  const diffInMs = now.getTime() - date.getTime();
                  const diffInHours = diffInMs / (1000 * 60 * 60);

                  if (diffInHours < 24) {
                    const hours = Math.floor(diffInHours);
                    if (hours < 1) {
                      const minutes = Math.floor(diffInMs / (1000 * 60));
                      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
                    }
                    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
                  }

                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
                  });
                };

                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'pending':
                      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    case 'converted_to_job':
                      return 'bg-green-100 text-green-800 border-green-200';
                    case 'archived':
                      return 'bg-gray-100 text-gray-800 border-gray-200';
                    default:
                      return 'bg-gray-100 text-gray-800 border-gray-200';
                  }
                };

                const getStatusLabel = (status: string) => {
                  switch (status) {
                    case 'pending':
                      return 'Pending';
                    case 'converted_to_job':
                      return 'Converted';
                    case 'archived':
                      return 'Archived';
                    default:
                      return status;
                  }
                };

                return (
                  <Link
                    key={inquiry.id}
                    to="/admin/inquiries"
                    className={`block px-4 py-3 rounded-lg border transition-all hover:shadow-md ${
                      !inquiry.viewed ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!inquiry.viewed && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                              NEW
                            </span>
                          )}
                          <p className="font-semibold text-slate-900 truncate">{inquiry.client_name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {inquiry.client_email}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span>{formatDate(inquiry.submission_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-700">{inquiry.furniture_type}</span>
                          {inquiry.pieces && (
                            <>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600">{inquiry.pieces} {inquiry.pieces === 1 ? 'piece' : 'pieces'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getStatusColor(inquiry.status)}`}>
                          {getStatusLabel(inquiry.status)}
                        </span>
                        {inquiry.estimated_price && (
                          <span className="text-sm font-semibold text-emerald-600">{maskFinancialValue(inquiry.estimated_price)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && upcomingGoals.length > 0 && (
        <div className="mt-12">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                Active Goals
              </h2>
              <Link
                to="/admin/goals"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Total Goals</p>
                <p className="text-2xl font-bold text-slate-900">{goalStats.totalGoals}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-700 mb-1">Completed</p>
                <p className="text-2xl font-bold text-emerald-900">{goalStats.completedGoals}</p>
                <p className="text-xs text-emerald-600 mt-1">{goalStats.completionRate}% rate</p>
              </div>
              {goalStats.overdueGoals > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 mb-1">Overdue</p>
                  <p className="text-2xl font-bold text-red-900">{goalStats.overdueGoals}</p>
                  <p className="text-xs text-red-600 mt-1">Need attention</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {upcomingGoals.map((goal) => {
                const getPriorityColor = (priority: string) => {
                  switch (priority) {
                    case 'high': return 'bg-red-100 text-red-800';
                    case 'medium': return 'bg-yellow-100 text-yellow-800';
                    case 'low': return 'bg-green-100 text-green-800';
                    default: return 'bg-slate-100 text-slate-800';
                  }
                };

                const getDaysRemaining = (dueDate: string | null) => {
                  if (!dueDate) return null;
                  const today = new Date();
                  const due = new Date(dueDate);
                  const diffTime = due.getTime() - today.getTime();
                  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                };

                const daysRemaining = getDaysRemaining(goal.due_date);

                return (
                  <div
                    key={goal.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{goal.title}</h3>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getPriorityColor(goal.priority)}`}>
                            {goal.priority.toUpperCase()}
                          </span>
                        </div>
                        {goal.due_date && (
                          <p className="text-sm text-slate-600">
                            Due {new Date(goal.due_date).toLocaleDateString()}
                            {daysRemaining !== null && daysRemaining >= 0 && (
                              <span className={daysRemaining <= 7 ? 'text-red-600 font-medium ml-1' : 'ml-1'}>
                                ({daysRemaining} days left)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {Math.round(goal.progress_percentage)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          goal.progress_percentage >= 75 ? 'bg-emerald-500' :
                          goal.progress_percentage >= 50 ? 'bg-blue-500' :
                          goal.progress_percentage >= 25 ? 'bg-yellow-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              to="/admin/jobs"
              className="block px-4 py-3 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <p className="font-medium text-slate-900">Add New Job</p>
              <p className="text-sm text-slate-600">Track completed jobs and revenue</p>
            </Link>
            <Link
              to="/admin/business-info"
              className="block px-4 py-3 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <p className="font-medium text-slate-900">Edit Business Information</p>
              <p className="text-sm text-slate-600">Update contact details and description</p>
            </Link>
            <Link
              to="/admin/services"
              className="block px-4 py-3 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <p className="font-medium text-slate-900">Manage Services</p>
              <p className="text-sm text-slate-600">Add, edit, or remove services</p>
            </Link>
            <Link
              to="/admin/reviews"
              className="block px-4 py-3 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <p className="font-medium text-slate-900">Manage Reviews</p>
              <p className="text-sm text-slate-600">Add or update customer reviews</p>
            </Link>
            <Link
              to="/admin/analytics"
              className="block px-4 py-3 bg-gradient-to-r from-emerald-50 to-blue-50 hover:from-emerald-100 hover:to-blue-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-emerald-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    View Analytics Dashboard
                  </p>
                  <p className="text-sm text-emerald-700">Charts, graphs, and detailed insights</p>
                </div>
                <ArrowRight className="w-5 h-5 text-emerald-600" />
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Tips
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-slate-900 mb-1">Keep Information Current</p>
              <p className="text-sm text-slate-600">
                Regularly update your services and pricing to ensure customers have accurate information.
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900 mb-1">Showcase Reviews</p>
              <p className="text-sm text-slate-600">
                Feature your best customer reviews to build trust with potential clients.
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900 mb-1">Expand Service Areas</p>
              <p className="text-sm text-slate-600">
                Add new service areas as you grow your business coverage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
