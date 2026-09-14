import { ShieldCheck } from 'lucide-react';
import PasskeyManager from '../../components/auth/PasskeyManager';

export default function SecurityPage() {
  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Security</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Manage how you sign in to the admin portal.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Passkeys</h2>
            <p className="text-sm text-slate-600">Sign in without a password.</p>
          </div>
        </div>

        <PasskeyManager
          accent="emerald"
          recoveryHint="If you lose your devices, you can still sign in with Google or your email and password."
        />

        <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Passkeys are tied to boxed2built.com, so they only work on the live site — not on a local
          dev server or a deploy preview.
        </p>
      </div>
    </div>
  );
}
