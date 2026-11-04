import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, Copy, Mail, Phone, Search, UserPlus } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { createClientRecord } from '../../services/clientService';
import { getPartnerCodes, getPartnerLeads } from '../../services/partnerLeadService';
import { PARTNER_STATUS_LABELS } from '../../utils/partnerLeads';
import type { PartnerCode, PartnerLead } from '../../types/partnerLeads';

interface Props {
  organizationId: string;
  /** Called after a lead is converted, so the customers list can refresh. */
  onConverted?: () => void;
}

/** Every email already on a regular customer, lowercased, read in pages. */
async function fetchCustomerEmails(organizationId: string): Promise<Set<string>> {
  const emails = new Set<string>();
  const size = 1000;
  for (let request = 0; request < 50; request += 1) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, email')
      .eq('organization_id', organizationId)
      .order('id')
      .range(request * size, request * size + size - 1);
    if (error) throw new Error(`Failed to load customers: ${error.message}`);
    const page = data || [];
    for (const row of page) if (row.email) emails.add(row.email.trim().toLowerCase());
    if (page.length < size) break;
  }
  return emails;
}

function wasReachedOut(lead: PartnerLead): boolean {
  return (lead.emails_sent ?? 0) > 0 || Boolean(lead.last_emailed_at);
}

/**
 * Partner leads that have been emailed, shown as profiles beside (never inside)
 * the regular customer list. Nothing is copied: each profile is read from the
 * lead itself, so a corrected address or a newly made code shows up here too.
 */
export default function PartnerLeadProfiles({ organizationId, onConverted }: Props) {
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [codes, setCodes] = useState<Map<string, PartnerCode>>(new Map());
  const [customerEmails, setCustomerEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allLeads, emails] = await Promise.all([
          getPartnerLeads(organizationId),
          fetchCustomerEmails(organizationId),
        ]);
        const reached = allLeads.filter(wasReachedOut);
        const couponRows = await getPartnerCodes(reached.map((lead) => lead.coupon_id ?? '')).catch(() => []);
        if (cancelled) return;
        setLeads(reached);
        setCustomerEmails(emails);
        setCodes(new Map(couponRows.map((coupon) => [coupon.id, coupon])));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load partner leads');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadKey]);

  const { profiles, hiddenAsCustomers } = useMemo(() => {
    // A lead whose email is already a regular customer is that customer, not a second profile.
    const isCustomer = (lead: PartnerLead) =>
      Boolean(lead.email) && customerEmails.has(lead.email!.trim().toLowerCase());
    const visible = leads.filter((lead) => !isCustomer(lead));
    const term = search.trim().toLowerCase();
    const matches = term
      ? visible.filter((lead) =>
          [lead.name, lead.contact_name, lead.email, lead.phone, codes.get(lead.coupon_id ?? '')?.code]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term)),
        )
      : visible;
    return { profiles: matches, hiddenAsCustomers: leads.length - visible.length };
  }, [leads, customerEmails, codes, search]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 1500);
    } catch {
      // Copying is a convenience; the code is on screen.
    }
  }

  async function convert(lead: PartnerLead) {
    if (!lead.email && !lead.phone) return;
    setConverting(lead.id);
    setMessage(null);
    try {
      await createClientRecord(organizationId, {
        name: lead.contact_name?.trim() || lead.name,
        email: lead.email,
        phone: lead.phone,
        client_status: 'lead',
        source: 'Partner outreach',
        tags: ['partner-lead', lead.name],
        marketing_email_opt_in: false,
      });
      setMessage({ type: 'success', text: `${lead.contact_name || lead.name} is now a regular customer.` });
      setReloadKey((key) => key + 1);
      onConverted?.();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Could not convert this lead' });
    } finally {
      setConverting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 text-sm text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg">
        These are partner leads you have emailed. They are kept apart from your customers: they are not counted in
        customer totals, exports, merges or marketing. Manage and email them from{' '}
        <Link to="/admin/partner-leads" className="font-medium underline">
          Partner Leads
        </Link>
        .
      </div>

      <div className="relative">
        <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, company, email, phone or code"
          className="w-full py-2 pl-9 pr-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
      )}

      <p className="text-sm text-gray-600">
        {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'}
        {hiddenAsCustomers > 0 && ` · ${hiddenAsCustomers} already in your customers`}
      </p>

      {profiles.length === 0 ? (
        <div className="p-8 text-sm text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
          {leads.length === 0 ? 'No partner leads have been emailed yet.' : 'No partner leads match.'}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Referral code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((lead) => {
                const coupon = lead.coupon_id ? codes.get(lead.coupon_id) : undefined;
                return (
                  <tr key={lead.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {lead.contact_name || lead.name}
                      {lead.contact_title && <div className="text-xs font-normal text-gray-500">{lead.contact_title}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {lead.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {lead.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          {lead.email}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {lead.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {lead.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {coupon ? (
                        <button
                          type="button"
                          onClick={() => copyCode(coupon.code)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                          title="Copy code"
                        >
                          {coupon.code}
                          {copied === coupon.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span className="font-sans text-gray-500">· used {coupon.times_used}×</span>
                        </button>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{PARTNER_STATUS_LABELS[lead.status]}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => convert(lead)}
                        disabled={converting === lead.id || (!lead.email && !lead.phone)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {converting === lead.id ? 'Converting…' : 'Convert to customer'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
