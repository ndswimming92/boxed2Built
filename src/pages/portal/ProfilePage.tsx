import { FormEvent, useEffect, useState } from 'react';
import { Check, Copy, Gift, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import PasskeyManager from '../../components/auth/PasskeyManager';
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
  const [copySuccess, setCopySuccess] = useState(false);

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

  const handleCopyReferralCode = async () => {
    if (!profile?.referral_code || typeof navigator === 'undefined' || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(profile.referral_code);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to copy referral code.');
    }
  };

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
        <div className="space-y-4">
          <section className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-50">
                  <Gift className="h-4 w-4" />
                  Referral Program
                </div>
                <h2 className="text-xl font-semibold">Give $25, Get $25</h2>
                <p className="max-w-2xl text-sm text-blue-50/90">Share your code with friends and family. When someone uses it to book with Boxed2Built, they get <span className="font-semibold text-white">$25 off</span> their first job — and you'll receive <span className="font-semibold text-white">$25 off</span> your next job with us too.</p>
              </div>

              {profile.referral_code ? (
                <button
                  type="button"
                  onClick={handleCopyReferralCode}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                  {copySuccess ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copySuccess ? 'Copied!' : profile.referral_code}
                </button>
              ) : (
                <div className="rounded-lg border border-dashed border-white/40 px-4 py-3 text-sm text-blue-50/90">
                  Your referral code will appear here once it has been assigned.
                </div>
              )}
            </div>
          </section>

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

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <KeyRound className="h-5 w-5 text-blue-600" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Passkeys</h2>
                <p className="text-sm text-slate-600">Sign in without a password.</p>
              </div>
            </div>

            <PasskeyManager
              accent="blue"
              recoveryHint="If you lose your devices, you can still sign in with Google."
            />
          </section>
        </div>
      ) : null}
    </PortalLayout>
  );
}
