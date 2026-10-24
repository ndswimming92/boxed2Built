import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, ChevronDown, ChevronRight, Download, Search } from 'lucide-react';

type ConsentRow = {
  id: string;
  created_at: string;
  event_type: 'opt_in' | 'opt_out';
  inquiry_id: string | null;
  confirmation_code: string | null;
  name: string | null;
  email: string | null;
  phone: string;
  phone_digits: string;
  service_texts: boolean;
  marketing_texts: boolean;
  consent_text: string | null;
  consent_version: string | null;
  consent_given_at: string | null;
  source_page: string | null;
  ip_address: string | null;
  user_agent: string | null;
  recorded_by: string;
  notes: string | null;
  organization_id: string | null;
  business_id: string | null;
};

type Filter = 'all' | 'opt_in' | 'opt_out' | 'active';

const FETCH_LIMIT = 2000;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' });

const kindLabel = (row: ConsentRow) => {
  if (row.event_type === 'opt_out') return 'Opted out';
  return row.marketing_texts ? 'Service + promo' : 'Service';
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function SmsConsentLogPage() {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('sms_consent_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);
    if (loadError) {
      console.error('Error loading SMS consent log:', loadError);
      setError('Failed to load the SMS consent log');
    } else {
      setError(null);
      setRows((data ?? []) as ConsentRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Rows arrive newest first, so the first row seen per number is its current status.
  const currentStatus = useMemo(() => {
    const map = new Map<string, ConsentRow['event_type']>();
    for (const row of rows) {
      if (!map.has(row.phone_digits)) map.set(row.phone_digits, row.event_type);
    }
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, '');
    return rows.filter((row) => {
      if (filter === 'opt_in' && row.event_type !== 'opt_in') return false;
      if (filter === 'opt_out' && row.event_type !== 'opt_out') return false;
      if (filter === 'active' && currentStatus.get(row.phone_digits) !== 'opt_in') return false;
      if (!term) return true;
      const text = [row.name, row.email, row.confirmation_code, row.ip_address, row.recorded_by]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(term) || (termDigits.length >= 3 && row.phone_digits.includes(termDigits));
    });
  }, [rows, search, filter, currentStatus]);

  const markOptedOut = async (row: ConsentRow) => {
    if (!window.confirm(`Record that ${row.phone} opted out of texts? This cannot be edited or deleted later.`)) return;
    setBusyPhone(row.phone_digits);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('sms_consent_log').insert({
        event_type: 'opt_out',
        organization_id: row.organization_id,
        business_id: row.business_id,
        inquiry_id: null,
        confirmation_code: row.confirmation_code,
        name: row.name,
        email: row.email,
        phone: row.phone,
        phone_digits: row.phone_digits,
        service_texts: row.service_texts,
        marketing_texts: row.marketing_texts,
        recorded_by: userData.user?.email ?? 'admin',
        notes: 'Recorded by admin from the SMS Consent Log',
      });
      if (insertError) throw insertError;
      await load();
    } catch (err) {
      console.error('Error recording opt-out:', err);
      setError('Failed to record the opt-out');
    } finally {
      setBusyPhone(null);
    }
  };

  const exportCsv = () => {
    const headers = [
      'Logged at (UTC)', 'Event', 'Name', 'Phone', 'Email', 'Confirmation code', 'Service texts', 'Promo texts',
      'Consent given at (UTC)', 'Consent version', 'Consent text', 'Page', 'IP address', 'Browser', 'Recorded by', 'Notes',
    ];
    const lines = visible.map((r) =>
      [
        r.created_at, r.event_type, r.name, r.phone, r.email, r.confirmation_code, r.service_texts, r.marketing_texts,
        r.consent_given_at, r.consent_version, r.consent_text, r.source_page, r.ip_address, r.user_agent, r.recorded_by, r.notes,
      ].map(csvCell).join(','),
    );
    const blob = new Blob([[headers.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sms-consent-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'opt_in', label: 'Opt-ins' },
    { id: 'opt_out', label: 'Opt-outs' },
    { id: 'active', label: 'Currently opted in' },
  ];

  return (
    <div className="max-w-6xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">SMS Consent Log</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Every opt-in and opt-out, kept as a permanent record. Entries cannot be edited or deleted.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            name="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, confirmation code, IP"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              filter === f.id
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            {rows.length === 0 ? 'No SMS consent has been recorded yet.' : 'No entries match.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {visible.map((row) => {
              const open = openId === row.id;
              const active = currentStatus.get(row.phone_digits) === 'opt_in';
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="w-36 shrink-0 text-xs text-slate-500">{formatWhen(row.created_at)}</span>
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-900">{row.name || '(no name)'}</span>
                    <span className="hidden sm:block w-36 shrink-0 text-sm text-slate-600">{row.phone}</span>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.event_type === 'opt_out' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {kindLabel(row)}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pl-11 space-y-3 text-sm">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {[
                          ['Phone', row.phone],
                          ['Email', row.email],
                          ['Confirmation code', row.confirmation_code],
                          ['Consent given', row.consent_given_at ? formatWhen(row.consent_given_at) : null],
                          ['Wording version', row.consent_version],
                          ['Page', row.source_page],
                          ['IP address', row.ip_address],
                          ['Browser', row.user_agent],
                          ['Recorded by', row.recorded_by],
                          ['Current status', active ? 'Opted in' : 'Opted out'],
                          ['Notes', row.notes],
                        ].map(([label, value]) =>
                          value ? (
                            <div key={label as string} className="min-w-0">
                              <dt className="text-xs text-slate-500">{label}</dt>
                              <dd className="text-slate-800 break-words">{value}</dd>
                            </div>
                          ) : null,
                        )}
                      </dl>
                      {row.consent_text && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Exact wording shown to the customer</p>
                          <p className="text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-line">
                            {row.consent_text}
                          </p>
                        </div>
                      )}
                      {active && (
                        <button
                          type="button"
                          onClick={() => markOptedOut(row)}
                          disabled={busyPhone === row.phone_digits}
                          className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                        >
                          {busyPhone === row.phone_digits ? 'Recording...' : 'Mark this number as opted out'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {rows.length >= FETCH_LIMIT && (
        <p className="text-xs text-slate-500 mt-2">Showing the latest {FETCH_LIMIT} entries. Older ones are kept; export or ask to widen this.</p>
      )}
    </div>
  );
}
