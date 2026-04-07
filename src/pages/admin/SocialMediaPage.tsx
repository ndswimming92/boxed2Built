import React, { useEffect, useState } from 'react';
import { supabase, SocialMedia } from '../../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Save, X, Share2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SocialMediaPage() {
  const [socialMedia, setSocialMedia] = useState<SocialMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const emptyProfile: Partial<SocialMedia> = {
    platform: '',
    profile_url: '',
    is_active: true,
    display_order: 0,
  };

  const [formData, setFormData] = useState<Partial<SocialMedia>>(emptyProfile);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (businessInfo) {
        setBusinessId(businessInfo.id);
        const { data } = await supabase
          .from('social_media')
          .select('*')
          .eq('business_id', businessInfo.id)
          .order('display_order', { ascending: true });

        if (data) {
          setSocialMedia(data);
        }
      }
    } catch (error) {
      console.error('Error fetching social media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('social_media')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Social media profile updated!' });
      } else {
        const { error } = await supabase
          .from('social_media')
          .insert([{ ...formData, business_id: businessId }]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Social media profile added!' });
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData(emptyProfile);
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save social media profile' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this social media profile?')) return;

    try {
      const { error } = await supabase.from('social_media').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Social media profile deleted!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete social media profile' });
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
    <div className="max-w-4xl px-0">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Social Media</h1>
          <p className="text-sm sm:text-base text-slate-600">Manage your social media profiles</p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => { setIsAdding(true); setFormData({ ...emptyProfile, display_order: socialMedia.length }); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-5 h-5" />
            Add Profile
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {(isAdding || editingId) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-600" />
              {editingId ? 'Edit Profile' : 'Add Profile'}
            </h2>
            <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData(emptyProfile); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Platform *</label>
              <input name="platform" type="text" value={formData.platform || ''} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} placeholder="e.g., Facebook, Instagram, YouTube" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Profile URL *</label>
              <input name="profile_url" type="url" value={formData.profile_url || ''} onChange={(e) => setFormData({ ...formData, profile_url: e.target.value })} placeholder="https://..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2">
                <Save className="w-5 h-5" /> Save
              </button>
              <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData(emptyProfile); }} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Social Media Profiles</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {socialMedia.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              No social media profiles added yet
            </div>
          ) : (
            socialMedia.map((profile) => (
              <div key={profile.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900">{profile.platform}</p>
                  <a href={profile.profile_url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline">
                    {profile.profile_url}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingId(profile.id); setFormData(profile); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(profile.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
