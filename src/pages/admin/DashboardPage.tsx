import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRealtimeJobs } from '../../hooks/useRealtimeJobs';
import { useDashboardData } from '../../hooks/useDashboardData';
import { calculateClientTimeSaved, parseJobDate } from '../../services/analyticsCalculations';
import { buildMonthlyTrend, summarizeMonthToDate } from '../../utils/dashboardTrends';
import NextJobBanner from '../../components/admin/NextJobBanner';
import AttentionStrip, { type AttentionItem } from '../../components/admin/dashboard/AttentionStrip';
import InquiryPipelineCard from '../../components/admin/dashboard/InquiryPipelineCard';
import KpiCard from '../../components/admin/dashboard/KpiCard';
import Panel from '../../components/admin/dashboard/Panel';
import TrendCharts from '../../components/admin/dashboard/TrendCharts';
import { findNextJob } from '../../utils/nextJob';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Gift,
  Inbox,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Star,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatHours = (hours: number) => `${hours.toFixed(1)} hrs`;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden="true">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
          <div className="mb-3 h-8 w-20 rounded bg-slate-200" />
          <div className="h-3 w-28 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { maskFinancialValue, privacyModeEnabled } = usePrivacyMode();
  const { currentOrganization } = useAuth();
  const {
    business,
    data,
    scheduledEmails,
    referralStats,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = useDashboardData(currentOrganization?.id);
  const {
    jobs,
    loading: jobsLoading,
    lastUpdated: jobsUpdated,
    isConnected,
  } = useRealtimeJobs(business?.id ?? null);

  const nextJob = findNextJob(jobs);

  const jobTotals = useMemo(() => {
    const completed = jobs.filter(job => job.date_completed);
    return {
      total: jobs.length,
      completed: completed.length,
      revenue: completed.reduce((sum, job) => sum + (Number(job.final_price) || 0), 0),
      timeSaved: calculateClientTimeSaved(completed.map(job => job.hours_worked)),
      trend: buildMonthlyTrend(jobs),
      monthToDate: summarizeMonthToDate(jobs),
    };
  }, [jobs]);

  const updatedAt = [lastUpdated, jobsUpdated]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const blockedEmails = scheduledEmails.filter(e => e.status === 'blocked').length;
  const dueEmails = scheduledEmails.filter(e => e.status === 'due').length;
  const upcomingEmails = scheduledEmails.filter(e => e.status === 'scheduled').length;
  const emailsToShow = scheduledEmails.filter(e => e.status === 'due' || e.status === 'scheduled').slice(0, 5);

  const attentionItems: AttentionItem[] = data
    ? [
        {
          key: 'inquiries',
          icon: Inbox,
          count: data.inquiries.pending,
          label: `${plural(data.inquiries.pending, 'inquiry', 'inquiries')} pending`,
          to: '/admin/inquiries',
        },
        {
          key: 'reminders',
          icon: Bell,
          count: data.reminders.overdue + data.reminders.dueToday,
          label: `follow-up ${plural(data.reminders.overdue + data.reminders.dueToday, 'reminder', 'reminders')} due`,
          note: data.reminders.overdue > 0 ? `${data.reminders.overdue} overdue` : 'Due today',
          to: '/admin/reminders',
          urgent: data.reminders.overdue > 0,
        },
        {
          key: 'goals',
          icon: Target,
          count: data.goalStats.overdueGoals,
          label: `${plural(data.goalStats.overdueGoals, 'goal', 'goals')} overdue`,
          to: '/admin/goals',
          urgent: true,
        },
        {
          key: 'emails',
          icon: Mail,
          count: blockedEmails,
          label: `scheduled ${plural(blockedEmails, 'email', 'emails')} blocked`,
          note: 'Will not send until fixed',
          to: '/admin/scheduled-emails',
          urgent: true,
        },
      ]
    : [];

  const { monthToDate } = jobTotals;
  const showSkeleton = loading || (jobsLoading && business !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Welcome back!</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            {business?.name ? `Managing ${business.name}` : 'Manage your business content'}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex items-center gap-2 text-xs text-slate-600" aria-live="polite">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {isConnected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </span>
            <span>
              {isConnected ? 'Live' : 'Auto-refreshing'}
              {updatedAt && ` · updated ${updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh dashboard"
              title="Refresh now"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
            <Link
              to="/admin/jobs"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add job
            </Link>
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Analytics
            </Link>
            <Link
              to="/admin/business-info"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Business info
            </Link>
          </nav>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span className="flex-1">
            {data
              ? 'Could not refresh the dashboard, so these numbers may be out of date.'
              : 'Could not load the dashboard.'}
          </span>
          <button type="button" onClick={refresh} className="font-semibold underline underline-offset-2 hover:text-red-700">
            Try again
          </button>
        </div>
      )}

      {nextJob && <NextJobBanner job={nextJob} />}

      {showSkeleton ? (
        <KpiSkeleton />
      ) : (
        <>
          {data && <AttentionStrip items={attentionItems} />}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard
              label="Total Revenue"
              value={maskFinancialValue(formatCurrency(jobTotals.revenue))}
              icon={TrendingUp}
              to="/admin/jobs"
              detail={<>{maskFinancialValue(formatCurrency(monthToDate.revenue.current))} this month</>}
              comparison={monthToDate.revenue}
            />
            <KpiCard
              label="Total Jobs"
              value={jobTotals.total}
              icon={Briefcase}
              to="/admin/jobs"
              detail={<>{monthToDate.jobs.current} completed this month</>}
              comparison={monthToDate.jobs}
            />
            <KpiCard
              label={jobTotals.timeSaved.title}
              value={jobTotals.timeSaved.label}
              icon={Clock}
              to="/admin/analytics"
              detail={<>{formatHours(monthToDate.hours.current)} this month</>}
              comparison={monthToDate.hours}
            />
            <KpiCard
              label="Avg Rating"
              value={data && data.avgRating > 0 ? `${data.avgRating}/5` : 'N/A'}
              icon={Star}
              to="/admin/reviews"
              detail={data ? <>From {data.reviews} {plural(data.reviews, 'review', 'reviews')}</> : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TrendCharts
                trend={jobTotals.trend}
                formatCurrency={formatCurrency}
                maskFinancialValue={maskFinancialValue}
                privacyModeEnabled={privacyModeEnabled}
              />
            </div>
            {data && <InquiryPipelineCard inquiries={data.inquiries} responseTime={data.responseTime} />}
          </div>

          {data && (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              {data.reminders.items.length > 0 && (
                <Panel title="Follow-up Reminders" icon={Bell} action={{ label: 'View all', to: '/admin/reminders' }}>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {data.reminders.overdue > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {data.reminders.overdue} Overdue
                      </span>
                    )}
                    {data.reminders.dueToday > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        <Clock className="h-3.5 w-3.5" />
                        {data.reminders.dueToday} Due Today
                      </span>
                    )}
                    {data.reminders.upcoming > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        <Calendar className="h-3.5 w-3.5" />
                        {data.reminders.upcoming} Upcoming
                      </span>
                    )}
                  </div>
                <div className="space-y-3">
                  {data.reminders.items.map((reminder) => {
                    const scheduledDate = parseJobDate(reminder.scheduled_date) ?? new Date(reminder.scheduled_date);
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
                                {reminder.job?.client_name || 'Unknown Customer'}
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
                </Panel>
              )}

              {data.recentInquiries.length > 0 && (
                <Panel title="Recent Inquiries" icon={MessageSquare} action={{ label: 'View all', to: '/admin/inquiries' }}>
                <div className="space-y-3">
                  {data.recentInquiries.map((inquiry) => {
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
                </Panel>
              )}

              {scheduledEmails.length > 0 && (
                <Panel title="Scheduled Emails" icon={Mail} action={{ label: 'View all', to: '/admin/scheduled-emails' }}>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {dueEmails > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <Send className="h-3.5 w-3.5" />
                        {dueEmails} Sending Soon
                      </span>
                    )}
                    {upcomingEmails > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        <Calendar className="h-3.5 w-3.5" />
                        {upcomingEmails} Upcoming
                      </span>
                    )}
                    {blockedEmails > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {blockedEmails} Need Attention
                      </span>
                    )}
                  </div>
                <div className="space-y-2">
                  {emailsToShow.map(email => (
                      <Link
                        key={email.id}
                        to="/admin/scheduled-emails"
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {email.recipientName || email.recipientEmail || 'Unknown recipient'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{email.label}</p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${
                            email.status === 'due'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {email.status === 'due' ? 'Sending soon' : 'Upcoming'}
                        </span>
                      </Link>
                    ))}
                </div>
                </Panel>
              )}

              {data.upcomingGoals.length > 0 && (
                <Panel title="Active Goals" icon={Target} action={{ label: 'View all', to: '/admin/goals' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Total Goals</p>
                    <p className="text-2xl font-bold text-slate-900">{data.goalStats.totalGoals}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-700 mb-1">Completed</p>
                    <p className="text-2xl font-bold text-emerald-900">{data.goalStats.completedGoals}</p>
                    <p className="text-xs text-emerald-600 mt-1">{data.goalStats.completionRate}% rate</p>
                  </div>
                  {data.goalStats.overdueGoals > 0 && (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-red-700 mb-1">Overdue</p>
                      <p className="text-2xl font-bold text-red-900">{data.goalStats.overdueGoals}</p>
                      <p className="text-xs text-red-600 mt-1">Need attention</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {data.upcomingGoals.map((goal) => {
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
                </Panel>
              )}
            </div>
          )}

          {data && (
            <section aria-label="Website content">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">On your website</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { name: 'Services', value: data.services, icon: Wrench, to: '/admin/services' },
                  { name: 'Service Areas', value: data.serviceAreas, icon: MapPin, to: '/admin/service-areas' },
                  { name: 'Reviews', value: data.reviews, icon: Star, to: '/admin/reviews' },
                ].map(({ name, value, icon: Icon, to }) => (
                  <Link
                    key={name}
                    to={to}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs transition hover:border-slate-300 hover:shadow-md"
                  >
                    <span className="rounded-lg bg-slate-100 p-2 text-slate-500 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{name}</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {referralStats && (
            <Panel title="Referral Program" icon={Gift} action={{ label: 'View referrals', to: '/admin/clients?segment=referrals' }}>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { name: 'Active Codes', value: String(referralStats.totalCodes) },
                  { name: 'Total Referrals', value: String(referralStats.totalReferrals) },
                  { name: 'Credits Issued', value: maskFinancialValue(`$${referralStats.creditsIssuedAllTime.toFixed(0)}`) },
                  { name: 'Credits Redeemed', value: maskFinancialValue(`$${referralStats.creditsRedeemedAllTime.toFixed(0)}`) },
                ].map(stat => (
                  <div key={stat.name} className="rounded-lg bg-slate-50 px-4 py-3">
                    <dt className="text-xs text-slate-600">{stat.name}</dt>
                    <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
