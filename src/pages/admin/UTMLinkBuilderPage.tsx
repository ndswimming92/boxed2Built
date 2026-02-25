import React, { useMemo, useState } from 'react';
import { Copy, Link as LinkIcon, Sparkles } from 'lucide-react';
import { createUTMUrl, UTMParams } from '../../utils/utm';

interface Option {
  label: string;
  value: string;
}

const customValue = '__custom__';
const customDestinationValue = '__custom_destination__';
const siteOrigin = 'https://boxed2built.com';

const destinationPageOptions: Option[] = [
  { label: 'Home', value: '/' },
  { label: 'About', value: '/about' },
  { label: 'Services', value: '/services' },
  { label: 'Furniture Assembly Service', value: '/services/furniture-assembly' },
  { label: 'TV Mounting Service', value: '/services/tv-mounting' },
  { label: 'Gallery', value: '/gallery' },
  { label: 'FAQ', value: '/faq' },
  { label: 'Partners', value: '/partners' },
  { label: 'Contact', value: '/contact' },
  { label: 'Request Lookup', value: '/lookup-request' },
  { label: 'Privacy Policy', value: '/privacy-policy' },
  { label: 'Terms of Service', value: '/terms-of-service' },
  { label: 'Custom URL...', value: customDestinationValue },
];

const sourceOptions: Option[] = [
  { label: 'Instagram', value: 'instagram' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Newsletter', value: 'newsletter' },
  { label: 'Google Ads', value: 'google' },
  { label: 'Partner', value: 'partner' },
  { label: 'Custom...', value: customValue },
];

const mediumOptions: Option[] = [
  { label: 'Social', value: 'social' },
  { label: 'Paid Social', value: 'paid_social' },
  { label: 'Email', value: 'email' },
  { label: 'Referral', value: 'referral' },
  { label: 'Influencer', value: 'influencer' },
  { label: 'CPC', value: 'cpc' },
  { label: 'Custom...', value: customValue },
];

const campaignOptions: Option[] = [
  { label: 'Spring Promo', value: 'spring_promo' },
  { label: 'Referral Push', value: 'referral_push' },
  { label: 'Holiday Offer', value: 'holiday_offer' },
  { label: 'Review Campaign', value: 'review_campaign' },
  { label: 'Always On', value: 'always_on' },
  { label: 'Custom...', value: customValue },
];

const contentOptions: Option[] = [
  { label: 'Post', value: 'post' },
  { label: 'Story', value: 'story' },
  { label: 'Bio Link', value: 'bio_link' },
  { label: 'Button CTA', value: 'button_cta' },
  { label: 'Custom...', value: customValue },
];

const termOptions: Option[] = [
  { label: 'Branded', value: 'branded' },
  { label: 'Retargeting', value: 'retargeting' },
  { label: 'Local Service', value: 'local_service' },
  { label: 'Custom...', value: customValue },
];

const channelDefaults: Record<string, { source: string; medium: string }> = {
  instagram_post: { source: 'instagram', medium: 'social' },
  facebook_post: { source: 'facebook', medium: 'social' },
  linkedin_post: { source: 'linkedin', medium: 'social' },
  email_blast: { source: 'newsletter', medium: 'email' },
  paid_social: { source: 'facebook', medium: 'paid_social' },
};

const normalizeUTMValue = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '_');

const getValue = (selected: string, custom: string): string => {
  if (!selected) {
    return '';
  }

  if (selected === customValue) {
    return normalizeUTMValue(custom);
  }

  return selected;
};

const buildSiteUrl = (path: string): string => {
  if (!path || path === '/') {
    return siteOrigin;
  }

  return `${siteOrigin}${path}`;
};

