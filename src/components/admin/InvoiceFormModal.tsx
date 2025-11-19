import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { Invoice, InvoiceLineItem } from '../../lib/supabase';
import {
  createInvoice,
  updateInvoice,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  getInvoice,
  markInvoiceAsSent,
  calculatePaymentTermsDueDate,
  getInvoiceSettings,
} from '../../services/invoiceService';

interface InvoiceFormModalProps {
  businessId: string;
  invoice?: Invoice | null;
  inquiryId?: string;
  jobId?: string;
  initialData?: {
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    client_address?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

interface LineItemForm {
  id?: string;
  item_type: 'labor' | 'material' | 'other';
  description: string;
  quantity: number;
  unit_price: number;
  is_taxable: boolean;
}

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: 'Net 15', label: 'Net 15 (15 days)' },
  { value: 'Net 30', label: 'Net 30 (30 days)' },
  { value: 'Net 45', label: 'Net 45 (45 days)' },
  { value: 'Net 60', label: 'Net 60 (60 days)' },
];

const INVOICE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'progress', label: 'Progress' },
  { value: 'final', label: 'Final' },
];

const TN_TAX_RATE = 9.25;

export default function InvoiceFormModal({
  businessId,
  invoice,
  inquiryId,
  jobId,
  initialData,
  onClose,
  onSaved,
}: InvoiceFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [invoiceType, setInvoiceType] = useState<'estimate' | 'deposit' | 'progress' | 'final' | 'general'>('general');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [taxOverride, setTaxOverride] = useState(false);
  const [manualTaxAmount, setManualTaxAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [lateFeesEnabled, setLateFeesEnabled] = useState(false);
  const [lateFeeType, setLateFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [lateFeeAmount, setLateFeeAmount] = useState(25);
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState(5);

  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    { item_type: 'labor', description: '', quantity: 1, unit_price: 0, is_taxable: false },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (invoiceDate && paymentTerms !== 'custom') {
      const calculatedDueDate = calculatePaymentTermsDueDate(invoiceDate, paymentTerms);
      setDueDate(calculatedDueDate);
    }
  }, [invoiceDate, paymentTerms]);

  const loadData = async () => {
    setLoading(true);
    try {
      const settings = await getInvoiceSettings(businessId);
      if (settings) {
        setPaymentTerms(settings.default_payment_terms);
        setTaxRate(settings.default_tax_rate);
        if (settings.invoice_notes_template) {
          setNotes(settings.invoice_notes_template);
        }
        setLateFeesEnabled(settings.enable_late_fees);
        setLateFeeType(settings.late_fee_type);
        setLateFeeAmount(settings.late_fee_amount);
        setLateFeeGraceDays(settings.late_fee_grace_days);
      }

      if (invoice) {
        const fullInvoice = await getInvoice(invoice.id);
        if (fullInvoice) {
          setInvoiceType(fullInvoice.invoice_type);
          setClientName(fullInvoice.client_name);
          setClientEmail(fullInvoice.client_email);
          setClientPhone(fullInvoice.client_phone || '');
          setClientAddress(fullInvoice.client_address || '');
          setInvoiceDate(fullInvoice.invoice_date);
          setPaymentTerms(fullInvoice.payment_terms);
          setDueDate(fullInvoice.due_date);
          setTaxRate(fullInvoice.tax_rate);
          setTaxOverride(fullInvoice.tax_override);
          setManualTaxAmount(fullInvoice.tax_amount);
          setNotes(fullInvoice.notes || '');
          setInternalNotes(fullInvoice.internal_notes || '');
          setLateFeesEnabled(fullInvoice.late_fee_enabled);
          setLateFeeType(fullInvoice.late_fee_type || 'fixed');
          setLateFeeAmount(fullInvoice.late_fee_amount || 0);
          setLateFeeGraceDays(fullInvoice.late_fee_grace_days || 5);

          if (fullInvoice.lineItems.length > 0) {
            setLineItems(
              fullInvoice.lineItems.map((item) => ({
                id: item.id,
                item_type: item.item_type,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                is_taxable: item.is_taxable,
              }))
            );
          }
        }
      } else if (initialData) {
        setClientName(initialData.client_name || '');
        setClientEmail(initialData.client_email || '');
        setClientPhone(initialData.client_phone || '');
        setClientAddress(initialData.client_address || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load invoice data' });
    } finally {
      setLoading(false);
    }
  };

  const addNewLineItem = () => {
    setLineItems([
      ...lineItems,
      { item_type: 'labor', description: '', quantity: 1, unit_price: 0, is_taxable: false },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItemField = (index: number, field: keyof LineItemForm, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'item_type') {
      updated[index].is_taxable = value === 'material';
    }

    setLineItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const taxableAmount = lineItems
      .filter((item) => item.is_taxable)
      .reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    let taxAmount = 0;
    if (taxOverride) {
      taxAmount = manualTaxAmount;
    } else {
      taxAmount = (taxableAmount * taxRate) / 100;
    }

    const total = subtotal + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  };

  const totals = calculateTotals();

  const handleSave = async (sendEmail: boolean = false) => {
    if (!clientName || !clientEmail || !dueDate) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    if (lineItems.length === 0 || lineItems.every((item) => !item.description)) {
      setMessage({ type: 'error', text: 'Please add at least one line item' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let invoiceId = invoice?.id;

      if (!invoiceId) {
        const newInvoice = await createInvoice({
          business_id: businessId,
          inquiry_id: inquiryId,
          job_id: jobId,
          invoice_type: invoiceType,
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone || undefined,
          client_address: clientAddress || undefined,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: paymentTerms,
          tax_rate: taxRate,
          notes: notes || undefined,
          internal_notes: internalNotes || undefined,
          late_fee_enabled: lateFeesEnabled,
          late_fee_type: lateFeesEnabled ? lateFeeType : undefined,
          late_fee_amount: lateFeesEnabled ? lateFeeAmount : undefined,
          late_fee_grace_days: lateFeesEnabled ? lateFeeGraceDays : undefined,
        });
        invoiceId = newInvoice.id;
      } else {
        await updateInvoice(invoiceId, {
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone || undefined,
          client_address: clientAddress || undefined,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: paymentTerms,
          tax_rate: taxRate,
          tax_override: taxOverride,
          tax_amount: taxOverride ? manualTaxAmount : undefined,
          notes: notes || undefined,
          internal_notes: internalNotes || undefined,
          late_fee_enabled: lateFeesEnabled,
          late_fee_type: lateFeesEnabled ? lateFeeType : undefined,
          late_fee_amount: lateFeesEnabled ? lateFeeAmount : undefined,
          late_fee_grace_days: lateFeesEnabled ? lateFeeGraceDays : undefined,
        });
      }

      const existingInvoice = await getInvoice(invoiceId);
      const existingLineItemIds = existingInvoice?.lineItems.map((item) => item.id) || [];

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        if (!item.description) continue;

        if (item.id) {
          await updateLineItem(item.id, {
            item_type: item.item_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            is_taxable: item.is_taxable,
            display_order: i,
          });
        } else {
          await addLineItem({
            invoice_id: invoiceId,
            item_type: item.item_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            is_taxable: item.is_taxable,
            display_order: i,
          });
        }
      }

      const currentLineItemIds = lineItems.filter((item) => item.id).map((item) => item.id);
      const deletedIds = existingLineItemIds.filter((id) => !currentLineItemIds.includes(id));
      for (const id of deletedIds) {
        await deleteLineItem(id);
      }

      if (sendEmail) {
        await markInvoiceAsSent(invoiceId);
      }

      setMessage({
        type: 'success',
        text: sendEmail ? 'Invoice saved and sent!' : 'Invoice saved successfully!',
      });

      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving invoice:', error);
      setMessage({ type: 'error', text: 'Failed to save invoice. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Loading invoice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-6xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {invoice ? 'Edit Invoice' : 'Create Invoice'}
            </h2>
            {invoice && <p className="text-sm text-slate-600 mt-1">{invoice.invoice_number}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
              {message.text}
            </p>
          </div>
        )}

        <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoice Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Type</label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {INVOICE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((term) => (
                      <option key={term.value} value={term.value}>
                        {term.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Billing Address</label>
                  <textarea
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
              <button
                type="button"
                onClick={addNewLineItem}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </button>
            </div>

            {lineItems.length > 0 && (
              <div className="grid grid-cols-12 gap-3 px-4 pb-2 mb-2">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</label>
                </div>
                <div className="col-span-5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Description</label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quantity</label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Unit Price</label>
                </div>
                <div className="col-span-1"></div>
              </div>
            )}

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-2">
                      <select
                        value={item.item_type}
                        onChange={(e) => updateLineItemField(index, 'item_type', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      >
                        <option value="labor">Labor</option>
                        <option value="material">Material</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItemField(index, 'description', e.target.value)}
                        placeholder="e.g., 5-piece bedroom set assembly"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItemField(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="1"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateLineItemField(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.is_taxable}
                        onChange={(e) => updateLineItemField(index, 'is_taxable', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                      />
                      <span className="text-slate-700">Taxable (TN materials only)</span>
                    </label>
                    <span className="text-slate-600 font-medium">
                      Line Total: ${(item.quantity * item.unit_price).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes (customer-facing)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Thank you for your business!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Internal Notes (admin only)</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Internal notes..."
                />
              </div>
            </div>

            <div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoice Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.taxableAmount > 0 && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Taxable Amount:</span>
                      <span>${totals.taxableAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax ({taxRate}%):</span>
                    <span className="font-medium">${totals.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 mt-2"></div>
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-slate-900">Total:</span>
                    <span className="font-bold text-emerald-600">${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-300">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={taxOverride}
                      onChange={(e) => setTaxOverride(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Override Tax Amount</span>
                  </label>
                  {taxOverride && (
                    <input
                      type="number"
                      value={manualTaxAmount}
                      onChange={(e) => setManualTaxAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Manual tax amount"
                      min="0"
                      step="0.01"
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    />
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input
                    type="checkbox"
                    checked={lateFeesEnabled}
                    onChange={(e) => setLateFeesEnabled(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Enable Late Fees</span>
                </label>
                {lateFeesEnabled && (
                  <div className="space-y-3 ml-6">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Late Fee Type & Amount
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={lateFeeType}
                          onChange={(e) => setLateFeeType(e.target.value as 'fixed' | 'percentage')}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="fixed">Fixed Amount ($)</option>
                          <option value="percentage">Percentage (%)</option>
                        </select>
                        <div className="flex-1 relative">
                          {lateFeeType === 'fixed' && (
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">
                              $
                            </span>
                          )}
                          <input
                            type="number"
                            value={lateFeeAmount}
                            onChange={(e) => setLateFeeAmount(parseFloat(e.target.value) || 0)}
                            placeholder={lateFeeType === 'fixed' ? '25.00' : '5.0'}
                            min="0"
                            step="0.01"
                            className={`w-full ${
                              lateFeeType === 'fixed' ? 'pl-7' : 'pl-3'
                            } pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500`}
                          />
                          {lateFeeType === 'percentage' && (
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">
                              %
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {lateFeeType === 'fixed'
                          ? 'A fixed dollar amount will be added to overdue invoices'
                          : 'A percentage of the total invoice amount will be added'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Grace Period (Days After Due Date)
                      </label>
                      <input
                        type="number"
                        value={lateFeeGraceDays}
                        onChange={(e) => setLateFeeGraceDays(parseInt(e.target.value) || 0)}
                        placeholder="5"
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Late fee applies {lateFeeGraceDays} day{lateFeeGraceDays !== 1 ? 's' : ''} after the
                        due date
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save as Draft
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            <Send className="w-5 h-5" />
            Save & Send
          </button>
        </div>
      </div>
    </div>
  );
}
