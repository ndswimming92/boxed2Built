import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import { customerPortalService, PortalServiceError, type CustomerPortalProfile } from '../../services/customerPortalService';

export default function PortalProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await customerPortalService.getMyProfile();
        setProfile(data);
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
      } catch (err) {
        if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
          navigate('/portal/login?error=session_expired', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage('');

    try {
      const updated = await customerPortalService.updateMyProfile({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      setProfile(updated);
      setSuccessMessage('Profile saved successfully.');
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout title="My Profile" subtitle="Update your contact details">
      {loading ? <p className="text-sm text-slate-600">Loading profile...</p> : null}
      {!loading && error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error && profile ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {successMessage ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
          ) : null}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">Full name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email (read-only)</label>
            <input
              id="email"
              type="email"
              value={profile.email || ''}
              disabled
              className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      ) : null}
    </PortalLayout>
  );
}
