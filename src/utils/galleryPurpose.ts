export type GalleryPurpose = 'website' | 'social' | 'both';

export const GALLERY_PURPOSE_OPTIONS: { value: GalleryPurpose; label: string }[] = [
  { value: 'both', label: 'Website Gallery + Social Media' },
  { value: 'website', label: 'Website Gallery Only' },
  { value: 'social', label: 'Social Media Only' },
];

export function purposeToFlags(purpose: GalleryPurpose): {
  show_on_website: boolean;
  eligible_for_social: boolean;
} {
  return {
    show_on_website: purpose !== 'social',
    eligible_for_social: purpose !== 'website',
  };
}

export function flagsToPurpose(showOnWebsite: boolean, eligibleForSocial: boolean): GalleryPurpose {
  if (showOnWebsite && eligibleForSocial) return 'both';
  if (eligibleForSocial) return 'social';
  return 'website';
}
