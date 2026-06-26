import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  QrCode,
  BarChart3,
  Download,
  Eye,
  Globe
} from 'lucide-react';
import { getQRCode, getShortURL, QRCodeWithSchedules } from '../../services/qrCodeService';
import { getScanAnalytics, exportScanDataToCSV, ScanAnalytics } from '../../services/qrScanService';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function QRCodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [qrCode, setQRCode] = useState<QRCodeWithSchedules | null>(null);
  const [analytics, setAnalytics] = useState<ScanAnalytics | null>(null);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all'>('30');

  useEffect(() => {
    fetchData();
  }, [id, dateRange]);

  const fetchData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const qrCodeData = await getQRCode(id);
      if (!qrCodeData) {
        navigate('/admin/qr-codes');
        return;
      }

      setQRCode(qrCodeData);

      let startDate: string | undefined;
      const endDate = new Date().toISOString();

      if (dateRange !== 'all') {
        const daysAgo = parseInt(dateRange);
        startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      }

      const analyticsData = await getScanAnalytics(id, startDate, endDate);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!id) return;

    try {
      const csvContent = await exportScanDataToCSV(id);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-scans-${qrCode?.slug}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data');
    }
  };

  const DEVICE_COLORS = {
    mobile: '#10b981',
    tablet: '#3b82f6',
    desktop: '#8b5cf6',
    Unknown: '#6b7280'
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!qrCode || !analytics) {
    return (
      <div className="p-6">
        <p>QR Code not found</p>
      </div>
    );
  }

  const shortURL = getShortURL(qrCode.slug);

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/qr-codes')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to QR Codes
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <QrCode className="w-8 h-8 text-emerald-600" />
              {qrCode.title}
            </h1>
            <p className="text-gray-600 mt-1">
              <code className="bg-blue-50 text-blue-600 px-2 py-1 rounded">{shortURL}</code>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          {(['7', '30', '90', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                dateRange === range
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {range === 'all' ? 'All Time' : `${range} Days`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Scans</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.total_scans}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unique Scans</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.unique_scans}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Schedules</p>
              <p className="text-3xl font-bold text-gray-900">
                {qrCode.schedules?.filter(s => s.is_active).length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Activity</h3>
          {analytics.time_series.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.time_series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="scans"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Scans"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-12">No scan data available</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Breakdown</h3>
          {analytics.device_breakdown.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={analytics.device_breakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.device_breakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DEVICE_COLORS[entry.device_type as keyof typeof DEVICE_COLORS] || DEVICE_COLORS.Unknown}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {analytics.device_breakdown.map((device) => (
                  <div key={device.device_type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: DEVICE_COLORS[device.device_type as keyof typeof DEVICE_COLORS] || DEVICE_COLORS.Unknown }}
                      />
                      <span className="text-sm text-gray-700 capitalize">{device.device_type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{device.count}</span>
                      <span className="text-xs text-gray-500 ml-1">({device.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">No device data available</p>
          )}
        </div>
      </div>

      {analytics.top_referrers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
          <div className="space-y-2">
            {analytics.top_referrers.map((referrer, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700 truncate flex-1">{referrer.referrer || 'Direct'}</span>
                <span className="text-sm font-semibold text-gray-900 ml-4">{referrer.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Scans</h3>
        {analytics.recent_scans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">OS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.recent_scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(scan.scanned_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{scan.device_type || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{scan.browser || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{scan.os || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-xs">{scan.referrer || 'Direct'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12">No scan data available</p>
        )}
      </div>
    </div>
  );
}
