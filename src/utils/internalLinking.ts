// Internal linking utility functions and anchor text variations

export interface AnchorTextVariation {
  text: string;
  context: 'primary' | 'secondary' | 'contextual' | 'cta';
  page: string;
}

// Anchor text variations for key pages
export const ANCHOR_TEXT_VARIATIONS: Record<string, AnchorTextVariation[]> = {
  '/services': [
    { text: 'furniture assembly services', context: 'primary', page: 'services' },
    { text: 'our services and pricing', context: 'secondary', page: 'services' },
    { text: 'professional assembly services', context: 'contextual', page: 'services' },
    { text: 'view all services', context: 'cta', page: 'services' },
    { text: 'IKEA assembly services', context: 'contextual', page: 'services' },
    { text: 'Target furniture assembly', context: 'contextual', page: 'services' },
    { text: 'Walmart furniture assembly', context: 'contextual', page: 'services' },
    { text: 'transparent pricing', context: 'secondary', page: 'services' },
    { text: 'service offerings', context: 'secondary', page: 'services' }
  ],
  '/about': [
    { text: 'about our expertise', context: 'primary', page: 'about' },
    { text: 'our commitment to quality', context: 'secondary', page: 'about' },
    { text: 'learn more about us', context: 'cta', page: 'about' },
    { text: 'our local commitment', context: 'contextual', page: 'about' },
    { text: 'about our team', context: 'secondary', page: 'about' },
    { text: 'our mission and values', context: 'contextual', page: 'about' },
    { text: 'family-focused approach', context: 'contextual', page: 'about' }
  ],
  '/contact': [
    { text: 'contact us', context: 'primary', page: 'contact' },
    { text: 'get in touch', context: 'secondary', page: 'contact' },
    { text: 'request a quote', context: 'cta', page: 'contact' },
    { text: 'schedule service', context: 'cta', page: 'contact' },
    { text: 'contact information', context: 'secondary', page: 'contact' },
    { text: 'reach out today', context: 'cta', page: 'contact' }
  ],
  '/gallery': [
    { text: 'view our work gallery', context: 'primary', page: 'gallery' },
    { text: 'see our completed projects', context: 'secondary', page: 'gallery' },
    { text: 'browse our gallery', context: 'cta', page: 'gallery' },
    { text: 'project gallery', context: 'secondary', page: 'gallery' },
    { text: 'before and after photos', context: 'contextual', page: 'gallery' },
    { text: 'time-lapse videos', context: 'contextual', page: 'gallery' }
  ],
  '/partners': [
    { text: 'partnership programs', context: 'primary', page: 'partners' },
    { text: 'realtor partnerships', context: 'contextual', page: 'partners' },
    { text: 'partner with us', context: 'cta', page: 'partners' },
    { text: 'closing gift services', context: 'contextual', page: 'partners' },
    { text: 'referral programs', context: 'secondary', page: 'partners' }
  ]
};

// Get random anchor text variation for a page
export const getAnchorTextVariation = (
  page: string, 
  context: 'primary' | 'secondary' | 'contextual' | 'cta' = 'primary'
): string => {
  const variations = ANCHOR_TEXT_VARIATIONS[page];
  if (!variations) return page.replace('/', '');
  
  const contextVariations = variations.filter(v => v.context === context);
  if (contextVariations.length === 0) return variations[0].text;
  
  const randomIndex = Math.floor(Math.random() * contextVariations.length);
  return contextVariations[randomIndex].text;
};

// Internal linking opportunities by page
export const INTERNAL_LINKING_OPPORTUNITIES = {
  homepage: [
    { target: '/services', priority: 'high', context: 'Services section' },
    { target: '/about', priority: 'medium', context: 'Trust building' },
    { target: '/contact', priority: 'high', context: 'CTA sections' },
    { target: '/gallery', priority: 'medium', context: 'Social proof' }
  ],
  services: [
    { target: '/about', priority: 'high', context: 'Expertise validation' },
    { target: '/contact', priority: 'high', context: 'Service CTAs' },
    { target: '/gallery', priority: 'medium', context: 'Work examples' },
    { target: '/partners', priority: 'low', context: 'B2B opportunities' }
  ],
  about: [
    { target: '/services', priority: 'high', context: 'Service mentions' },
    { target: '/contact', priority: 'high', context: 'Contact CTAs' },
    { target: '/gallery', priority: 'medium', context: 'Work showcase' }
  ],
  contact: [
    { target: '/services', priority: 'medium', context: 'Service references' },
    { target: '/about', priority: 'low', context: 'Trust building' }
  ],
  gallery: [
    { target: '/services', priority: 'high', context: 'Service descriptions' },
    { target: '/contact', priority: 'high', context: 'Project CTAs' },
    { target: '/about', priority: 'medium', context: 'Expertise showcase' }
  ],
  partners: [
    { target: '/services', priority: 'high', context: 'Service offerings' },
    { target: '/contact', priority: 'high', context: 'Partnership CTAs' },
    { target: '/about', priority: 'medium', context: 'Company info' }
  ]
};

// SEO-friendly URL structure validation
export const validateUrlStructure = (url: string): boolean => {
  const urlPattern = /^\/[a-z0-9-]*$/;
  return urlPattern.test(url);
};

// Generate contextual internal links
export const generateContextualLinks = (currentPage: string, content: string): string => {
  let updatedContent = content;
  
  // Define keyword-to-page mappings
  const keywordMappings = {
    'furniture assembly services': '/services',
    'IKEA assembly': '/services',
    'Target furniture': '/services',
    'Walmart furniture': '/services',
    'our expertise': '/about',
    'about our team': '/about',
    'contact us': '/contact',
    'get a quote': '/contact',
    'our work': '/gallery',
    'completed projects': '/gallery',
    'partnership': '/partners',
    'realtor': '/partners'
  };
  
  // Only add links if not on the target page
  Object.entries(keywordMappings).forEach(([keyword, targetPage]) => {
    if (currentPage !== targetPage && updatedContent.includes(keyword)) {
      const anchorText = getAnchorTextVariation(targetPage, 'contextual');
      updatedContent = updatedContent.replace(
        new RegExp(`\\b${keyword}\\b`, 'gi'),
        `<a href="${targetPage}" class="text-blue-700 hover:text-blue-800 underline font-medium">${anchorText}</a>`
      );
    }
  });
  
  return updatedContent;
};