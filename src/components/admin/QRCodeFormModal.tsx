import React, { useState, useEffect } from 'react';
import { Wand2, Check, AlertCircle } from 'lucide-react';
import Modal from '../Modal';
import { QRCodeWithSchedules } from '../../services/qrCodeService';
import {
  createQRCode,
  updateQRCode,
  checkSlugAvailability,
  generateSlugFromTitle,
  getShortURL
} from '../../services/qrCodeService';
import QRCodeScheduleManager from './QRCodeScheduleManager';
import QRCodePreviewDownload from './QRCodePreviewDownload';
import { URLSelector } from '../ui/URLSelector';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  qrCode: QRCodeWithSchedules | null;
  businessId: string;
  onSuccess: () => void;
};

export default function QRCodeFormModal({ isOpen, onClose, qrCode, businessId, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'basic' | 'schedules' | 'preview'>('basic');
  const [loading, setLoading] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    default_destination_url: '',
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    if (qrCode) {
      setFormData({
        title: qrCode.title,
        slug: qrCode.slug,
        description: qrCode.description,
        default_destination_url: qrCode.default_destination_url,
        status: qrCode.status
      });
    } else {
      setFormData({
        title: '',
        slug: '',
        description: '',
        default_destination_url: '',
        status: 'active'
      });
    }
    setActiveTab('basic');
  }, [qrCode, isOpen]);

  useEffect(() => {
    const checkSlug = async () => {
      if (!formData.slug || formData.slug.length < 3) {
        setSlugAvailable(true);
        return;
      }

      setSlugChecking(true);
      try {
        const available = await checkSlugAvailability(formData.slug, qrCode?.id);
        setSlugAvailable(available);
      } catch (error) {
        console.error('Error checking slug:', error);
      } finally {
        setSlugChecking(false);
      }
    };

    const timeoutId = setTimeout(checkSlug, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.slug, qrCode?.id]);

  const handleGenerateSlug = () => {
    if (formData.title) {
      const generated = generateSlugFromTitle(formData.title);
      setFormData({ ...formData, slug: generated });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!slugAvailable) {
      alert('This slug is already taken. Please choose a different one.');
      return;
    }

    if (!formData.default_destination_url) {
      alert('Please select or enter a destination URL');
      return;
    }

    setLoading(true);
    try {
      if (qrCode) {
        await updateQRCode(qrCode.id, formData);
      } else {
        await createQRCode(businessId, formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving QR code:', error);
      alert('Failed to save QR code');
    } finally {
      setLoading(false);
    }
  };

  const shortURL = formData.slug ? getShortURL(formData.slug) : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={qrCode ? 'Edit QR Code' : 'Create QR Code'}>
      <div className="min-h-[600px] flex flex-col">
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('basic')}
              className={`pb-3 px-2 border-b-2 transition-colors ${
                activeTab === 'basic'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Basic Info
            </button>
            {qrCode && (
              <>
                <button
                  onClick={() => setActiveTab('schedules')}
                  className={`pb-3 px-2 border-b-2 transition-colors ${
                    activeTab === 'schedules'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Scheduled Redirects
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`pb-3 px-2 border-b-2 transition-colors ${
                    activeTab === 'preview'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Preview & Download
                </button>
              </>
            )}
          </div>
        </div>

        {activeTab === 'basic' && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input name="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Spring 2024 Promo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Slug *
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input name="slug"
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                        slugChecking
                          ? 'border-gray-300'
                          : slugAvailable
                          ? 'border-gray-300'
                          : 'border-red-300'
                      }`}
                      placeholder="spring-promo"
                      required
                    />
                    {formData.slug && !slugChecking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugAvailable ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateSlug}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    title="Generate from title"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                </div>
                {shortURL && (
                  <p className="text-sm text-gray-600 mt-1">
                    Short URL: <code className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{shortURL}</code>
                  </p>
                )}
                {!slugAvailable && (
                  <p className="text-sm text-red-600 mt-1">This slug is already taken</p>
                )}
              </div>

              <div>
                <URLSelector
                  value={formData.default_destination_url}
                  onChange={(url) => setFormData({ ...formData, default_destination_url: url })}
                  label="Default Destination URL"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Users will be redirected here when no active schedule matches
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Notes
                </label>
                <textarea name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Internal notes about this QR code..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input name="status"
                    type="checkbox"
                    checked={formData.status === 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-6">
                  Inactive QR codes will show a 404 error when scanned
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !slugAvailable}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : qrCode ? 'Update QR Code' : 'Create QR Code'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'schedules' && qrCode && (
          <QRCodeScheduleManager qrCode={qrCode} onUpdate={onSuccess} />
        )}

        {activeTab === 'preview' && qrCode && (
          <QRCodePreviewDownload qrCode={qrCode} />
        )}
      </div>
    </Modal>
  );
}
