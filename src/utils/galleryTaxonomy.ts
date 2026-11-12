/**
 * Service-type and room tags for gallery items.
 *
 * Each item can be tagged explicitly in the admin. When a tag is left blank we
 * fall back to detecting it from the title so the public gallery
 * filters work without every photo having to be tagged by hand.
 */

export const GALLERY_SERVICE_TYPES = [
  { key: 'furniture-assembly', label: 'Furniture Assembly' },
  { key: 'tv-mounting', label: 'TV Mounting' },
  { key: 'outdoor', label: 'Outdoor & Playsets' },
  { key: 'wall-install', label: 'Shelving & Wall Installs' },
] as const;

export const GALLERY_ROOMS = [
  { key: 'living-room', label: 'Living Room' },
  { key: 'bedroom', label: 'Bedroom' },
  { key: 'nursery', label: 'Nursery & Kids' },
  { key: 'office', label: 'Office' },
  { key: 'kitchen-dining', label: 'Kitchen & Dining' },
  { key: 'garage', label: 'Garage & Storage' },
  { key: 'patio-yard', label: 'Patio & Yard' },
] as const;

export type GalleryServiceType = (typeof GALLERY_SERVICE_TYPES)[number]['key'];
export type GalleryRoom = (typeof GALLERY_ROOMS)[number]['key'];

const OUTDOOR = /trampoline|playset|swing ?set|patio|adirondack|outdoor|planter|grill|pergola|gazebo|\bshed\b|basketball|porch|\bdeck\b/;

const isServiceType = (value: unknown): value is GalleryServiceType =>
  GALLERY_SERVICE_TYPES.some((s) => s.key === value);

const isRoom = (value: unknown): value is GalleryRoom =>
  GALLERY_ROOMS.some((r) => r.key === value);

export function inferServiceType(title: string): GalleryServiceType {
  const titleText = title.toLowerCase();

  if (/tv (wall )?mount|mounted tv|tv install/.test(titleText)) return 'tv-mounting';
  if (OUTDOOR.test(titleText)) return 'outdoor';
  if (/floating shel|slatwall|wall[- ]mounted|\binstall|mirror hanging|curtain rod/.test(titleText)) return 'wall-install';
  return 'furniture-assembly';
}

export function inferRoom(title: string): GalleryRoom | null {
  const text = title.toLowerCase();

  if (/bassinet|crib|nursery|changing table|bunk bed|toddler|kids/.test(text)) return 'nursery';
  if (/garage|slatwall|storage rack|workbench|tool chest/.test(text)) return 'garage';
  if (OUTDOOR.test(text)) return 'patio-yard';
  if (/coffee bar|dining|kitchen|buffet|bar stool|pantry|sideboard/.test(text)) return 'kitchen-dining';
  if (/desk|lateral file|filing|file cabinet|office/.test(text)) return 'office';
  if (/\bbed\b|nightstand|dresser|wardrobe|armoire|headboard|vanity/.test(text)) return 'bedroom';
  if (/coffee table|\btv\b|fireplace|sofa|couch|sectional|chair|console|piano|shel(f|ves)|bookcase|entertainment|media|recliner/.test(text)) {
    return 'living-room';
  }
  return null;
}

/** Explicit tag if one was saved, otherwise the detected one. */
export function resolveServiceType(
  saved: string | null | undefined,
  title: string,
): GalleryServiceType {
  return isServiceType(saved) ? saved : inferServiceType(title);
}

export function resolveRoom(saved: string | null | undefined, title: string): GalleryRoom | null {
  return isRoom(saved) ? saved : inferRoom(title);
}

export const serviceTypeLabel = (key: GalleryServiceType): string =>
  GALLERY_SERVICE_TYPES.find((s) => s.key === key)?.label ?? key;

export const roomLabel = (key: GalleryRoom): string =>
  GALLERY_ROOMS.find((r) => r.key === key)?.label ?? key;
