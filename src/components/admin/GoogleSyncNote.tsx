import { Link2 } from 'lucide-react';

export default function GoogleSyncNote({ synced }: { synced: boolean }) {
  return synced ? (
    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
      <Link2 className="w-3 h-3 flex-shrink-0" />
      Syncs to Google Business Profile
    </p>
  ) : (
    <p className="text-xs text-slate-400 mt-1">Local only — not sent to Google Business Profile</p>
  );
}
