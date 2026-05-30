import { useEffect } from 'react';

interface PageMetaConfig {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  noIndex?: boolean;
}

const setOrCreateMetaTag = (selector: string, attributeName: 'name' | 'property', attributeValue: string, content: string) => {
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

export const setPageMeta = ({
  title,
  description,
  canonicalUrl,
  ogTitle,
  ogDescription,
  twitterTitle,
  twitterDescription,
  noIndex,
}: PageMetaConfig) => {
  document.title = title;

  setOrCreateMetaTag('meta[name="description"]', 'name', 'description', description);

  if (noIndex) {
    setOrCreateMetaTag('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    return;
  }

  setOrCreateMetaTag('meta[property="og:title"]', 'property', 'og:title', ogTitle ?? title);
  setOrCreateMetaTag('meta[property="og:description"]', 'property', 'og:description', ogDescription ?? description);
  setOrCreateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', twitterTitle ?? ogTitle ?? title);
  setOrCreateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', twitterDescription ?? ogDescription ?? description);

  if (canonicalUrl) {
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
  }
};

export const usePageMeta = (config: PageMetaConfig) => {
  const { title, description, canonicalUrl, ogTitle, ogDescription, twitterTitle, twitterDescription, noIndex } = config;

  useEffect(() => {
    setPageMeta({ title, description, canonicalUrl, ogTitle, ogDescription, twitterTitle, twitterDescription, noIndex });
  }, [title, description, canonicalUrl, ogTitle, ogDescription, twitterTitle, twitterDescription, noIndex]);
};
