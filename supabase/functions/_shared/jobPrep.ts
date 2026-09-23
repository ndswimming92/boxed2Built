/**
 * What the customer should do before we show up.
 *
 * Job types are free-form — the Jobs form builds its dropdown from whatever has
 * been typed before (see JobFormModal.fetchDropdownData), so there is no
 * enumeration to switch on. Matching is by keyword against the lowercased type.
 *
 * Every matching rule contributes, not just the first, because real job types
 * combine services: "Furniture Assembly + Wall Mounting" is one of the types
 * already in use, and that customer needs both checklists. Items are
 * de-duplicated so overlapping rules do not repeat advice.
 */

/** Applies to every job regardless of type: access, pets, and a decision-maker on site. */
const UNIVERSAL_PREP = [
  'Make sure someone 18 or older is home for the visit.',
  'Let me know where to park and how to get in — a spot near the door saves real time on the trip in.',
  'Secure any pets that might be startled by power tools.',
];

interface PrepRule {
  /** Matched as substrings of the lowercased job type. */
  keywords: string[];
  /** Used as the lead-in when this is the only service that matched. */
  intro: string;
  items: string[];
  /**
   * An addendum refines the rule above it rather than naming a second service,
   * so it contributes items but never makes the email claim two jobs in one.
   * 'TV Mounting' is mounting with extra cables, not mounting plus a TV job.
   */
  addendum?: boolean;
}

/**
 * Order decides the order items appear in, and which intro a single-rule match
 * uses. Narrow rules that only add to a broader one ('tv') sit after it.
 */
const PREP_RULES: PrepRule[] = [
  {
    keywords: [
      'furniture', 'assembly', 'assemble', 'ikea', 'table', 'desk', 'dresser',
      'bed', 'crib', 'wardrobe', 'bookcase', 'cabinet', 'nursery',
    ],
    intro: 'A little prep makes assembly day go much faster:',
    items: [
      'Move the boxes into the room where the furniture will live — assembled pieces are often too large to fit through a doorway afterward.',
      'Clear a work area of roughly 6ft x 6ft next to where the piece will sit.',
      'Keep all hardware bags and instruction booklets with their boxes, even ones that look empty.',
      'If anything needs to be anchored to a wall, point out the spot ahead of time.',
    ],
  },
  {
    keywords: ['mount', 'hang', 'shelf', 'shelves', 'mirror'],
    intro: 'A few things to have ready before I arrive:',
    items: [
      'Have everything being mounted — the item, its bracket, and all the hardware — on site and unboxed if you can.',
      'Decide on the height and mark the spot if you have a preference.',
      'Let me know if anything runs behind that wall, such as plumbing, gas, or an electrical panel.',
      'Clear furniture and decor away from the wall so I can work.',
    ],
  },
  {
    // Adds to the mounting list above rather than replacing it.
    keywords: ['tv', 'television'],
    intro: 'A few things to have ready before I arrive:',
    addendum: true,
    items: [
      'Have the streaming boxes, soundbar, and any cables you want connected nearby.',
    ],
  },
  {
    keywords: ['mov', 'haul', 'removal', 'disposal', 'donat'],
    intro: 'To keep things moving on the day:',
    items: [
      'Have everything that is going clearly separated from anything that is staying.',
      'Clear a walking path from the items to the door.',
      'Empty drawers and cabinets on any furniture being moved.',
    ],
  },
  {
    keywords: ['repair', 'fix', 'handyman', 'install'],
    intro: 'To keep things moving on the day:',
    items: [
      'Clear the work area so I can get to it right away.',
      'Have any parts, hardware, or replacement pieces on site.',
    ],
  },
];

/** Tools need power on nearly every job, so it is said once at the end. */
const POWER_ITEM = 'Have an accessible power outlet nearby for tools.';

export interface JobPrep {
  intro: string;
  items: string[];
}

/**
 * The checklist for a job type, universal items appended. Never empty — an
 * unknown or missing type falls back to access, pets, and a decision-maker,
 * which is useful advice for any visit.
 */
export function buildJobPrep(jobType: string | null | undefined): JobPrep {
  const normalized = jobType?.trim().toLowerCase() ?? '';
  const matched = normalized
    ? PREP_RULES.filter((rule) => rule.keywords.some((word) => normalized.includes(word)))
    : [];

  const items = matched.flatMap((rule) => rule.items);
  if (matched.length) items.push(POWER_ITEM);
  items.push(...UNIVERSAL_PREP);

  // Only real services count toward "this job is two jobs"; addenda do not.
  const services = matched.filter((rule) => !rule.addendum);

  return {
    // A job spanning two services gets a lead-in that promises both, rather
    // than one service's intro over a list covering the other as well.
    intro: services.length > 1
      ? 'There is a bit to cover on this one — here is what helps most:'
      : (services[0] ?? matched[0])?.intro ?? 'A couple of things to have ready before I arrive:',
    items: [...new Set(items)],
  };
}
