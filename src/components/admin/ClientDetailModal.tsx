import { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, DollarSign, Briefcase, Tag, FileText, AlertCircle, Pencil, Check, Gift, Copy, Users, Plus, Minus } from 'lucide-react';
import Modal from '../Modal';
import {
  type Client,
  type ClientHistory,
  type ClientNote,
  getClientHistory,
  getClientNotes,
  createClientNote,
  updateMarketingPreferences,
  addClientTags,
  removeClientTags,
  updateClient,
  getReferredClients,
  addReferralCredit,
  redeemReferralCredit,
} from '../../services/clientService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
}

export default function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const [history, setHistory] = useState<ClientHistory | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(client.marketing_email_opt_in);
  const [smsOptIn, setSmsOptIn] = useState(client.marketing_sms_opt_in);

  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [editEmail, setEditEmail] = useState(client.email ?? '');
  const [editPhone, setEditPhone] = useState(client.phone ?? '');
  const [editAddress, setEditAddress] = useState(client.address ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [saveInfoError, setSaveInfoError] = useState<string | null>(null);
  const [currentClient, setCurrentClient] = useState<Client>(client);
  const [referredClients, setReferredClients] = useState<Client[]>([]);
  const [codeCopied, setCodeCopied] = useState(false);
  const [creditAmount, setCreditAmount] = useState('25');
  const [creditAction, setCreditAction] = useState<'add' | 'redeem' | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditMessage, setCreditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadClientDetails();
  }, [client.id]);

  async function loadClientDetails() {
    try {
      setLoading(true);
      const [historyData, notesData, referredData] = await Promise.all([
        getClientHistory(currentClient.id, currentClient.email),
        getClientNotes(currentClient.id),
        getReferredClients(currentClient.id),
      ]);
      setHistory(historyData);
      setNotes(notesData);
      setReferredClients(referredData);
    } catch (error) {
      console.error('Error loading client details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;

    try {
      setSavingNote(true);
      const userId = 'current-user-id';
      await createClientNote(currentClient.id, currentClient.organization_id, newNote, userId);
      setNewNote('');
      await loadClientDetails();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleUpdatePreferences() {
    try {
      await updateMarketingPreferences(currentClient.id, emailOptIn, smsOptIn);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }

  async function handleSaveInfo() {
    if (!editName.trim()) return;
    try {
      setSavingInfo(true);
      setSaveInfoError(null);
      const updated = await updateClient(currentClient.id, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
      });
      setCurrentClient(updated);
      setEditingInfo(false);
    } catch (error) {
      console.error('Error saving client info:', error);
      setSaveInfoError('Failed to save changes. Please try again.');
    } finally {
      setSavingInfo(false);
    }
  }

  function handleCancelEdit() {
    setEditName(currentClient.name);
    setEditEmail(currentClient.email ?? '');
    setEditPhone(currentClient.phone ?? '');
    setEditAddress(currentClient.address ?? '');
    setSaveInfoError(null);
    setEditingInfo(false);
  }

  async function handleAddTag() {
    if (!newTag.trim()) return;

    try {
      await addClientTags(currentClient.id, [newTag.trim()]);
      setNewTag('');
      onClose();
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  }

  async function handleRemoveTag(tag: string) {
    try {
      await removeClientTags(currentClient.id, [tag]);
      onClose();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  }

  function formatCurrency(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

    return maskFinancialValue(formatted);
  }

  function formatDate(date: string | null): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatDateTime(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function copyReferralCode() {
    if (!currentClient.referral_code) return;
    navigator.clipboard.writeText(currentClient.referral_code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    });
  }

  async function handleCreditAction() {
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) return;

    setCreditLoading(true);
    setCreditMessage(null);
    try {
      let updated: Client;
      if (creditAction === 'add') {
        updated = await addReferralCredit(currentClient.id, amount);
        setCreditMessage({ type: 'success', text: `$${amount.toFixed(2)} credit added successfully.` });
      } else {
        updated = await redeemReferralCredit(currentClient.id, amount);
        setCreditMessage({ type: 'success', text: `$${amount.toFixed(2)} credit redeemed successfully.` });
      }
      setCurrentClient(updated);
      setCreditAction(null);
      setCreditAmount('25');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update credit.';
      setCreditMessage({ type: 'error', text: msg });
    } finally {
      setCreditLoading(false);
    }
  }

  const allActivities = [
    ...(history?.inquiries.map(i => ({ type: 'inquiry', date: i.created_at, data: i })) || []),
    ...(history?.jobs.map(j => ({ type: 'job', date: j.created_at, data: j })) || []),
    ...(history?.invoices.map(inv => ({ type: 'invoice', date: inv.created_at, data: inv })) || [])
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'repeat': return 'bg-yellow-100 text-yellow-800';
      case 'dormant': return 'bg-orange-100 text-orange-800';
      case 'lead': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Client Details" size="large">
      <div className="space-y-6">
        {/* Client Overview */}
        <div className="p-6 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{currentClient.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusBadgeColor(currentClient.client_status)}`}>
                  {currentClient.client_status}
                </span>
                <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full capitalize">
                  {currentClient.client_value_tier.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-600">Customer Since</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(currentClient.first_contact_date)}</p>
              </div>
              {!editingInfo && (
                <button
                  onClick={() => setEditingInfo(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Contact Info — View or Edit */}
          {editingInfo ? (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>
              {saveInfoError && (
                <p className="text-sm text-red-600">{saveInfoError}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveInfo}
                  disabled={savingInfo || !editName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingInfo ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={savingInfo}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {currentClient.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{currentClient.email}</span>
                </div>
              )}
              {currentClient.phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{currentClient.phone}</span>
                </div>
              )}
              {currentClient.address && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{currentClient.address}</span>
                </div>
              )}
              {currentClient.source && (
                <div className="flex items-center gap-2 text-gray-700">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">Source: {currentClient.source}</span>
                </div>
              )}
              {!currentClient.email && !currentClient.phone && !currentClient.address && !currentClient.source && (
                <p className="text-sm text-gray-500 col-span-2">No contact information on file.</p>
              )}
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm font-medium">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentClient.total_revenue)}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Briefcase className="w-4 h-4" />
              <p className="text-sm font-medium">Number of Jobs</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{currentClient.job_count}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm font-medium">Avg Job Value</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentClient.average_job_value)}</p>
          </div>
        </div>

        {/* Referral Program */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Referral Program</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
              <p className="text-xs font-medium text-blue-700 mb-1">Referral Code</p>
              {currentClient.referral_code ? (
                <button
                  onClick={copyReferralCode}
                  className="flex items-center gap-1.5 mx-auto px-3 py-1.5 text-sm font-mono font-bold text-blue-800 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {codeCopied ? 'Copied!' : currentClient.referral_code}
                </button>
              ) : (
                <span className="text-xs text-gray-400">Not assigned</span>
              )}
            </div>
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-center">
              <p className="text-xs font-medium text-green-700 mb-1">Available Credit</p>
              <p className="text-xl font-bold text-green-800">${(currentClient.referral_credit_balance ?? 0).toFixed(2)}</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <p className="text-xs font-medium text-gray-600 mb-1">Lifetime Redeemed</p>
              <p className="text-xl font-bold text-gray-800">${(currentClient.referral_credit_used ?? 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Referred Clients */}
          {referredClients.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-700">Clients Referred ({referredClients.length})</p>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {referredClients.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit Management */}
          <div className="border-t border-gray-100 pt-4">
            {creditMessage && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${creditMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {creditMessage.text}
              </div>
            )}

            {creditAction ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 font-medium">
                  {creditAction === 'add' ? 'Add' : 'Redeem'} $
                </span>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleCreditAction}
                  disabled={creditLoading}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creditLoading ? 'Saving...' : 'Confirm'}
                </button>
                <button
                  onClick={() => { setCreditAction(null); setCreditMessage(null); }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => { setCreditAction('add'); setCreditMessage(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Credit
                </button>
                <button
                  onClick={() => { setCreditAction('redeem'); setCreditMessage(null); }}
                  disabled={(currentClient.referral_credit_balance ?? 0) <= 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Redeem Credit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Marketing Preferences */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Email Marketing</p>
                  <p className="text-sm text-gray-600">Receive promotional emails</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEmailOptIn(!emailOptIn);
                  handleUpdatePreferences();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailOptIn ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailOptIn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">SMS Marketing</p>
                  <p className="text-sm text-gray-600">Receive text messages</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSmsOptIn(!smsOptIn);
                  handleUpdatePreferences();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  smsOptIn ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    smsOptIn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {currentClient.last_campaign_date && (
              <p className="text-sm text-gray-600 mt-4">
                Last campaign: {formatDate(currentClient.last_campaign_date)}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {currentClient.tags && currentClient.tags.length > 0 ? (
              currentClient.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-500">No tags yet</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Tag
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : allActivities.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No activity history</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {allActivities.map((activity, index) => (
                <div key={`${activity.type}-${index}`} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'inquiry' ? 'bg-blue-100' :
                      activity.type === 'job' ? 'bg-green-100' :
                      'bg-purple-100'
                    }`}>
                      {activity.type === 'inquiry' ? <Mail className="w-4 h-4 text-blue-600" /> :
                       activity.type === 'job' ? <Briefcase className="w-4 h-4 text-green-600" /> :
                       <DollarSign className="w-4 h-4 text-purple-600" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.type === 'inquiry' && 'Form Inquiry'}
                      {activity.type === 'job' && `Job: ${activity.data.job_type || 'General'}`}
                      {activity.type === 'invoice' && `Invoice ${activity.data.invoice_number || ''}`}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {activity.type === 'inquiry' && `${activity.data.furniture_type || 'General inquiry'} - ${activity.data.pieces || 0} pieces`}
                      {activity.type === 'job' && `${activity.data.job_description || 'No description'} - ${activity.data.job_status || 'pending'}`}
                      {activity.type === 'invoice' && `${activity.data.status} - ${formatCurrency(activity.data.total_amount || 0)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(activity.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Relationship Notes</h3>

          {/* Add Note Form */}
          <div className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this client..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900">{note.note}</p>
                  <p className="text-xs text-gray-500 mt-2">{formatDateTime(note.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Re-engagement Suggestions (for dormant clients) */}
        {currentClient.client_status === 'dormant' && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-900">Re-engagement Opportunity</h4>
                <p className="text-sm text-orange-700 mt-1">
                  This client hasn't been contacted in over 90 days. Consider reaching out with:
                </p>
                <ul className="text-sm text-orange-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Seasonal promotion or special offer</li>
                  <li>Check-in on previous work</li>
                  <li>New service announcement</li>
                  <li>Personalized loyalty discount</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
