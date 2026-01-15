import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Copy,
  Power,
  Trash2,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getAllQRCodes,
  deleteQRCode,
  toggleQRCodeStatus,
  getQRCodeStats,
  getShortURL,
  QRCodeWithSchedules,
  QRCodeStats
} from '../../services/qrCodeService';
import QRCodeFormModal from '../../components/admin/QRCodeFormModal';

export default function QRCodesPage() {
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodes, setQRCodes] = useState<QRCodeWithSchedules[]>([]);
  const [filteredQRCodes, setFilteredQRCodes] = useState<QRCodeWithSchedules[]>([]);
  const [stats, setStats] = useState<QRCodeStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState<QRCodeWithSchedules | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterQRCodes();
  }, [qrCodes, searchQuery, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bizData } = await supabase
        .from('business_info')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (bizData) {
        setBusinessId(bizData.id);
        const [qrCodesData, statsData] = await Promise.all([
          getAllQRCodes(bizData.id),
          getQRCodeStats(bizData.id)
        ]);
        setQRCodes(qrCodesData);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterQRCodes = () => {
    let filtered = [...qrCodes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (qr) =>
          qr.title.toLowerCase().includes(query) ||
          qr.slug.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((qr) => qr.status === statusFilter);
    }

    setFilteredQRCodes(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this QR code? This will also delete all associated schedules and scan data.')) {
      return;
    }

    try {
      await deleteQRCode(id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting QR code:', error);
      alert('Failed to delete QR code');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await toggleQRCodeStatus(id, newStatus);
      await fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to update status');
    }
  };

  const handleCopyURL = (slug: string) => {
    const url = getShortURL(slug);
    navigator.clipboard.writeText(url);
    alert('Short URL copied to clipboard!');
  };

  const handleEdit = (qrCode: QRCodeWithSchedules) => {
    setSelectedQRCode(qrCode);
    setShowFormModal(true);
  };

  const handleCreate = () => {
    setSelectedQRCode(null);
    setShowFormModal(true);
  };

  const handleViewDetails = (qrCodeId: string) => {
    navigate(`/admin/qr-codes/${qrCodeId}`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <QrCode className="w-8 h-8 text-emerald-600" />
              QR Code Manager
            </h1>
            <p className="text-gray-600 mt-1">
              Create and manage QR codes with time-based redirects
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create QR Code
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <QrCode className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total QR Codes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_codes}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Power className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_codes}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Power className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inactive_codes}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Scans</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_scans}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input name="searchQuery"
              type="text"
              placeholder="Search by title or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {filteredQRCodes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {qrCodes.length === 0 ? 'No QR Codes Yet' : 'No Results Found'}
          </h3>
          <p className="text-gray-600 mb-4">
            {qrCodes.length === 0
              ? 'Create your first QR code to get started with dynamic redirects and time-based campaigns.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {qrCodes.length === 0 && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Your First QR Code
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Short URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Default Destination
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scans
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQRCodes.map((qrCode) => (
                  <tr key={qrCode.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded">
                          <QrCode className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{qrCode.title}</div>
                          <div className="text-xs text-gray-500">/{qrCode.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          /go/{qrCode.slug}
                        </code>
                        <button
                          onClick={() => handleCopyURL(qrCode.slug)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy URL"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {qrCode.default_destination_url}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {qrCode.scan_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          qrCode.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {qrCode.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewDetails(qrCode.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details & Analytics"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleEdit(qrCode)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <a
                          href={getShortURL(qrCode.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Test Redirect"
                        >
                          <ExternalLink className="w-4 h-4 text-green-600" />
                        </a>
                        <button
                          onClick={() => handleToggleStatus(qrCode.id, qrCode.status)}
                          className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                            qrCode.status === 'active' ? 'text-gray-600' : 'text-green-600'
                          }`}
                          title={qrCode.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(qrCode.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {businessId ? (
        <QRCodeFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setSelectedQRCode(null);
          }}
          qrCode={selectedQRCode}
          businessId={businessId}
          onSuccess={fetchData}
        />
      ) : showFormModal ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Business Setup Required</h3>
            <p className="text-gray-600 mb-4">
              You need to set up your business information before creating QR codes.
            </p>
            <button
              onClick={() => setShowFormModal(false)}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
