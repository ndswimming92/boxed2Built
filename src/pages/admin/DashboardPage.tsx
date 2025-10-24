import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  Briefcase,
  MapPin,
  Star,
  TrendingUp,
  Clock,
  CreditCard,
  Share2
} from 'lucide-react';

interface Stats {
  services: number;
  serviceAreas: number;
  reviews: number;
  avgRating: number;
  paymentMethods: number;
  socialMedia: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    services: 0,
    serviceAreas: 0,
    reviews: 0,
    avgRating: 0,
    paymentMethods: 0,
    socialMedia: 0,
  });
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('name')
        .eq('is_active', true)
        .maybeSingle();

      if (businessInfo) {
        setBusinessName(businessInfo.name);
      }

      const [
        { count: servicesCount },
        { count: serviceAreasCount },
        { data: reviewsData },
        { count: paymentMethodsCount },
        { count: socialMediaCount }
      ] = await Promise.all([
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('service_areas').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customer_reviews').select('rating_value').eq('is_active', true),
        supabase.from('payment_methods').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('social_media').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ]);

      const avgRating = reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum, r) => sum + r.rating_value, 0) / reviewsData.length
        : 0;

      setStats({
        services: servicesCount || 0,
        serviceAreas: serviceAreasCount || 0,
        reviews: reviewsData?.length || 0,
        avgRating: Math.round(avgRating * 10) / 10,
        paymentMethods: paymentMethodsCount || 0,
        socialMedia: socialMediaCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Services',
      value: stats.services,
      icon: Briefcase,
      link: '/admin/services',
      color: 'bg-blue-500'
    },
    {
      name: 'Service Areas',
      value: stats.serviceAreas,
      icon: MapPin,
      link: '/admin/service-areas',
      color: 'bg-emerald-500'
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
      icon: TrendingUp,
      link: '/admin/reviews',
      color: 'bg-purple-500'
    },
    {
      name: 'Payment Methods',
      value: stats.paymentMethods,
      icon: CreditCard,
      link: '/admin/payment-methods',
      color: 'bg-rose-500'
    },
    {
      name: 'Social Media',
      value: stats.socialMedia,
      icon: Share2,
      link: '/admin/social-media',
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse">
              <div className="h-12 w-12 bg-slate-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.name}
                to={card.link}
                className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg hover:border-emerald-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 ${card.color} rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
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

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Quick Actions
          </h2>
          <div className="space-y-3">
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
