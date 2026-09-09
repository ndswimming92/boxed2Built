import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Search, Download, Mail, Phone, TrendingUp, UserX, Star, Filter, Gift, Copy, Check, Send, GitMerge, Trash2, AlertCircle, UserPlus, QrCode } from 'lucide-react';
import {
  getAllClientsIncludingTest,
  getClientSegment,
  getClientSegmentStats,
  searchClients,
  deleteClient,
  type Client,
  type ClientSegmentStats,
  calculateClientMetrics
} from '../../services/clientService';
import ClientDetailModal from '../../components/admin/ClientDetailModal';
import ClientQRCodeModal from '../../components/admin/ClientQRCodeModal';
import ExportClientsModal from '../../components/admin/ExportClientsModal';
import MergeClientsModal from '../../components/admin/MergeClientsModal';
import ClientFormModal from '../../components/admin/ClientFormModal';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { logAction } from '../../services/auditLogService';
import { supabase } from '../../lib/supabase';

type SegmentType = 'all' | 'repeat' | 'high_value' | 'dormant' | 'leads' | 'referrals';

const SEGMENTS: SegmentType[] = ['all', 'repeat', 'high_value', 'dormant', 'leads', 'referrals'];

/**
 * Reads the segment out of the URL, so a link like
 * `/admin/clients?segment=referrals` (the dashboard's referral card) opens on
 * that segment instead of silently landing on "all". Anything unrecognised
 * falls back rather than leaving the page on an empty segment.
 */
function segmentFromParam(value: string | null): SegmentType {
  return SEGMENTS.includes(value as SegmentType) ? (value as SegmentType) : 'all';
}

