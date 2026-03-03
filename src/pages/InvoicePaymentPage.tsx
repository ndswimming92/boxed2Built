import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, Phone, Mail, MapPin, CreditCard, CheckCircle, AlertCircle, Package, Globe, Building2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BusinessBranding {
  business_name: string;
  founder_name: string | null;
  phone: string;
  email: string;
  website: string | null;
  logo_url: string | null;
  slogan: string | null;
}

interface BusinessAddress {
  street_address: string | null;
  address_locality: string;
  address_region: string;
  postal_code: string | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
  is_taxable: boolean;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_type: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes: string | null;
  status: string;
  payment_terms: string;
  business_id: string;
  lineItems: LineItem[];
}

export default function InvoicePaymentPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [branding, setBranding] = useState<BusinessBranding | null>(null);
  const [address, setAddress] = useState<BusinessAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (invoiceId) fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('is_active', true)
        .maybeSingle();

      if (invErr || !inv) {
        setError('Invoice not found.');
        setLoading(false);
        return;
      }

      const { data: items } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('display_order', { ascending: true });

      const { data: biz } = await supabase
        .from('business_info')
        .select('business_name, founder_name, phone, email, website, logo_url, slogan')
        .eq('id', inv.business_id)
        .maybeSingle();

      const { data: addr } = await supabase
        .from('business_address')
        .select('street_address, address_locality, address_region, postal_code')
        .eq('business_id', inv.business_id)
        .maybeSingle();

      setInvoice({ ...inv, lineItems: items || [] });
      setBranding(biz);
      setAddress(addr);
    } catch {
      setError('Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!invoiceId) return;
    setPaying(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ invoiceId }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || 'Failed to start checkout. Please try again.');
        return;
      }

      window.location.href = data.url;
    } catch {
      setError('Failed to connect to payment processor. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  const formatDate = (d: string) => {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h1>
          <p className="text-slate-500 text-sm">{error || 'This invoice link may be invalid or expired.'}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';
  const canPay = !isPaid && !isCancelled && invoice.amount_due > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding?.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={branding.business_name}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <p className="font-bold text-slate-900 text-lg leading-tight">
                  {branding?.business_name || 'Boxed2Built'}
                </p>
                {branding?.slogan && (
                  <p className="text-xs text-slate-500 leading-tight">{branding.slogan}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs text-slate-500">
              {branding?.phone && (
                <a href={`tel:${branding.phone}`} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                  <Phone className="w-3 h-3" />
                  {branding.phone}
                </a>
              )}
              {address && (
                <span className="hidden sm:flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {address.address_locality}, {address.address_region}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-slate-500 mb-1 uppercase tracking-wide font-medium">Invoice</p>
              <h1 className="text-3xl font-bold text-slate-900">{invoice.invoice_number}</h1>
              <p className="text-slate-500 mt-1 capitalize">{invoice.invoice_type} invoice</p>
            </div>
            <div className="text-right">
              {isPaid ? (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Paid in Full
                </span>
              ) : isCancelled ? (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full font-semibold text-sm">
                  Cancelled
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-semibold text-sm">
                  Payment Due
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-3">Billed To</p>
            <p className="font-semibold text-slate-900">{invoice.client_name}</p>
            {invoice.client_email && <p className="text-sm text-slate-500 mt-0.5">{invoice.client_email}</p>}
            {invoice.client_phone && <p className="text-sm text-slate-500 mt-0.5">{invoice.client_phone}</p>}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-3">From</p>
            <div className="space-y-1 min-w-0">
              <div className="flex items-start gap-2.5 mb-2">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  {branding?.website ? (
                    <a href={branding.website} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-900 leading-tight hover:text-emerald-700 transition-colors">
                      {branding?.business_name || 'Boxed2Built'}
                    </a>
                  ) : (
                    <p className="font-bold text-slate-900 leading-tight">{branding?.business_name || 'Boxed2Built'}</p>
                  )}
                </div>
              </div>
              {branding?.founder_name && (
                <div className="flex items-center gap-2.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-700 font-medium">{branding.founder_name}</p>
                </div>
              )}
              {address?.street_address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-500">{address.street_address}</p>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className={`w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0 ${address?.street_address ? 'invisible' : ''}`} />
                  <p className="text-sm text-slate-500">
                    {address.address_locality}, {address.address_region}{address.postal_code ? ` ${address.postal_code}` : ''}
                  </p>
                </div>
              )}
              {branding?.phone && (
                <div className="flex items-center gap-2.5 pt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={`tel:${branding.phone}`} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                    {branding.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')}
                  </a>
                </div>
              )}
              {branding?.email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={`mailto:${branding.email}`} className="text-sm text-slate-500 hover:text-slate-700 transition-colors truncate">
                    {branding.email}
                  </a>
                </div>
              )}
              {branding?.website && (
                <div className="flex items-center gap-2.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={branding.website} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-700 transition-colors truncate">
                    {branding.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:col-span-2 lg:col-span-1">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-3">Invoice Details</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Date</span>
                <span className="text-slate-900 font-medium">{formatDate(invoice.invoice_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date</span>
                <span className="text-slate-900 font-medium">{formatDate(invoice.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terms</span>
                <span className="text-slate-900 font-medium">{invoice.payment_terms}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Services</h2>
          </div>
          {invoice.lineItems.length > 0 ? (
            <>
              <div className="divide-y divide-slate-100">
                {invoice.lineItems.map((item) => (
                  <div key={item.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-medium">{item.description}</p>
                      <p className="text-sm text-slate-400 mt-0.5 capitalize">{item.item_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-slate-900 font-semibold">{formatCurrency(item.total)}</p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tax ({invoice.tax_rate}%)</span>
                    <span>{formatCurrency(invoice.tax_amount)}</span>
                  </div>
                )}
                {invoice.amount_paid > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Amount Paid</span>
                    <span>-{formatCurrency(invoice.amount_paid)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
                  <span>Total Due</span>
                  <span>{formatCurrency(invoice.amount_due)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              No line items on this invoice.
            </div>
          )}
        </div>

        {invoice.notes && (
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 mb-8">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-2">Notes</p>
            <p className="text-slate-600 text-sm whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {canPay && (
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-6 text-center">
            <p className="text-slate-500 text-sm mb-1">Amount Due</p>
            <p className="text-4xl font-bold text-slate-900 mb-6">{formatCurrency(invoice.amount_due)}</p>
            <button
              onClick={handlePayNow}
              disabled={paying}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-colors text-base"
            >
              {paying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting to Checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay Now — {formatCurrency(invoice.amount_due)}
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-2 mt-4 text-slate-400 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>Secured by Stripe. Your payment info is never stored on our servers.</span>
            </div>
          </div>
        )}

        {isPaid && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-green-800 text-lg">This invoice has been paid in full.</p>
            <p className="text-green-700 text-sm mt-1">Thank you for your payment!</p>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-700 text-sm">{branding?.business_name || 'Boxed2Built'}</p>
              {branding?.founder_name && (
                <p className="text-xs text-slate-500 mt-0.5">{branding.founder_name}, Owner</p>
              )}
              {address?.street_address && (
                <p className="text-xs text-slate-400 mt-0.5">{address.street_address}</p>
              )}
              {address && (
                <p className="text-xs text-slate-400">
                  {address.address_locality}, {address.address_region}{address.postal_code ? ` ${address.postal_code}` : ''}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">&copy; {new Date().getFullYear()} All rights reserved.</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5 text-xs text-slate-400">
              {branding?.phone && (
                <a href={`tel:${branding.phone}`} className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                  <Phone className="w-3 h-3" />
                  {branding.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')}
                </a>
              )}
              {branding?.email && (
                <a href={`mailto:${branding.email}`} className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                  <Mail className="w-3 h-3" />
                  {branding.email}
                </a>
              )}
              {branding?.website && (
                <a href={branding.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                  <Globe className="w-3 h-3" />
                  {branding.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
            <Link to="/terms-of-service" className="hover:text-slate-600 transition-colors">
              Terms of Service
            </Link>
            <span className="text-slate-200">&bull;</span>
            <Link to="/privacy-policy" className="hover:text-slate-600 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
