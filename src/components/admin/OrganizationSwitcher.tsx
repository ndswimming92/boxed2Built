import { useState, useRef } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AnchoredPanel from '../ui/AnchoredPanel';

export function OrganizationSwitcher() {
  const {
    currentOrganization,
    userOrganizations,
    currentRole,
    setCurrentOrganization,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!currentOrganization || userOrganizations.length === 0) {
    return null;
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-yellow-600';
      case 'admin':
        return 'text-orange-600';
      case 'member':
        return 'text-blue-600';
      case 'viewer':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex max-w-full items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Building2 className="w-5 h-5 flex-shrink-0 text-orange-600" />
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-medium text-gray-900">
            {currentOrganization.name}
          </div>
          {currentRole && (
            <div className={`text-xs ${getRoleColor(currentRole)}`}>
              {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-500 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      <AnchoredPanel
        anchorRef={buttonRef}
        open={isOpen && userOrganizations.length > 1}
        onClose={() => setIsOpen(false)}
        width={256}
        align="right"
        role="menu"
        aria-label="Switch organization"
        className="bg-white border border-gray-200 rounded-lg shadow-lg"
      >
        <div className="overflow-y-auto py-1">
          {userOrganizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                setCurrentOrganization(org);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                org.id === currentOrganization.id ? 'bg-orange-50' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{org.name}</div>
                  <div className="truncate text-xs text-gray-500">@{org.slug}</div>
                </div>
              </div>
              {org.id === currentOrganization.id && (
                <Check className="w-4 h-4 flex-shrink-0 text-orange-600" />
              )}
            </button>
          ))}
        </div>
      </AnchoredPanel>
    </div>
  );
}