export default function ClientsPage() {
  const { maskFinancialValue } = usePrivacyMode();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientSegmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>(() =>
    segmentFromParam(searchParams.get('segment'))
  );
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<keyof Client>('last_contact_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdMessage, setCreatedMessage] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ processed: 0, total: 0 });
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrClient, setQrClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { currentOrganization } = useAuth();

  const organizationId = currentOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    loadData();
  }, [organizationId, selectedSegment]);

  async function hydrateClientsWithLiveRevenue(clientsList: Client[]): Promise<Client[]> {
    if (clientsList.length === 0) return clientsList;

    const clientIds = clientsList.map(client => client.id);
    const { data: completedJobs, error } = await supabase
      .from('jobs')
      .select('client_id, final_price, quoted_price')
      .in('client_id', clientIds)
      .eq('job_status', 'completed');

    if (error) {
      console.error('Error loading live client revenue from jobs:', error);
      return clientsList;
    }

    const revenueByClient = new Map<string, { revenue: number; completedJobs: number }>();

    for (const job of completedJobs || []) {
      if (!job.client_id) continue;
      const existing = revenueByClient.get(job.client_id) || { revenue: 0, completedJobs: 0 };
      const jobRevenue = Number(job.final_price ?? job.quoted_price ?? 0);
      revenueByClient.set(job.client_id, {
        revenue: existing.revenue + jobRevenue,
        completedJobs: existing.completedJobs + 1
      });
    }

    return clientsList.map((client) => {
      const liveMetrics = revenueByClient.get(client.id);
      if (!liveMetrics) return client;

      return {
        ...client,
        total_revenue: liveMetrics.revenue,
        job_count: liveMetrics.completedJobs,
        average_job_value: liveMetrics.completedJobs > 0
          ? liveMetrics.revenue / liveMetrics.completedJobs
          : 0,
      };
    });
  }

  /**
   * Keeps the URL in step with the segment tabs. Without this, arriving on
   * `?segment=referrals`, switching tabs and then refreshing would snap back
   * to referrals, because the stale param still decides the initial state.
   * Replaces rather than pushes, so tab clicks do not fill up the back button.
   */
  function changeSegment(next: SegmentType) {
    setSelectedSegment(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'all') params.delete('segment');
        else params.set('segment', next);
        return params;
      },
      { replace: true }
    );
  }

  async function loadData(silent = false) {
    if (!organizationId) {
      setClients([]);
      setStats(null);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const [clientsData, statsData] = await Promise.all([
        selectedSegment === 'all'
          ? getAllClientsIncludingTest(organizationId)
          : selectedSegment === 'referrals'
          ? getClientSegment(organizationId, 'all').then(all => all.filter(c => !c.is_test && (c.referral_credit_balance > 0 || c.referral_credit_used > 0 || c.referral_code)))
          : getClientSegment(organizationId, selectedSegment),
        getClientSegmentStats(organizationId)
      ]);

      const hydratedClients = await hydrateClientsWithLiveRevenue(clientsData);
      setClients(hydratedClients);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(term: string) {
    setSearchTerm(term);
    if (!organizationId) return;

    if (term.trim()) {
      try {
        const results = await searchClients(organizationId, term);
        const hydratedResults = await hydrateClientsWithLiveRevenue(results);
        setClients(hydratedResults);
      } catch (error) {
        console.error('Error searching clients:', error);
      }
    } else {
      loadData();
    }
  }

  async function handleRefreshMetrics() {
    if (refreshing) return;

    const batchSize = 5;
    const totalClients = clients.length;

    if (totalClients === 0) {
      setRefreshMessage({ type: 'success', text: 'No clients to refresh.' });
      return;
    }

    try {
      setRefreshing(true);
      setRefreshMessage(null);
      setRefreshProgress({ processed: 0, total: totalClients });

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < totalClients; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(async (client) => {
            try {
              await calculateClientMetrics(client.id);
              return true;
            } catch (error) {
              console.error(`Error refreshing metrics for client ${client.id}:`, error);
              return false;
            }
          })
        );

        const batchSuccesses = results.filter(Boolean).length;
        successCount += batchSuccesses;
        failureCount += batch.length - batchSuccesses;
        setRefreshProgress({ processed: i + batch.length, total: totalClients });
      }

      await loadData(true);

      setRefreshMessage({
        type: failureCount > 0 ? 'error' : 'success',
        text: `Metrics refresh complete: ${successCount} succeeded, ${failureCount} failed.`
      });
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      setRefreshMessage({ type: 'error', text: 'Metrics refresh failed before completion.' });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleConfirmDelete() {
    if (!clientToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteClient(clientToDelete.id);
      logAction({ actionType: 'DELETE', tableName: 'clients', recordIdentifier: clientToDelete.name });
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setSelectedClients((prev) => {
        const next = new Set(prev);
        next.delete(clientToDelete.id);
        return next;
      });
      setClientToDelete(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete client. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  function handleSort(field: keyof Client) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  const sortedClients = useMemo(() => {
    const sorted = [...clients].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [clients, sortField, sortDirection]);

  function toggleClientSelection(clientId: string) {
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  }

  function copyReferralCode(code: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  function getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'repeat': return 'bg-yellow-100 text-yellow-800';
      case 'dormant': return 'bg-orange-100 text-orange-800';
      case 'lead': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getValueTierBadge(tier: string): JSX.Element {
    switch (tier) {
      case 'vip':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
          <Star className="w-3 h-3 fill-current" /> VIP
        </span>;
      case 'high_value':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          High Value
        </span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
          Standard
        </span>;
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(date: string | null): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const selectedClientsList = useMemo(() => {
    return clients.filter(c => selectedClients.has(c.id));
  }, [clients, selectedClients]);

  const dormantHighValueCount = useMemo(() => {
    return clients.filter(c =>
      c.client_status === 'dormant' &&
      ['high_value', 'vip'].includes(c.client_value_tier)
    ).length;
  }, [clients]);

  const refreshPercent = refreshProgress.total
    ? Math.round((refreshProgress.processed / refreshProgress.total) * 100)
    : 0;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-600">Select an organization to view clients.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your client relationships and marketing campaigns
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => {
              setCreatedMessage(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            Add Client
          </button>
          <button
            onClick={handleRefreshMetrics}
            disabled={refreshing}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
          >
            {refreshing
              ? `${refreshProgress.processed}/${refreshProgress.total} (${refreshPercent}%)`
              : 'Refresh Metrics'}
          </button>
          {selectedClients.size === 2 && (
            <button
              onClick={() => setShowMergeModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 whitespace-nowrap"
            >
              <GitMerge className="w-4 h-4" />
              Merge (2)
            </button>
          )}
          {selectedClients.size > 0 && (
            <button
              onClick={() => {
                setShowExportModal(true);
                logAction({ actionType: 'EXPORT', tableName: 'clients', recordIdentifier: `${selectedClients.size} clients` });
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Export ({selectedClients.size})
            </button>
          )}
        </div>
      </div>

      {refreshing && (
        <p className="text-sm text-blue-600">
          Refreshing metrics for {refreshProgress.processed} of {refreshProgress.total} clients...
        </p>
      )}

      {refreshMessage && (
        <p className={`text-sm ${refreshMessage.type === 'success' ? 'text-green-600' : 'text-orange-600'}`}>
          {refreshMessage.text}
        </p>
      )}

      {createdMessage && (
        <p className={`text-sm ${createdMessage.type === 'success' ? 'text-green-600' : 'text-orange-600'}`}>
          {createdMessage.text}
        </p>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="p-3 sm:p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Clients</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.total_clients}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              {maskFinancialValue(formatCurrency(stats.total_revenue))} revenue
            </p>
          </div>

          <div className="p-3 sm:p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Repeat Customers</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.repeat_customers}</p>
              </div>
              <div className="p-2 sm:p-3 bg-yellow-100 rounded-full">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              {stats.total_clients > 0
                ? Math.round((stats.repeat_customers / stats.total_clients) * 100)
                : 0}% of clients
            </p>
          </div>

          <div className="p-3 sm:p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">High-Value</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.high_value_clients}</p>
              </div>
              <div className="p-2 sm:p-3 bg-amber-100 rounded-full">
                <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              Top revenue generators
            </p>
          </div>

          <div className="p-3 sm:p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Need Attention</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{dormantHighValueCount}</p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-100 rounded-full">
                <UserX className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              Dormant high-value
            </p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Segment Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All Clients', icon: Users },
              { value: 'repeat', label: 'Repeat Customers', icon: TrendingUp },
              { value: 'high_value', label: 'High-Value', icon: Star },
              { value: 'dormant', label: 'Dormant', icon: UserX },
              { value: 'leads', label: 'New Leads', icon: Filter },
              { value: 'referrals', label: 'Referrals', icon: Gift },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  changeSegment(value as SegmentType);
                  setSearchTerm('');
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedSegment === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {sortedClients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No clients found</h3>
            <p className="mt-2 text-sm text-gray-600">
              {searchTerm
                ? 'Try adjusting your search or filter criteria'
                : 'Clients will appear here as you add them through inquiries and jobs'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedClients.size === clients.length && clients.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Contact
                  </th>
                  <th
                    onClick={() => handleSort('total_revenue')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Revenue {sortField === 'total_revenue' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('job_count')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Jobs {sortField === 'job_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('last_contact_date')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Last Contact {sortField === 'last_contact_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('client_status')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Status {sortField === 'client_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('client_value_tier')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Value Tier {sortField === 'client_value_tier' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Opt-In
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Referral
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.id)}
                        onChange={() => toggleClientSelection(client.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{client.name}</span>
                        {client.is_test && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded border border-gray-300">
                            Test
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {client.email}
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {client.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {maskFinancialValue(formatCurrency(client.total_revenue))}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {client.job_count}
                    </td>
                    <td className="px-4 py-4">
                      {client.last_contact_date ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-gray-600">{formatDate(client.last_contact_date)}</span>
                          {client.last_followup_email_sent_at &&
                            new Date(client.last_followup_email_sent_at) >= new Date(client.last_contact_date) && (
                            <span className="flex items-center gap-1 text-xs text-sky-600 font-medium">
                              <Send className="w-3 h-3" />
                              Follow-up email
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadgeColor(client.client_status)}`}>
                        {client.client_status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {getValueTierBadge(client.client_value_tier)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {client.marketing_email_opt_in && (
                          <Mail className="w-4 h-4 text-green-600" aria-label="Email opt-in" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {client.referral_code ? (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => copyReferralCode(client.referral_code!, e)}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors max-w-max"
                            title="Click to copy"
                          >
                            {copiedCode === client.referral_code ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {client.referral_code}
                          </button>
                          <button
                            onClick={() => setQrClient(client)}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors max-w-max"
                            title="Referral QR code"
                          >
                            <QrCode className="w-3 h-3" />
                            QR
                          </button>
                          {(client.referral_credit_balance > 0 || client.referral_credit_used > 0) && (
                            <span className="text-xs text-gray-500">
                              ${client.referral_credit_balance.toFixed(2)} credit
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setClientToDelete(client);
                          setDeleteError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        title={`Delete ${client.name}`}
                        aria-label={`Delete ${client.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {qrClient?.referral_code && (
        <ClientQRCodeModal
          isOpen
          onClose={() => setQrClient(null)}
          clientName={qrClient.name}
          referralCode={qrClient.referral_code}
          scanCount={qrClient.referral_scan_count}
          lastScannedAt={qrClient.referral_last_scanned_at}
        />
      )}

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => {
            setSelectedClient(null);
            loadData();
          }}
          onDeleted={(clientId) => {
            setClients((prev) => prev.filter((c) => c.id !== clientId));
            setSelectedClient(null);
          }}
        />
      )}

      {clientToDelete && (
        <Modal
          isOpen
          onClose={() => { if (!deleting) { setClientToDelete(null); setDeleteError(null); } }}
          title="Delete client"
          size="small"
        >
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Delete this client?</h2>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{clientToDelete.name}</span> will be permanently removed. This action cannot be undone.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
                  <li>The client record and all notes will be deleted</li>
                  <li>Jobs and invoices will be unlinked but kept</li>
                  <li>Referral attributions from this client will be cleared</li>
                </ul>
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => { setClientToDelete(null); setDeleteError(null); }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <>
                    <LoadingSpinner />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Client
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCreateModal && organizationId && (
        <ClientFormModal
          organizationId={organizationId}
          onClose={() => setShowCreateModal(false)}
          onCreated={(client, warning) => {
            setShowCreateModal(false);
            setCreatedMessage({
              type: warning ? 'warning' : 'success',
              text: warning
                ? `${client.name} was added to your clients. ${warning}`
                : `${client.name} was added to your clients.`,
            });
            setSearchTerm('');
            // A new client starts as a lead, so drop any segment filter that
            // would hide the row the admin just created.
            if (selectedSegment === 'all') {
              loadData();
            } else {
              changeSegment('all');
            }
          }}
        />
      )}

      {showExportModal && (
        <ExportClientsModal
          clients={selectedClientsList}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showMergeModal && selectedClients.size === 2 && (() => {
        const ids = Array.from(selectedClients);
        const a = clients.find(c => c.id === ids[0]);
        const b = clients.find(c => c.id === ids[1]);
        if (!a || !b) return null;
        return (
          <MergeClientsModal
            clientA={a}
            clientB={b}
            onClose={() => setShowMergeModal(false)}
            onMerged={() => {
              setShowMergeModal(false);
              setSelectedClients(new Set());
              loadData();
            }}
          />
        );
      })()}
    </div>
  );
}
