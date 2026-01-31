import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function OrganizationSwitcher() {
  const {
    currentOrganization,
    userOrganizations,
    currentRole,
    setCurrentOrganization,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Building2 className="w-5 h-5 text-orange-600" />
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">
            {currentOrganization.name}
          </div>
          {currentRole && (
            <div className={`text-xs ${getRoleColor(currentRole)}`}>
              {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && userOrganizations.length > 1 && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {userOrganizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setCurrentOrganization(org);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                  org.id === currentOrganization.id ? 'bg-orange-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{org.name}</div>
                    <div className="text-xs text-gray-500">@{org.slug}</div>
                  </div>
                </div>
                {org.id === currentOrganization.id && (
                  <Check className="w-4 h-4 text-orange-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
