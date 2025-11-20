import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useRealtimeJobs } from '../../hooks/useRealtimeJobs';
import { getRecentInquiries, getInquiryStats } from '../../services/inquiryService';
import {
  Building2,
  Briefcase,
  MapPin,
  Star,
  TrendingUp,
  Clock,
  CreditCard,
  Share2,
  BarChart3,
  ArrowRight,
  Inbox,
  ExternalLink,
  Mail,
  MessageSquare,
  AlertCircle
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
  inquiries: number;
  pendingInquiries: number;
  conversionRate: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    services: 0,
    serviceAreas: 0,
    reviews: 0,
    avgRating: 0,
    paymentMethods: 0,
    socialMedia: 0,
    jobs: 0,
    totalRevenue: 0,
    inquiries: 0,
    pendingInquiries: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const { jobs: realtimeJobs } = useRealtimeJobs(businessId);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (realtimeJobs.length > 0 && businessId) {
      updateRevenueFromJobs();
    }
  }, [realtimeJobs, businessId]);

  const updateRevenueFromJobs = () => {
    const completedJobs = realtimeJobs.filter(job => job.date_completed);
    const totalRevenue = completedJobs.reduce((sum, job) => sum + (Number(job.final_price) || 0), 0);

    setStats(prev => ({
      ...prev,
      jobs: realtimeJobs.length,
      totalRevenue,
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
        recentInquiriesData
      ] = await Promise.all([
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('service_areas').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customer_reviews').select('rating_value').eq('is_active', true),
        supabase.from('payment_methods').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('social_media').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('business_id', businessInfo.id).eq('is_active', true),
        supabase.from('jobs').select('final_price, date_completed').eq('business_id', businessInfo.id).eq('is_active', true).not('date_completed', 'is', null),
        getInquiryStats(businessInfo.id),
        getRecentInquiries(businessInfo.id, 5)
      ]);

      setRecentInquiries(recentInquiriesData);

      const avgRating = reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum, r) => sum + r.rating_value, 0) / reviewsData.length
        : 0;

      const totalRevenue = jobsData && jobsData.length > 0
        ? jobsData.reduce((sum, job) => sum + (Number(job.final_price) || 0), 0)
        : 0;

      setStats({
        services: servicesCount || 0,
        serviceAreas: serviceAreasCount || 0,
        reviews: reviewsData?.length || 0,
        avgRating: Math.round(avgRating * 10) / 10,
        paymentMethods: paymentMethodsCount || 0,
        socialMedia: socialMediaCount || 0,
        jobs: jobsCount || 0,
        totalRevenue,
        inquiries: inquiryStats.total,
        pendingInquiries: inquiryStats.pending,
        conversionRate: inquiryStats.conversionRate,
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
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      link: '/admin/jobs',
      color: 'bg-emerald-500'
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome back!
        </h1>
        <p className="text-slate-600">
          {businessName ? `Managing ${businessName}` : 'Manage your business content'}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse">
              <div className="h-12 w-12 bg-slate-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isHighlighted = 'highlight' in card && card.highlight;
            return (
              <Link
                key={card.name}
                to={card.link}
                className={`bg-white rounded-xl p-6 border transition-all group ${
                  isHighlighted
                    ? 'border-orange-300 shadow-md hover:shadow-lg'
                    : 'border-slate-200 hover:shadow-lg hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 ${card.color} rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {isHighlighted && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      Action Needed
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{card.name}</p>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                <p className="text-sm text-emerald-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage →
                </p>
              </Link>
            );
          })}
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
                          <span className="text-sm font-semibold text-emerald-600">{inquiry.estimated_price}</span>
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
