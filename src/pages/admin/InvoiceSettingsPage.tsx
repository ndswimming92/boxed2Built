import React, { useState, useEffect } from 'react';
import { Settings, Save, DollarSign, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getInvoiceSettings, updateInvoiceSettings } from '../../services/invoiceService';

export default function InvoiceSettingsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [invoicePrefix, setInvoicePrefix] = useState('B2B');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(1);
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('Net 30');
  const [defaultDueDays, setDefaultDueDays] = useState(30);
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);
  const [enableLateFees, setEnableLateFees] = useState(false);
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState(5);
  const [lateFeeType, setLateFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [lateFeeAmount, setLateFeeAmount] = useState(25);
  const [invoiceNotesTemplate, setInvoiceNotesTemplate] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bizData } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (bizData) {
        setBusinessId(bizData.id);
        const settings = await getInvoiceSettings(bizData.id);

        if (settings) {
          setInvoicePrefix(settings.invoice_prefix);
          setNextInvoiceNumber(settings.next_invoice_number);
          setDefaultPaymentTerms(settings.default_payment_terms);
          setDefaultDueDays(settings.default_due_days);
          setDefaultTaxRate(settings.default_tax_rate);
          setEnableLateFees(settings.enable_late_fees);
          setLateFeeGraceDays(settings.late_fee_grace_days);
          setLateFeeType(settings.late_fee_type);
          setLateFeeAmount(settings.late_fee_amount);
          setInvoiceNotesTemplate(settings.invoice_notes_template || '');
          setInvoiceFooter(settings.invoice_footer || '');
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setMessage(null);

    try {
      await updateInvoiceSettings(businessId, {
        invoice_prefix: invoicePrefix,
        next_invoice_number: nextInvoiceNumber,
        default_payment_terms: defaultPaymentTerms,
        default_due_days: defaultDueDays,
        default_tax_rate: defaultTaxRate,
        enable_late_fees: enableLateFees,
        late_fee_grace_days: lateFeeGraceDays,
        late_fee_type: lateFeeType,
        late_fee_amount: lateFeeAmount,
        invoice_notes_template: invoiceNotesTemplate || null,
        invoice_footer: invoiceFooter || null,
      });

      setMessage({ type: 'success', text: 'Invoice settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-900">Invoice Settings</h1>
        </div>
        <p className="text-slate-600">Configure your invoice defaults and preferences</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Invoice Numbering</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Prefix</label>
              <input name="invoicePrefix"
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="B2B"
              />
              <p className="text-xs text-slate-500 mt-1">
                This prefix will be used for all invoice numbers (e.g., B2B-001)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Next Invoice Number</label>
              <input name="nextInvoiceNumber"
                type="number"
                value={nextInvoiceNumber}
                onChange={(e) => setNextInvoiceNumber(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                min="1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Preview: {invoicePrefix}-{String(nextInvoiceNumber).padStart(3, '0')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Default Payment Terms</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Terms</label>
              <select name="defaultPaymentTerms"
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="Due Upon Completion">Due Upon Completion</option>
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="Net 15">Net 15 (15 days)</option>
                <option value="Net 30">Net 30 (30 days)</option>
                <option value="Net 45">Net 45 (45 days)</option>
                <option value="Net 60">Net 60 (60 days)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Default Due Days</label>
              <input name="defaultDueDays"
                type="number"
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(parseInt(e.target.value) || 30)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1">
                Number of days until payment is due (used for automatic due date calculation)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Tax Settings</h2>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Tennessee Tax Law</p>
                <p>
                  In Tennessee, labor services (like furniture assembly) are NOT subject to sales tax. Only tangible
                  goods and materials are taxable. The default rate is 0% for labor services. If you sell materials,
                  mark those line items as taxable.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Tax Rate (%)
            </label>
            <input name="defaultTaxRate"
              type="number"
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              min="0"
              max="100"
              step="0.01"
            />
            <p className="text-xs text-slate-500 mt-1">
              Spring Hill, TN combined sales tax rate is 9.25% (only applies to taxable materials)
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Late Fee Settings</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableLateFees"
                checked={enableLateFees}
                onChange={(e) => setEnableLateFees(e.target.checked)}
                className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="enableLateFees" className="text-sm font-medium text-slate-700">
                Enable Late Fees by Default
              </label>
            </div>

            {enableLateFees && (
              <div className="ml-8 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Grace Period (days)</label>
                  <input name="lateFeeGraceDays"
                    type="number"
                    value={lateFeeGraceDays}
                    onChange={(e) => setLateFeeGraceDays(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    min="0"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Number of days after the due date before late fees are applied
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Late Fee Type</label>
                  <select name="lateFeeType"
                    value={lateFeeType}
                    onChange={(e) => setLateFeeType(e.target.value as 'fixed' | 'percentage')}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Late Fee Amount {lateFeeType === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <div className="relative">
                    {lateFeeType === 'fixed' && (
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    )}
                    <input name="lateFeeAmount"
                      type="number"
                      value={lateFeeAmount}
                      onChange={(e) => setLateFeeAmount(parseFloat(e.target.value) || 0)}
                      className={`w-full ${
                        lateFeeType === 'fixed' ? 'pl-10' : 'pl-4'
                      } pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500`}
                      min="0"
                      step={lateFeeType === 'percentage' ? '0.01' : '1'}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Invoice Templates</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Default Invoice Notes
              </label>
              <textarea name="invoiceNotesTemplate"
                value={invoiceNotesTemplate}
                onChange={(e) => setInvoiceNotesTemplate(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Thank you for your business! Payment is due within the terms specified above."
              />
              <p className="text-xs text-slate-500 mt-1">
                This note will appear on all new invoices (customer-facing)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Invoice Footer
              </label>
              <textarea name="invoiceFooter"
                value={invoiceFooter}
                onChange={(e) => setInvoiceFooter(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Boxed2Built - Professional Furniture Assembly | www.boxed2built.com"
              />
              <p className="text-xs text-slate-500 mt-1">This text will appear at the bottom of invoices</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
