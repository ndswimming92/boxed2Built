import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBgColor,
  trend,
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-2 sm:gap-3 mb-3">
        <div className={`p-1.5 sm:p-2 ${iconBgColor} rounded-lg`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-600">{title}</p>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">{value}</p>
      {subtitle && <p className="text-xs sm:text-sm text-slate-600">{subtitle}</p>}
      {trend && (
        <p
          className={`text-xs sm:text-sm font-medium mt-2 ${
            trend.positive ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {trend.value}
        </p>
      )}
    </div>
  );
}
