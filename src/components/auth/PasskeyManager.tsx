import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, KeyRound, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  deletePasskey,
  describePasskeyError,
  isPasskeyCeremonyCancelled,
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
  renamePasskey,
  type PasskeyListItem,
} from '../../services/passkeyService';

interface PasskeyManagerProps {
  /** Copy differs slightly between the two portals; the mechanics do not. */
  accent?: 'emerald' | 'blue';
  /** What to tell someone who loses every passkey. */
  recoveryHint: string;
}

const ACCENTS = {
  emerald: {
    button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/50',
    icon: 'text-emerald-600',
    chip: 'bg-emerald-100',
  },
  blue: {
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200',
    icon: 'text-blue-600',
    chip: 'bg-blue-100',
  },
} as const;

function formatDate(value?: string): string {
  if (!value) return 'never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PasskeyManager({ accent = 'emerald', recoveryHint }: PasskeyManagerProps) {
  const theme = ACCENTS[accent];

  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: listError } = await listPasskeys();
    if (listError) {
      setError(describePasskeyError(listError));
      return;
    }
    setPasskeys(data ?? []);
  }, []);

  // Feature detection belongs in an effect: the prerender pass runs with a
  // mocked DOM, so asking during render would answer for a browser that is not
  // there and crash `vite-react-ssg build`.
  useEffect(() => {
    const available = isPasskeySupported();
    setSupported(available);

    if (!available) {
      setLoading(false);
      return;
    }

    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const handleAdd = async () => {
    setError('');
    setNotice('');
    setBusy(true);

    const { error: registerError } = await registerPasskey();

    if (registerError) {
      // A dismissed system prompt is not a failure worth a red banner.
      if (!isPasskeyCeremonyCancelled(registerError)) {
        setError(describePasskeyError(registerError));
      }
      setBusy(false);
      return;
    }

    await refresh();
    setNotice('Passkey added.');
    setBusy(false);
  };

  const handleRename = async (passkeyId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    setError('');
    setBusy(true);

    const { error: renameError } = await renamePasskey(passkeyId, trimmed);
    if (renameError) {
      setError(describePasskeyError(renameError));
    } else {
      await refresh();
      setNotice('Passkey renamed.');
    }

    setRenamingId(null);
    setBusy(false);
  };

  const handleDelete = async (passkey: PasskeyListItem) => {
    const label = passkey.friendly_name || 'this passkey';
    const isLast = passkeys.length === 1;
    const warning = isLast
      ? `Remove ${label}? It is your only passkey, so you will need to sign in another way afterwards.`
      : `Remove ${label}? It will no longer be able to sign you in.`;

    if (!window.confirm(warning)) return;

    setError('');
    setBusy(true);

    const { error: deleteError } = await deletePasskey(passkey.id);
    if (deleteError) {
      setError(describePasskeyError(deleteError));
    } else {
      await refresh();
      setNotice('Passkey removed.');
    }

    setBusy(false);
  };

  if (supported === false) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          This browser does not support passkeys. {recoveryHint}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        A passkey signs you in with your fingerprint, face or device PIN instead of a password,
        and cannot be phished or reused on a fake site. {recoveryHint}
      </p>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert" aria-live="polite">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status" aria-live="polite">
          <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800">{notice}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading passkeys...
        </div>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-slate-500">No passkeys yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${theme.chip}`}>
                <KeyRound className={`h-4 w-4 ${theme.icon}`} aria-hidden="true" />
              </span>

              {renamingId === passkey.id ? (
                <input
                  type="text"
                  value={renameValue}
                  maxLength={120}
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => void handleRename(passkey.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleRename(passkey.id);
                    if (event.key === 'Escape') setRenamingId(null);
                  }}
                  aria-label="Passkey name"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {passkey.friendly_name || 'Unnamed passkey'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Added {formatDate(passkey.created_at)} &middot; Last used {formatDate(passkey.last_used_at)}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRenamingId(passkey.id);
                    setRenameValue(passkey.friendly_name || '');
                  }}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label={`Rename ${passkey.friendly_name || 'passkey'}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDelete(passkey)}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${passkey.friendly_name || 'passkey'}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={busy || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {busy ? 'Working...' : 'Add a passkey'}
      </button>
    </div>
  );
}
