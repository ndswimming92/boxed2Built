import React, { useEffect, useState } from 'react';
import { supabase, BusinessInfo, BusinessAddress } from '../../lib/supabase';
import { Save, AlertCircle, CheckCircle, Building2, MapPin } from 'lucide-react';

export default function BusinessInfoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [businessInfo, setBusinessInfo] = useState<Partial<BusinessInfo>>({
    name: '',
    alternate_name: '',
    description: '',
    slogan: '',
    phone: '',
    email: '',
    website: '',
    founded_year: '',
    founder_name: '',
    price_range: '',
    currencies_accepted: 'USD',
    logo_url: '',
    image_url: '',
    hours_counter_duration_ms: 4500,
    hours_counter_frame_ms: 70,
  });

  const [address, setAddress] = useState<Partial<BusinessAddress>>({
    street_address: '',
    address_locality: '',
    address_region: '',
    postal_code: '',
    address_country: 'US',
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: info } = await supabase
        .from('business_info')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (info) {
        setBusinessInfo(info);

        const { data: addr } = await supabase
          .from('business_address')
          .select('*')
          .eq('business_id', info.id)
          .maybeSingle();

        if (addr) {
          setAddress(addr);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load business information' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      let businessId = businessInfo.id;

      if (businessId) {
        const { error: updateError } = await supabase
          .from('business_info')
          .update(businessInfo)
          .eq('id', businessId);

        if (updateError) throw updateError;
      } else {
        const { data: newBusiness, error: insertError } = await supabase
          .from('business_info')
          .insert([businessInfo])
          .select()
          .single();

        if (insertError) throw insertError;
        businessId = newBusiness.id;
        setBusinessInfo(newBusiness);
      }

      if (address.id) {
        const { error: updateAddrError } = await supabase
          .from('business_address')
          .update({ ...address, business_id: businessId })
          .eq('id', address.id);

        if (updateAddrError) throw updateAddrError;
      } else if (businessId) {
        const { error: insertAddrError } = await supabase
          .from('business_address')
          .insert([{ ...address, business_id: businessId }])
          .select()
          .single();

        if (insertAddrError) throw insertAddrError;
      }

      setMessage({ type: 'success', text: 'Business information saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save business information' });
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
    <div className="max-w-4xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Business Information</h1>
        <p className="text-sm sm:text-base text-slate-600">Manage your business details and contact information</p>
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
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Basic Information
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Business Name *
              </label>
              <input name="name"
                type="text"
                value={businessInfo.name || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Alternate Name
              </label>
              <input name="alternate_name"
                type="text"
                value={businessInfo.alternate_name || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, alternate_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description *
            </label>
            <textarea name="description"
              value={businessInfo.description || ''}
              onChange={(e) => setBusinessInfo({ ...businessInfo, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Slogan
            </label>
            <input name="slogan"
              type="text"
              value={businessInfo.slogan || ''}
              onChange={(e) => setBusinessInfo({ ...businessInfo, slogan: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hours Counter Duration (ms)
              </label>
              <input
                name="hours_counter_duration_ms"
                type="number"
                min={1000}
                max={12000}
                step={100}
                value={businessInfo.hours_counter_duration_ms ?? 4500}
                onChange={(e) => setBusinessInfo({ ...businessInfo, hours_counter_duration_ms: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">How long the home page hours flip animation runs.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hours Counter Tick Speed (ms)
              </label>
              <input
                name="hours_counter_frame_ms"
                type="number"
                min={30}
                max={250}
                step={5}
                value={businessInfo.hours_counter_frame_ms ?? 70}
                onChange={(e) => setBusinessInfo({ ...businessInfo, hours_counter_frame_ms: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">Higher number = slower visible digit updates.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone *
              </label>
              <input name="phone"
                type="tel"
                value={businessInfo.phone || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email *
              </label>
              <input name="email"
                type="email"
                value={businessInfo.email || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Website *
              </label>
              <input name="website"
                type="url"
                value={businessInfo.website || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, website: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Founded Year
              </label>
              <input name="founded_year"
                type="text"
                value={businessInfo.founded_year || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, founded_year: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="2023"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Founder Name
              </label>
              <input name="founder_name"
                type="text"
                value={businessInfo.founder_name || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, founder_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Price Range
              </label>
              <input name="price_range"
                type="text"
                value={businessInfo.price_range || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, price_range: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="$$"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Logo URL
              </label>
              <input name="logo_url"
                type="url"
                value={businessInfo.logo_url || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, logo_url: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Image URL
              </label>
              <input name="image_url"
                type="url"
                value={businessInfo.image_url || ''}
                onChange={(e) => setBusinessInfo({ ...businessInfo, image_url: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Address
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Street Address
            </label>
            <input name="street_address"
              type="text"
              value={address.street_address || ''}
              onChange={(e) => setAddress({ ...address, street_address: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                City *
              </label>
              <input name="address_locality"
                type="text"
                value={address.address_locality || ''}
                onChange={(e) => setAddress({ ...address, address_locality: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                State *
              </label>
              <input name="address_region"
                type="text"
                value={address.address_region || ''}
                onChange={(e) => setAddress({ ...address, address_region: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="TN"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                ZIP Code
              </label>
              <input name="postal_code"
                type="text"
                value={address.postal_code || ''}
                onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Country *
              </label>
              <input name="address_country"
                type="text"
                value={address.address_country || ''}
                onChange={(e) => setAddress({ ...address, address_country: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="US"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Latitude
              </label>
              <input name="latitude"
                type="number"
                step="any"
                value={address.latitude || ''}
                onChange={(e) => setAddress({ ...address, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Longitude
              </label>
              <input name="longitude"
                type="number"
                step="any"
                value={address.longitude || ''}
                onChange={(e) => setAddress({ ...address, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
