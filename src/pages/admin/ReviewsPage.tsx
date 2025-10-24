import React, { useEffect, useState } from 'react';
import { supabase, CustomerReview } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, Star } from 'lucide-react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const emptyReview: Partial<CustomerReview> = {
    author_name: '',
    review_body: '',
    rating_value: 5,
    date_published: new Date().toISOString().split('T')[0],
    is_featured: false,
    is_verified: false,
    is_active: true,
  };

  const [formData, setFormData] = useState<Partial<CustomerReview>>(emptyReview);

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
          .from('customer_reviews')
          .select('*')
          .eq('business_id', businessInfo.id)
          .order('date_published', { ascending: false });

        if (data) {
          setReviews(data);
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('customer_reviews')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Review updated!' });
      } else {
        const { error } = await supabase
          .from('customer_reviews')
          .insert([{ ...formData, business_id: businessId }]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Review added!' });
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData(emptyReview);
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save review' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this review?')) return;

    try {
      const { error } = await supabase.from('customer_reviews').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Review deleted!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete review' });
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
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Customer Reviews</h1>
          <p className="text-slate-600">Manage customer testimonials</p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => { setIsAdding(true); setFormData(emptyReview); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Review
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
              <Star className="w-5 h-5 text-emerald-600" />
              {editingId ? 'Edit Review' : 'Add Review'}
            </h2>
            <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData(emptyReview); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Author Name *</label>
                <input type="text" value={formData.author_name || ''} onChange={(e) => setFormData({ ...formData, author_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date Published *</label>
                <input type="date" value={formData.date_published || ''} onChange={(e) => setFormData({ ...formData, date_published: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Review *</label>
              <textarea value={formData.review_body || ''} onChange={(e) => setFormData({ ...formData, review_body: e.target.value })} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rating *</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating_value: rating })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        rating <= (formData.rating_value || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_featured || false} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Featured</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_verified || false} onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })} className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Verified</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_active !== false} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2">
                <Save className="w-5 h-5" /> Save
              </button>
              <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData(emptyReview); }} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Star className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No reviews yet</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className={`bg-white rounded-xl border border-slate-200 p-6 ${!review.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{review.author_name}</h3>
                    {review.is_featured && <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded">Featured</span>}
                    {review.is_verified && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">Verified</span>}
                    {!review.is_active && <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded">Inactive</span>}
                  </div>
                  <div className="flex gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating_value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <p className="text-slate-600 mb-2">{review.review_body}</p>
                  <p className="text-sm text-slate-500">{new Date(review.date_published).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingId(review.id); setFormData(review); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(review.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
