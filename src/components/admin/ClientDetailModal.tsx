import { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, Calendar, DollarSign, Briefcase, Tag, FileText, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
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
  updateClient
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

  useEffect(() => {
    loadClientDetails();
  }, [client.id]);

  async function loadClientDetails() {
    try {
      setLoading(true);
      const [historyData, notesData] = await Promise.all([
        getClientHistory(client.id, client.email),
        getClientNotes(client.id)
      ]);
      setHistory(historyData);
      setNotes(notesData);
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
      const userId = 'current-user-id'; // TODO: Get from auth context
      await createClientNote(client.id, client.organization_id, newNote, userId);
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
      await updateMarketingPreferences(client.id, emailOptIn, smsOptIn);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }

  async function handleAddTag() {
    if (!newTag.trim()) return;

    try {
      await addClientTags(client.id, [newTag.trim()]);
      setNewTag('');
      onClose(); // Refresh parent
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  }

  async function handleRemoveTag(tag: string) {
    try {
      await removeClientTags(client.id, [tag]);
      onClose(); // Refresh parent
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
              <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusBadgeColor(client.client_status)}`}>
                  {client.client_status}
                </span>
                <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full capitalize">
                  {client.client_value_tier.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Customer Since</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(client.first_contact_date)}</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {client.email && (
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{client.address}</span>
              </div>
            )}
            {client.source && (
              <div className="flex items-center gap-2 text-gray-700">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm">Source: {client.source}</span>
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm font-medium">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(client.total_revenue)}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Briefcase className="w-4 h-4" />
              <p className="text-sm font-medium">Number of Jobs</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{client.job_count}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm font-medium">Avg Job Value</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(client.average_job_value)}</p>
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
            {client.last_campaign_date && (
              <p className="text-sm text-gray-600 mt-4">
                Last campaign: {formatDate(client.last_campaign_date)}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {client.tags && client.tags.length > 0 ? (
              client.tags.map((tag) => (
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
        {client.client_status === 'dormant' && (
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
