import React, { useEffect, useState } from 'react';
import { getActiveSitePages, buildFullUrl, isValidUrl, type SitePage } from '../../services/sitePageService';
import { ExternalLink } from 'lucide-react';

interface URLSelectorProps {
  value: string;
  onChange: (url: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
}

const CUSTOM_URL_VALUE = '__custom__';

export function URLSelector({ value, onChange, error, label = 'Destination URL', required = true }: URLSelectorProps) {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customUrl, setCustomUrl] = useState('');

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (pages.length === 0 || !value) return;

    const matchingPage = pages.find(page => {
      const fullUrl = buildFullUrl(page.url_path);
      return fullUrl === value || page.url_path === value;
    });

    if (matchingPage) {
      setSelectedOption(matchingPage.id);
      setCustomUrl('');
    } else {
      setSelectedOption(CUSTOM_URL_VALUE);
      setCustomUrl(value);
    }
  }, [value, pages]);

  const loadPages = async () => {
    try {
      setIsLoading(true);
      const data = await getActiveSitePages();
      setPages(data);
    } catch (err) {
      console.error('Failed to load site pages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setSelectedOption(newValue);

    if (newValue === CUSTOM_URL_VALUE) {
      setCustomUrl('');
      onChange('');
    } else {
      const page = pages.find(p => p.id === newValue);
      if (page) {
        const fullUrl = buildFullUrl(page.url_path);
        onChange(fullUrl);
      }
    }
  };

  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setCustomUrl(newUrl);
    onChange(newUrl);
  };

  const getPreviewUrl = (): string => {
    if (selectedOption === CUSTOM_URL_VALUE) {
      return customUrl || 'Enter a custom URL';
    }

    const page = pages.find(p => p.id === selectedOption);
    if (page) {
      return buildFullUrl(page.url_path);
    }

    return 'Select a page';
  };

  const isCustomUrlValid = selectedOption !== CUSTOM_URL_VALUE || !customUrl || isValidUrl(customUrl);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <select
        value={selectedOption}
        onChange={handleOptionChange}
        disabled={isLoading}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required={required}
      >
        <option value="">Select a page...</option>
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {page.title}
          </option>
        ))}
        <option value={CUSTOM_URL_VALUE}>Custom URL</option>
      </select>

      {selectedOption === CUSTOM_URL_VALUE && (
        <div>
          <input
            type="url"
            value={customUrl}
            onChange={handleCustomUrlChange}
            placeholder="https://example.com/page"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              !isCustomUrlValid ? 'border-red-500' : 'border-gray-300'
            }`}
            required={required}
          />
          {!isCustomUrlValid && (
            <p className="mt-1 text-sm text-red-600">Please enter a valid URL</p>
          )}
        </div>
      )}

      {selectedOption && (
        <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <ExternalLink className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1">Preview URL:</p>
            <p className="text-sm text-gray-900 break-all">{getPreviewUrl()}</p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
