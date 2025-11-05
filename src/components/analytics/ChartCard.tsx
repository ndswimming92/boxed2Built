import React from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: string;
}

export default function ChartCard({ title, subtitle, children, height = 'h-80' }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs sm:text-sm text-slate-600 mt-1">{subtitle}</p>}
      </div>
      <div className={height}>{children}</div>
    </div>
  );
}
