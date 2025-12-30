import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

export default function CommandPalette({ isOpen, onClose, navigation }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return navigation;

    const searchTerms = query.toLowerCase().split(' ');
    return navigation.filter(item => {
      const itemName = item.name.toLowerCase();
      return searchTerms.every(term => itemName.includes(term));
    });
  }, [query, navigation]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' && filteredItems.length > 0) {
        e.preventDefault();
        const selectedItem = filteredItems[selectedIndex];
        navigate(selectedItem.href);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, navigate, onClose]);

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleItemClick = (href: string) => {
    navigate(href);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
        <div
          className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search admin pages..."
              className="flex-1 bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto"
          >
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {filteredItems.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;
                  const isCurrentPage = location.pathname === item.href;

                  return (
                    <button
                      key={item.href}
                      onClick={() => handleItemClick(item.href)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-left">{item.name}</span>
                      {isCurrentPage && (
                        <span className="ml-auto text-xs text-slate-500">Current</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 font-mono">↑</kbd>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 font-mono">↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 font-mono">↵</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 font-mono">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
