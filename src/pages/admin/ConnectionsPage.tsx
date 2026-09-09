import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plug,
  Instagram,
  Facebook,
  MapPin,
  Music2,
  Youtube,
  CheckCircle,
  AlertCircle,
  Unplug,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  IntegrationConnection,
  listConnections,
  disconnectConnection,
  startGoogleBusinessConnect,
  startFacebookConnect,
} from '../../services/apiPlatformService';
import { checkGoogleBusinessConnection } from '../../services/googleBusinessSyncService';
import { logAction } from '../../services/auditLogService';

// Providers with a working Connect flow. Others stay disabled until their
// OAuth callback is built and a developer app is registered with that platform.
const CONNECTABLE_PROVIDERS = new Set(['google_business', 'facebook', 'instagram', 'youtube']);

interface ProviderInfo {
  id: string;
  name: string;
  icon: React.ElementType;
  iconClass: string;
  description: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    iconClass: 'bg-pink-100 text-pink-600',
    description: 'Auto-post completed jobs from your gallery and track post performance.',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    iconClass: 'bg-blue-100 text-blue-600',
    description: 'Share updates to your business page and pull engagement metrics.',
  },
  {
    id: 'google_business',
    name: 'Google Business Profile',
    icon: MapPin,
    iconClass: 'bg-emerald-100 text-emerald-600',
    description: 'Sync reviews and post updates that show up in Google Search and Maps.',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Music2,
    iconClass: 'bg-slate-100 text-slate-700',
    description: 'Publish short-form content and monitor video analytics.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    iconClass: 'bg-red-100 text-red-600',
    description: 'Upload videos to your channel straight from the admin panel.',
  },
];

const statusStyles: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  disconnected: 'bg-slate-100 text-slate-600',
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectionError = searchParams.get('connection_error');
    if (connected) {
      setMessage({ type: 'success', text: `${connected.replace('_', ' ')} connected successfully.` });
      setSearchParams({}, { replace: true });
    } else if (connectionError) {
      setMessage({ type: 'error', text: connectionError });
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = async (providerId: string) => {
    if (!CONNECTABLE_PROVIDERS.has(providerId)) return;
    setConnecting(providerId);
    try {
      // Facebook and Instagram share a single Facebook Login flow, and
      // google_business/youtube share a single Google login (broadened
      // scope) — connecting either member of a pair authorizes both.
      const url =
        providerId === 'google_business' || providerId === 'youtube'
          ? await startGoogleBusinessConnect()
          : await startFacebookConnect();
      window.location.href = url;
    } catch (error) {
      console.error('Error starting connection:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to start connection.' });
      setConnecting(null);
    }
  };

  const fetchData = async () => {
    try {
      const rows = await listConnections();
      setConnections(rows);
    } catch (error) {
      console.error('Error loading connections:', error);
      setMessage({ type: 'error', text: 'Failed to load connections.' });
    } finally {
      setLoading(false);
    }
  };

  // Google's Basic API Access approval can land long after the OAuth grant,
  // leaving the connection with no account details. This re-runs the lookup so
  // the row heals without a disconnect/reconnect round trip.
  const handleCheckGoogleBusiness = async () => {
    setChecking(true);
    try {
      const result = await checkGoogleBusinessConnection().catch((err) => ({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to check the connection.',
        accountLabel: null,
      }));
      setMessage(
        result.success
          ? {
              type: 'success',
              text: `Google Business Profile is ready${result.accountLabel ? ` — linked to ${result.accountLabel}` : ''}.`,
            }
          : { type: 'error', text: result.error ?? 'Failed to check the connection.' },
      );
      await fetchData();
    } finally {
      setChecking(false);
      setTimeout(() => setMessage(null), 8000);
    }
  };

  const handleDisconnect = async (connection: IntegrationConnection) => {
    const label = connection.account_label || connection.provider;
    if (!confirm(`Disconnect ${label}? Scheduled syncs for this account will stop.`)) return;
    try {
      await disconnectConnection(connection.id);
      await logAction({
        actionType: 'UPDATE',
        tableName: 'integration_connections',
        recordId: connection.id,
        recordIdentifier: `${label} (disconnected)`,
      });
      setMessage({ type: 'success', text: `${label} disconnected.` });
      fetchData();
    } catch (error) {
      console.error('Error disconnecting:', error);
      setMessage({ type: 'error', text: 'Failed to disconnect.' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const activeConnectionsFor = (providerId: string) =>
    connections.filter((c) => c.provider === providerId && c.status !== 'disconnected');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Connections</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Link social media and other platforms so their data flows into your dashboard.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Provider setup required before connecting</p>
          <p>
            Each platform requires a registered developer app (with its own approval process) before accounts can be
            linked here. Google Business Profile, YouTube, Facebook, and Instagram are all live once their
            credentials are configured; connecting either Facebook or Instagram authorizes both together (Instagram
            publishing works through your linked Facebook Page), and connecting either Google Business Profile or
            YouTube authorizes both together (same Google account, broadened scope). See the "Outbound Connections"
            section of <code className="bg-blue-100 px-1 rounded">docs/API_GUIDE.md</code> for per-provider setup
            steps. If Google's Business Profile API access is still pending approval, that connection will show as
            connected with a note that account details aren't available yet — once Google approves access, press
            "Check again" on its Linked Accounts row to fill in the details. No reconnect needed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {PROVIDERS.map((provider) => {
          const Icon = provider.icon;
          const active = activeConnectionsFor(provider.id);
          const isHealthy = active.some((c) => c.status === 'connected');
          return (
            <div key={provider.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${provider.iconClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{provider.name}</h3>
                    {active.length > 0 ? (
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${statusStyles[active[0].status]}`}>
                        {active[0].status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Not connected</span>
                    )}
                  </div>
                </div>
                {CONNECTABLE_PROVIDERS.has(provider.id) ? (
                  <button
                    onClick={() => handleConnect(provider.id)}
                    disabled={connecting === provider.id || isHealthy}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connecting === provider.id ? 'Connecting…' : isHealthy ? 'Connected' : active.length > 0 ? 'Reconnect' : 'Connect'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-3 py-1.5 text-sm font-medium text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                    title="Requires provider app registration first — see docs/API_GUIDE.md"
                  >
                    Connect
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-600">{provider.description}</p>
            </div>
          );
        })}
      </div>

      {connections.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Linked Accounts</h2>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Synced</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {connections.map((connection) => (
                    <tr key={connection.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900 capitalize">
                        {connection.provider.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {connection.account_label || connection.account_identifier || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${statusStyles[connection.status] ?? statusStyles.disconnected}`}>
                          {connection.status}
                        </span>
                        {connection.sync_error && (
                          <p className="text-xs text-red-600 mt-1">{connection.sync_error}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {connection.provider === 'google_business' && connection.status !== 'disconnected' && (
                            <button
                              onClick={handleCheckGoogleBusiness}
                              disabled={checking}
                              title="Re-check the connection with Google without changing your profile"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                              {checking ? 'Checking…' : 'Check again'}
                            </button>
                          )}
                          {connection.status !== 'disconnected' && (
                            <button
                              onClick={() => handleDisconnect(connection)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Unplug className="w-3.5 h-3.5" />
                              Disconnect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
