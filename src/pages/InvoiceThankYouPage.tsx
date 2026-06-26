import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Phone, Mail, Package, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getInvoiceInternalSearch, trackInvoiceClick } from '../utils/utm';
import { usePageMeta } from '../hooks/usePageMeta';

interface BusinessBranding {
  business_name: string;
  phone: string;
  email: string;
  logo_url: string | null;
  slogan: string | null;
}

interface InvoiceSummary {
  invoice_number: string;
  client_name: string;
  total_amount: number;
  business_id: string;
}

export default function InvoiceThankYouPage() {
  usePageMeta({
    title: 'Payment Received | Boxed2Built',
    description: 'Your Boxed2Built invoice payment has been received. Thank you!',
    noIndex: true,
  });

  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [branding, setBranding] = useState<BusinessBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) fetchData();
  }, [invoiceId]);

  const fetchData = async () => {
    try {
      const { data: inv } = await supabase
        .from('invoices')
        .select('invoice_number, client_name, total_amount, business_id')
        .eq('id', invoiceId)
        .maybeSingle();

      if (inv) {
        setInvoice(inv);

        const { data: biz } = await supabase
          .from('business_info')
          .select('business_name, phone, email, logo_url, slogan')
          .eq('id', inv.business_id)
          .maybeSingle();

        setBranding(biz);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding?.business_name}
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
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="relative inline-flex mb-8">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-emerald-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-3">Payment Received!</h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-8">
            Thank you{invoice?.client_name ? `, ${invoice.client_name.split(' ')[0]}` : ''}! Your payment has been successfully processed.
          </p>

          {invoice && (
            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 mb-8 text-left space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Invoice</span>
                <span className="font-semibold text-slate-900">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(invoice.total_amount)}</span>
              </div>
              {sessionId && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-xs text-slate-400 truncate max-w-[160px]">{sessionId}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400 text-center">
                  A receipt has been sent to your email address.
                </p>
              </div>
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4 mb-8">
            <p className="text-emerald-800 text-sm font-medium mb-1">What happens next?</p>
            <p className="text-emerald-700 text-sm">
              We'll reach out shortly to confirm the details of your service. If you have any questions, don't hesitate to contact us.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {branding?.phone && (
              <a
                href={`tel:${branding.phone}`}
                onClick={() => trackInvoiceClick('phone', branding!.phone)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors text-sm"
              >
                <Phone className="w-4 h-4" />
                {branding.phone}
              </a>
            )}
            {branding?.email && (
              <a
                href={`mailto:${branding.email}`}
                onClick={() => trackInvoiceClick('email', branding!.email)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                {branding.email}
              </a>
            )}
          </div>

          <div className="mt-8">
            <Link
              to={`/${getInvoiceInternalSearch('thankyou_home')}`}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-600 transition-colors"
            >
              Visit our website
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-400">
          {branding?.business_name || 'Boxed2Built'} &copy; {new Date().getFullYear()} &mdash; All rights reserved.
        </div>
      </footer>
    </div>
  );
}
