import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, X, ChevronDown, Loader2, AlertCircle, MapPin, Mail, Phone } from 'lucide-react';
import { getAllClientsIncludingTest, type Client } from '../../services/clientService';
import ClientFormModal from './ClientFormModal';

/** The parts of a client profile a caller needs to show who is linked. */
export interface PickedClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface ClientPickerProps {
  organizationId: string | null;
  /** Client this record is linked to, or null when nobody is picked yet. */
  selectedClientId: string | null;
  /** Known details for selectedClientId, so the summary isn't blank while the list loads. */
  selectedClientDetails?: PickedClient | null;
  onSelect: (client: Client) => void;
  onClear: () => void;
  /** Prefills the Add Client form when a client is created from here. */
  newClientSeed?: { name?: string; email?: string; phone?: string; address?: string };
  disabled?: boolean;
}

// Enough to scroll through without rendering every profile of a long client list.
const MAX_RESULTS = 50;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

function matchesQuery(client: Client, term: string, digits: string): boolean {
  if (client.name?.toLowerCase().includes(term)) return true;
  if (client.email?.toLowerCase().includes(term)) return true;
  if (client.address?.toLowerCase().includes(term)) return true;
  // A typed phone number rarely matches the stored punctuation, so compare digits.
  if (digits.length >= 3 && client.phone && digitsOnly(client.phone).includes(digits)) return true;
  return false;
}

/** Puts what was typed into the search box into the field it most likely belongs in. */
function seedFromQuery(query: string): { name?: string; email?: string; phone?: string } {
  const trimmed = query.trim();
  if (!trimmed) return {};
  if (trimmed.includes('@')) return { email: trimmed };
  if (!/[a-z]/i.test(trimmed) && digitsOnly(trimmed).length >= 7) return { phone: trimmed };
  return { name: trimmed };
}

export default function ClientPicker({
  organizationId,
  selectedClientId,
  selectedClientDetails,
  onSelect,
  onClear,
  newClientSeed,
  disabled = false,
}: ClientPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    getAllClientsIncludingTest(organizationId)
      .then((rows) => {
        if (!cancelled) setClients(rows);
      })
      .catch((err) => {
        console.error('Error loading clients for the picker:', err);
        if (!cancelled) setLoadError('Could not load your saved clients. Type the details in below instead.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  // Clicking anywhere else puts the field back to its summary state.
  useEffect(() => {
    if (!searching) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSearching(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [searching]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    const digits = digitsOnly(term);
    return clients.filter((client) => matchesQuery(client, term, digits));
  }, [clients, query]);

  const visibleResults = results.slice(0, MAX_RESULTS);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Keep the arrow-key highlight in view as it moves past the fold.
  useEffect(() => {
    if (!searching) return;
    listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlight, searching]);

  const selectedClient: PickedClient | null = selectedClientId
    ? clients.find((client) => client.id === selectedClientId) ??
      (selectedClientDetails?.id === selectedClientId ? selectedClientDetails : null)
    : null;

  const openSearch = () => {
    if (disabled) return;
    setQuery('');
    setSearching(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const chooseClient = (client: Client) => {
    onSelect(client);
    setSearching(false);
    setQuery('');
  };

  const openCreateModal = () => {
    setSearching(false);
    setShowCreateModal(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, visibleResults.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const client = visibleResults[highlight];
      if (client) {
        chooseClient(client);
      } else if (!loading && organizationId) {
        // Nothing matched what they typed, so the useful next step is creating them.
        openCreateModal();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSearching(false);
    }
  };

  // What was just typed into the search wins over the seed the caller passed in,
  // since it is the more recent statement of who this client is.
  const createSeed = {
    ...Object.fromEntries(Object.entries(newClientSeed ?? {}).filter(([, value]) => Boolean(value))),
    ...seedFromQuery(query),
  };

  const activeOptionId = visibleResults[highlight] ? `client-option-${visibleResults[highlight].id}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      {selectedClient && !searching ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{selectedClient.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              {selectedClient.email && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{selectedClient.email}</span>
                </span>
              )}
              {selectedClient.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  {selectedClient.phone}
                </span>
              )}
              {selectedClient.address && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{selectedClient.address}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={openSearch}
              disabled={disabled}
              className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              Change
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              title="Unlink this client. The details already filled in stay as they are."
              aria-label="Unlink client"
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search saved clients"
            aria-expanded={searching}
            aria-controls="client-picker-results"
            aria-activedescendant={searching ? activeOptionId : undefined}
            aria-autocomplete="list"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearching(true);
            }}
            onFocus={() => setSearching(true)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? 'Loading your clients...' : 'Search saved clients by name, email or phone'}
            className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
        </div>
      )}

      {searching && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {visibleResults.length > 0 ? (
            <ul
              id="client-picker-results"
              ref={listRef}
              role="listbox"
              aria-label="Saved clients"
              className="max-h-64 overflow-y-auto"
            >
              {visibleResults.map((client, index) => (
                <li
                  key={client.id}
                  id={`client-option-${client.id}`}
                  role="option"
                  aria-selected={index === highlight}
                  data-highlighted={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseClient(client)}
                  className={`px-4 py-2.5 cursor-pointer transition-colors ${
                    index === highlight ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{client.name}</span>
                    {client.is_test && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 rounded flex-shrink-0">
                        Test
                      </span>
                    )}
                    {client.job_count > 0 && (
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {client.job_count} {client.job_count === 1 ? 'job' : 'jobs'}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {[client.email, client.phone, client.address].filter(Boolean).join(' · ') ||
                      'No contact details on file'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p id="client-picker-results" className="px-4 py-3 text-sm text-slate-500">
              {loading
                ? 'Loading your clients...'
                : !organizationId
                ? 'Your client list is not available right now — type the details in below instead.'
                : clients.length === 0
                ? 'No clients saved yet.'
                : `No saved client matches "${query.trim()}".`}
            </p>
          )}

          {results.length > visibleResults.length && (
            <p className="px-4 py-1.5 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
              Showing {visibleResults.length} of {results.length} — keep typing to narrow it down.
            </p>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!organizationId}
            title={organizationId ? undefined : 'Available once your organization has loaded.'}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-slate-50 border-t border-slate-200 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            Add a new client
            <span className="font-normal text-slate-500">— type it in or scan a photo</span>
          </button>
        </div>
      )}

      {loadError && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          {loadError}
        </p>
      )}

      {/* Portalled so this dialog is not stacked inside whichever modal opened the picker. */}
      {showCreateModal &&
        organizationId &&
        createPortal(
          <ClientFormModal
            organizationId={organizationId}
            initialValues={createSeed}
            onClose={() => setShowCreateModal(false)}
            onCreated={(client) => {
              setShowCreateModal(false);
              setClients((current) => [client, ...current.filter((row) => row.id !== client.id)]);
              chooseClient(client);
            }}
          />,
          document.body
        )}
    </div>
  );
}