export default function UTMLinkBuilderPage() {
  const [selectedDestinationPath, setSelectedDestinationPath] = useState('/');
  const [customDestinationUrl, setCustomDestinationUrl] = useState('');

  const [selectedChannel, setSelectedChannel] = useState('instagram_post');

  const [source, setSource] = useState('instagram');
  const [sourceCustom, setSourceCustom] = useState('');

  const [medium, setMedium] = useState('social');
  const [mediumCustom, setMediumCustom] = useState('');

  const [campaign, setCampaign] = useState('always_on');
  const [campaignCustom, setCampaignCustom] = useState('');

  const [content, setContent] = useState('post');
  const [contentCustom, setContentCustom] = useState('');

  const [term, setTerm] = useState('');
  const [termCustom, setTermCustom] = useState('');

  const [copied, setCopied] = useState(false);

  const destinationUrl = useMemo(() => {
    if (selectedDestinationPath === customDestinationValue) {
      return customDestinationUrl;
    }

    return buildSiteUrl(selectedDestinationPath);
  }, [selectedDestinationPath, customDestinationUrl]);

  const canBuildUrl = useMemo(() => {
    try {
      // eslint-disable-next-line no-new
      new URL(destinationUrl);
      return true;
    } catch {
      return false;
    }
  }, [destinationUrl]);

  const utmParams = useMemo<UTMParams>(() => {
    const nextParams: UTMParams = {
      source: getValue(source, sourceCustom),
      medium: getValue(medium, mediumCustom),
      campaign: getValue(campaign, campaignCustom),
    };

    const contentValue = getValue(content, contentCustom);
    const termValue = getValue(term, termCustom);

    if (contentValue) {
      nextParams.content = contentValue;
    }

    if (termValue) {
      nextParams.term = termValue;
    }

    return nextParams;
  }, [source, sourceCustom, medium, mediumCustom, campaign, campaignCustom, content, contentCustom, term, termCustom]);

  const generatedUrl = useMemo(() => {
    if (!canBuildUrl || !utmParams.source || !utmParams.medium || !utmParams.campaign) {
      return '';
    }

    return createUTMUrl(destinationUrl, utmParams);
  }, [destinationUrl, canBuildUrl, utmParams]);

  const applyChannel = (key: string) => {
    setSelectedChannel(key);

    const defaults = channelDefaults[key];
    if (!defaults) {
      return;
    }

    setSource(defaults.source);
    setSourceCustom('');
    setMedium(defaults.medium);
    setMediumCustom('');
  };

  const copyGeneratedUrl = async () => {
    if (!generatedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error('Failed to copy UTM URL:', error);
    }
  };

  const renderSelect = (
    label: string,
    value: string,
    onChange: (nextValue: string) => void,
    options: Option[],
    customInputValue: string,
    onCustomChange: (nextValue: string) => void,
    isOptional?: boolean
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {isOptional ? ' (optional)' : ' *'}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
      >
        {isOptional && <option value="">None</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {value === customValue && (
        <input
          type="text"
          value={customInputValue}
          onChange={(event) => onCustomChange(event.target.value)}
          placeholder="Type custom value"
          className="mt-2 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        />
      )}
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">UTM Link Builder</h1>
        <p className="text-slate-600">Create trackable marketing links with consistent dropdown-based UTM naming.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          Quick channel defaults
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Posting destination</label>
            <select
              value={selectedChannel}
              onChange={(event) => applyChannel(event.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="instagram_post">Instagram Post</option>
              <option value="facebook_post">Facebook Post</option>
              <option value="linkedin_post">LinkedIn Post</option>
              <option value="email_blast">Email Blast</option>
              <option value="paid_social">Paid Social Ad</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => applyChannel(selectedChannel)}
              className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Apply defaults
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Destination URL *</label>
            <select
              value={selectedDestinationPath}
              onChange={(event) => setSelectedDestinationPath(event.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {destinationPageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {selectedDestinationPath === customDestinationValue && (
              <input
                type="url"
                value={customDestinationUrl}
                onChange={(event) => setCustomDestinationUrl(event.target.value)}
                placeholder="https://your-site.com/landing-page"
                className="mt-2 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            )}

            <p className="text-sm text-slate-500 mt-2">Selected URL: {destinationUrl || 'Choose a destination page'}</p>
            {!canBuildUrl && <p className="text-sm text-red-600 mt-2">Please select a valid destination URL.</p>}
          </div>

          {renderSelect('UTM Source', source, setSource, sourceOptions, sourceCustom, setSourceCustom)}
          {renderSelect('UTM Medium', medium, setMedium, mediumOptions, mediumCustom, setMediumCustom)}
          {renderSelect('UTM Campaign', campaign, setCampaign, campaignOptions, campaignCustom, setCampaignCustom)}
          {renderSelect('UTM Content', content, setContent, contentOptions, contentCustom, setContentCustom, true)}
          {renderSelect('UTM Term', term, setTerm, termOptions, termCustom, setTermCustom, true)}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-sm text-slate-500 mb-2">Generated URL</p>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base text-slate-900 break-all">{generatedUrl || 'Fill required values to generate URL'}</p>
            </div>
            <button
              type="button"
              onClick={copyGeneratedUrl}
              disabled={!generatedUrl}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600 flex items-start gap-2">
          <LinkIcon className="w-4 h-4 mt-0.5 text-slate-500" />
          <p>Custom text entries are normalized to lowercase and spaces are replaced with underscores for clean analytics.</p>
        </div>
      </div>
    </div>
  );
}
