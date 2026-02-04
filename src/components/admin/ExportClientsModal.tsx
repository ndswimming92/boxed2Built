import { useState } from 'react';
import { Download, Mail, Phone, Copy, Check } from 'lucide-react';
import Modal from '../Modal';
import {
  type Client,
  type ClientExportOptions,
  exportClientsToCSV,
  downloadCSV,
  getEmailList,
  getPhoneList,
  updateLastCampaignDate
} from '../../services/clientService';

interface ExportClientsModalProps {
  clients: Client[];
  onClose: () => void;
}

export default function ExportClientsModal({ clients, onClose }: ExportClientsModalProps) {
  const [exportOptions, setExportOptions] = useState<ClientExportOptions>({
    includeName: true,
    includeEmail: true,
    includePhone: true,
    includeAddress: false,
    includeStatus: true,
    includeValueTier: true,
    includeJobCount: true,
    includeRevenue: true,
  });
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [copiedPhones, setCopiedPhones] = useState(false);
  const [markCampaign, setMarkCampaign] = useState(true);

  const emailOptInCount = clients.filter(c => c.email && c.marketing_email_opt_in).length;
  const smsOptInCount = clients.filter(c => c.phone && c.marketing_sms_opt_in).length;

  function handleExportCSV() {
    const csv = exportClientsToCSV(clients, exportOptions);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `clients-export-${timestamp}.csv`);

    if (markCampaign) {
      updateLastCampaignDate(clients.map(c => c.id));
    }

    onClose();
  }

  async function handleCopyEmails() {
    const emailList = getEmailList(clients);
    await navigator.clipboard.writeText(emailList);
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);

    if (markCampaign) {
      updateLastCampaignDate(clients.filter(c => c.email && c.marketing_email_opt_in).map(c => c.id));
    }
  }

  async function handleCopyPhones() {
    const phoneList = getPhoneList(clients);
    await navigator.clipboard.writeText(phoneList.join(', '));
    setCopiedPhones(true);
    setTimeout(() => setCopiedPhones(false), 2000);

    if (markCampaign) {
      updateLastCampaignDate(clients.filter(c => c.phone && c.marketing_sms_opt_in).map(c => c.id));
    }
  }

  function toggleOption(key: keyof ClientExportOptions) {
    setExportOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Modal isOpen onClose={onClose} title="Export Clients" size="medium">
      <div className="space-y-6">
        {/* Summary */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Export Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Total Clients</p>
              <p className="text-2xl font-bold text-blue-900">{clients.length}</p>
            </div>
            <div>
              <p className="text-blue-700">Email Opt-In</p>
              <p className="text-2xl font-bold text-blue-900">{emailOptInCount}</p>
            </div>
            <div>
              <p className="text-blue-700">SMS Opt-In</p>
              <p className="text-2xl font-bold text-blue-900">{smsOptInCount}</p>
            </div>
            <div>
              <p className="text-blue-700">Opt-In Rate</p>
              <p className="text-2xl font-bold text-blue-900">
                {clients.length > 0
                  ? Math.round((emailOptInCount / clients.length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Quick Export Actions */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">Quick Actions</h3>

          <button
            onClick={handleCopyEmails}
            disabled={emailOptInCount === 0}
            className="w-full flex items-center justify-between p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-3">
              {copiedEmails ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Mail className="w-5 h-5 text-gray-600" />
              )}
              <div className="text-left">
                <p className="font-medium text-gray-900">Copy Email List</p>
                <p className="text-sm text-gray-600">
                  {copiedEmails ? 'Copied to clipboard!' : `${emailOptInCount} email addresses (opt-in only)`}
                </p>
              </div>
            </div>
            <Copy className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={handleCopyPhones}
            disabled={smsOptInCount === 0}
            className="w-full flex items-center justify-between p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-3">
              {copiedPhones ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Phone className="w-5 h-5 text-gray-600" />
              )}
              <div className="text-left">
                <p className="font-medium text-gray-900">Copy Phone List</p>
                <p className="text-sm text-gray-600">
                  {copiedPhones ? 'Copied to clipboard!' : `${smsOptInCount} phone numbers (opt-in only)`}
                </p>
              </div>
            </div>
            <Copy className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* CSV Export Options */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">CSV Export Columns</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'includeName', label: 'Name' },
              { key: 'includeEmail', label: 'Email' },
              { key: 'includePhone', label: 'Phone' },
              { key: 'includeAddress', label: 'Address' },
              { key: 'includeStatus', label: 'Status' },
              { key: 'includeValueTier', label: 'Value Tier' },
              { key: 'includeJobCount', label: 'Job Count' },
              { key: 'includeRevenue', label: 'Revenue' },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  checked={exportOptions[key as keyof ClientExportOptions]}
                  onChange={() => toggleOption(key as keyof ClientExportOptions)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Campaign Tracking */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={markCampaign}
              onChange={(e) => setMarkCampaign(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="font-medium text-gray-900">Mark as Campaign</p>
              <p className="text-sm text-gray-600 mt-1">
                Update the last campaign date for these clients to help track communication frequency
              </p>
            </div>
          </label>
        </div>

        {/* Export to Platforms Help */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Export to Marketing Platforms</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Mailchimp:</strong> Copy email list and paste into audience import</li>
            <li>• <strong>Constant Contact:</strong> Download CSV and upload to contacts</li>
            <li>• <strong>SMS Services:</strong> Copy phone list for bulk messaging</li>
            <li>• <strong>CRM Systems:</strong> Download CSV with all fields for import</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>
    </Modal>
  );
}
