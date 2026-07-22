import { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Ban,
  ScrollText,
  Activity,
  X,
} from 'lucide-react';
import {
  API_SCOPES,
  ApiKey,
  ApiRequestLog,
  createApiKey,
  listApiKeys,
  listApiRequestLogs,
  countRequestsSince,
  revokeApiKey,
  getApiBaseUrl,
} from '../../services/apiPlatformService';
import { logAction } from '../../services/auditLogService';

type KeyStatus = 'active' | 'revoked' | 'expired';

function keyStatus(key: ApiKey): KeyStatus {
  if (key.revoked_at) return 'revoked';
  if (key.expires_at && new Date(key.expires_at) <= new Date()) return 'expired';
  return 'active';
}

const statusStyles: Record<KeyStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  revoked: 'bg-red-100 text-red-800',
  expired: 'bg-amber-100 text-amber-800',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [requests24h, setRequests24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [keyRows, logRows, count] = await Promise.all([
        listApiKeys(),
        listApiRequestLogs({ limit: 50 }),
        countRequestsSince(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ]);
      setKeys(keyRows);
      setLogs(logRows);
      setRequests24h(count);
    } catch (error) {
      console.error('Error loading API keys:', error);
      setMessage({ type: 'error', text: 'Failed to load API keys.' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleRevoke = async (key: ApiKey) => {
    if (!confirm(`Revoke "${key.name}"? Anything using this key stops working immediately. This cannot be undone.`)) {
      return;
    }
    try {
      await revokeApiKey(key.id);
      await logAction({
        actionType: 'UPDATE',
        tableName: 'api_keys',
        recordId: key.id,
        recordIdentifier: `${key.name} (revoked)`,
      });
      showMessage('success', `API key "${key.name}" revoked.`);
      fetchData();
    } catch (error) {
      console.error('Error revoking API key:', error);
      showMessage('error', 'Failed to revoke API key.');
    }
  };

  const copyBaseUrl = async () => {
    await navigator.clipboard.writeText(getApiBaseUrl());
    setCopiedBaseUrl(true);
    setTimeout(() => setCopiedBaseUrl(false), 2000);
  };

  const keyNameById = new Map(keys.map((k) => [k.id, k.name]));
  const activeKeys = keys.filter((k) => keyStatus(k) === 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">API Keys</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Issue scoped keys so external tools (Zapier, schedulers, custom scripts) can securely access your data.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Active Keys</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{activeKeys.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Requests (24h)</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{requests24h}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 mb-6">
        <p className="text-xs font-medium text-slate-500 mb-1">API Base URL</p>
        <div className="flex items-center gap-2">
          <code className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1 overflow-x-auto flex-1">
            {getApiBaseUrl()}
          </code>
          <button
            onClick={copyBaseUrl}
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex-shrink-0"
            title="Copy base URL"
          >
            {copiedBaseUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Send your key in the <code className="bg-slate-100 px-1 rounded">X-Api-Key</code> header. See{' '}
          <code className="bg-slate-100 px-1 rounded">docs/API_GUIDE.md</code> for endpoints and examples.
        </p>
      </div>

      {keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <KeyRound className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">No API keys yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            Create Your First Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Scopes</th>
                  <th className="px-4 py-3">Last Used</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((key) => {
                  const status = keyStatus(key);
                  return (
                    <tr key={key.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{key.name}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                          {key.key_prefix}…
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <span key={scope} className="inline-block px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(key.last_used_at)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${statusStyles[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {status === 'active' && (
                          <button
                            onClick={() => handleRevoke(key)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Revoke key"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900">Recent Requests</h2>
      </div>
      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No API requests yet. Requests appear here as soon as a key is used.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{keyNameById.get(log.api_key_id) ?? 'Deleted key'}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-slate-700">
                        {log.method} {log.path}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${log.status_code < 400 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {log.status_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600">{log.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async (record) => {
            await logAction({
              actionType: 'CREATE',
              tableName: 'api_keys',
              recordId: record.id,
              recordIdentifier: record.name,
            });
            fetchData();
          }}
        />
      )}
    </div>
  );
}

interface CreateApiKeyModalProps {
  onClose: () => void;
  onCreated: (record: ApiKey) => void;
}

function CreateApiKeyModal({ onClose, onCreated }: CreateApiKeyModalProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<string>('never');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Give the key a name so you remember what it is for.');
      return;
    }
    if (scopes.length === 0) {
      setError('Select at least one scope.');
      return;
    }
    setSaving(true);
    try {
      const result = await createApiKey({
        name: name.trim(),
        scopes,
        expires_in_days: expiry === 'never' ? null : Number(expiry),
      });
      setCreatedKey(result.api_key);
      onCreated(result.record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key.');
    } finally {
      setSaving(false);
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {createdKey ? 'API Key Created' : 'Create API Key'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdKey ? (
          <div className="p-6">
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Copy this key now.</strong> For security it is not stored anywhere and cannot be shown again.
                If you lose it, revoke it and create a new one.
              </p>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <code className="text-xs sm:text-sm bg-slate-900 text-emerald-300 rounded-lg px-3 py-3 overflow-x-auto flex-1 break-all">
                {createdKey}
              </code>
              <button
                onClick={copyKey}
                className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors flex-shrink-0"
                title="Copy key"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Done — I've copied the key
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="api-key-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Name
              </label>
              <input
                id="api-key-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Zapier - new inquiries"'
                maxLength={100}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-slate-700 mb-1.5">Scopes</p>
              <p className="text-xs text-slate-500 mb-3">
                Grant only what the connecting tool needs. You can always create another key with different scopes.
              </p>
              <div className="space-y-2">
                {API_SCOPES.map((scope) => (
                  <label
                    key={scope.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      scopes.includes(scope.value)
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{scope.label}</span>
                      <span className="block text-xs text-slate-500">{scope.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="api-key-expiry" className="block text-sm font-medium text-slate-700 mb-1.5">
                Expires
              </label>
              <select
                id="api-key-expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never (revoke manually)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Key'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
