import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { openEmailClient, openSMSClient } from '../../services/communicationService';
import {
  portalAccountLinkingService,
  type VerificationMethod,
} from '../../services/portalAccountLinkingService';

export default function PortalLinkAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyMode = useMemo(() => Boolean(token), [token]);

  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleRequestLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const result = await portalAccountLinkingService.startLinkRequest(email, verificationMethod);

      if (result.status === 'no_match') {
        setError('No customer records matched that email. Please verify the address or contact support.');
        return;
      }

      if (result.status === 'ambiguous') {
        setMessage('We found multiple possible records. Your request was sent to the admin review queue.');
        return;
      }

      if (!result.token || !result.deliveryTarget) {
        setError('Unable to generate verification link. Please try again.');
        return;
      }

      const linkUrl = `${appBaseUrl}/portal/link-account?token=${encodeURIComponent(result.token)}`;
      if (verificationMethod === 'email') {
        openEmailClient(
          result.deliveryTarget,
          'Verify your Boxed2Built portal account',
          `Use this secure link to connect your portal account: ${linkUrl}\n\nThis link expires in 15 minutes and can only be used once.`
        );
      } else {
        openSMSClient(
          result.deliveryTarget,
          `Your Boxed2Built verification link: ${linkUrl} (expires in 15 minutes).`
        );
      }

      setMessage(`Verification link prepared for ${verificationMethod.toUpperCase()}. Complete verification to finish linking.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start account linking.');
    } finally {
      setLoading(false);
    }
  };

  const handleConsumeToken = async () => {
    if (!token) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const result = await portalAccountLinkingService.consumeLinkToken(token);
      if (result.status === 'invalid_token') {
        setError('This verification link is invalid, expired, or already used.');
        return;
      }

      if (result.status === 'already_linked') {
        setError('This customer record is already linked to another portal account.');
        return;
      }

      setMessage(`Account linked successfully. Connected ${result.linkedJobs} jobs and ${result.linkedInvoices} invoices.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Link your existing account records</h1>
        <p className="mt-2 text-sm text-slate-600">
          If this is your first login, verify ownership to attach historical customer, job, and invoice records.
        </p>

        {verifyMode ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-700">Click below to validate your secure one-time token.</p>
            <button
              type="button"
              onClick={handleConsumeToken}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Validating…' : 'Validate link token'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequestLink} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Verification method</legend>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="verificationMethod"
                    checked={verificationMethod === 'email'}
                    onChange={() => setVerificationMethod('email')}
                  />
                  Email magic link
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="verificationMethod"
                    checked={verificationMethod === 'sms'}
                    onChange={() => setVerificationMethod('sms')}
                  />
                  SMS magic link
                </label>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Preparing…' : 'Send verification link'}
            </button>
          </form>
        )}

        {message ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <Link to="/portal/dashboard" className="text-blue-700 hover:underline">Return to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
