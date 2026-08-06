// Content for the service landing pages added off the back of the 2026 online
// presence audit: IKEA assembly, nursery setup, garage organization and
// move-in assembly. Each entry renders one pre-rendered page through
// <ServiceLandingPage />.
//
// Prices are never invented here — every dollar figure comes from
// PRIMARY_SERVICES in localSEO.ts so the pricing a visitor sees on a landing
// page always matches /services, the FAQ and the Offer schema.

import { PRIMARY_SERVICES } from './localSEO';

export interface ServicePriceTier {
  name: string;
  description: string;
  /** Omit for project-quoted work; use priceNote instead. */
  price?: string;
  priceNote?: string;
}

export interface ServiceStep {
  title: string;
  description: string;
}

export interface ServiceHighlight {
  title: string;
  description: string;
}

export interface ServiceFAQ {
  question: string;
  answer: string;
}

export interface RelatedLink {
  href: string;
  title: string;
  subtitle: string;
}

export interface ServiceLandingContent {
  /** URL segment under /services/ */
  slug: string;
  navLabel: string;
  navDescription: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  breadcrumbLabel: string;
  h1: string;
  heroSubtitle: string;
  /** Schema.org Service fields */
  schemaName: string;
  schemaDescription: string;
  serviceType: string;
  intro: string[];
  highlights: ServiceHighlight[];
  pricingHeading: string;
  pricingIntro: string;
  pricing: ServicePriceTier[];
  /** Bulleted "also included / also available" list under pricing */
  alsoIncluded: string[];
  processHeading: string;
  process: ServiceStep[];
  /** A labelled grid — brands, room types, item types */
  showcase: { heading: string; intro: string; items: string[] };
  faqs: ServiceFAQ[];
  related: RelatedLink[];
}

const priceFor = (name: string): string =>
  PRIMARY_SERVICES.find((service) => service.name === name)?.price ?? '';

const SMALL_ITEM_PRICE = priceFor('Small Furniture Assembly');
const SHELVING_PRICE = priceFor('Storage & Shelving Assembly');
const DESK_PRICE = priceFor('Tables & Desks Assembly');
const DRESSER_PRICE = priceFor('Dressers & Storage Assembly');
const BED_PRICE = priceFor('Beds & Frames Assembly');

export const SERVICE_LANDING_PAGES: ServiceLandingContent[] = [
  {
    slug: 'ikea-furniture-assembly',
    navLabel: 'IKEA Assembly',
    navDescription: 'PAX, MALM, KALLAX, BILLY & the rest',
    metaTitle: 'IKEA Furniture Assembly Spring Hill, TN | Boxed2Built',
    metaDescription:
      'Professional IKEA furniture assembly in Spring Hill, TN. PAX wardrobes, MALM dressers, KALLAX and BILLY units built and anchored properly. Free quote — call today.',
    ogTitle: 'IKEA Furniture Assembly in Spring Hill, TN | Boxed2Built',
    ogDescription:
      'PAX, MALM, KALLAX, BILLY and the rest — assembled, anchored and cleaned up. Serving Spring Hill, Franklin, Brentwood, Columbia and Nashville.',
    breadcrumbLabel: 'IKEA Furniture Assembly',
    h1: 'IKEA Furniture Assembly in Spring Hill, TN',
    heroSubtitle:
      'There is no IKEA store in Middle Tennessee, so every piece arrives flat in a box. We build it, anchor it, and take the cardboard with us.',
    schemaName: 'IKEA Furniture Assembly Service',
    schemaDescription:
      'Professional IKEA furniture assembly in Spring Hill, TN and across Middle Tennessee. PAX wardrobe systems, MALM dressers, KALLAX shelving, BILLY bookcases and full IKEA room sets, assembled to specification with anti-tip anchoring and full packaging removal.',
    serviceType: 'IKEA Furniture Assembly',
    intro: [
      'IKEA does not have a Middle Tennessee store, which means every PAX wardrobe, MALM dresser and KALLAX unit in Spring Hill arrived as a stack of flat boxes with a wordless instruction booklet and a bag of cam locks. That is fine — until you are three hours in, the dowels are in the wrong holes, and the back panel is on upside down.',
      'We have built most of the IKEA catalogue more than once, and that repetition is the actual service. We know which steps the diagram glosses over, where a cam lock strips if you keep turning, which pieces are genuinely two-person jobs, and which units must be anchored to a stud before anyone loads them. You get furniture that is square, tight, safe and standing where you want it — and the boxes leave with us.',
    ],
    highlights: [
      {
        title: 'Every system, start to finish',
        description:
          'PAX wardrobes with interior fittings and sliding doors, MALM bedroom sets, KALLAX shelving, BILLY bookcases, HEMNES, BESTÅ media walls and full IKEA kitchen and office setups.',
      },
      {
        title: 'Anti-tip anchoring included',
        description:
          'IKEA ships restraints with tall units for a reason. We locate a stud, install the anchor properly, and show you the finished attachment — never a drywall plug and a shrug.',
      },
      {
        title: 'Hardware checked before we start',
        description:
          'We inventory every cam lock, dowel and screw against the parts list up front, so a missing bag turns into a phone call at hour zero instead of a dead stop at hour three.',
      },
      {
        title: 'All packaging removed',
        description:
          'IKEA generates a genuinely absurd volume of cardboard. Every box, bag, foam corner and plastic wrap leaves with us and gets disposed of on our end.',
      },
    ],
    pricingHeading: 'IKEA Assembly Pricing',
    pricingIntro:
      'The same transparent per-item pricing we use for every brand — no IKEA surcharge. Volume discounts apply as soon as you have multiple pieces, which most IKEA orders do.',
    pricing: [
      {
        name: 'Small items — chairs, nightstands, LACK tables',
        description: 'Quick single-piece builds, typically 30 to 60 minutes each.',
        price: SMALL_ITEM_PRICE,
      },
      {
        name: 'Desks & tables — BEKANT, MICKE, LINNMON',
        description: 'Office desks, dining tables and workstation setups.',
        price: DESK_PRICE,
      },
      {
        name: 'Shelving & storage — KALLAX, BILLY, BESTÅ',
        description: 'Bookcases, cube storage and media units, anchored to the wall.',
        price: SHELVING_PRICE,
      },
      {
        name: 'Beds & frames — MALM, HEMNES, BRIMNES',
        description: 'Bed frames with slats, storage drawers and headboard assembly.',
        price: BED_PRICE,
      },
      {
        name: 'Dressers & wardrobes — MALM, PAX, HEMNES',
        description: 'Multi-drawer dressers and PAX wardrobe systems with interior fittings.',
        price: DRESSER_PRICE,
      },
    ],
    alsoIncluded: [
      'Wall anchoring and anti-tip restraints on every tall unit',
      'Drawer alignment and door adjustment so everything closes flush',
      'Placement in the room you want it, not where the box landed',
      'Complete packaging removal and disposal',
      'Volume discounts on multi-piece IKEA orders',
    ],
    processHeading: 'How an IKEA Build Day Works',
    process: [
      {
        title: 'Send us the list',
        description:
          'Product names or a screenshot of your IKEA order is enough. We can quote accurately from that, because we already know how long each unit takes.',
      },
      {
        title: 'We inventory the hardware',
        description:
          'Before a single dowel goes in, we check the parts against the manifest. Missing hardware is far cheaper to discover at the start than at the end.',
      },
      {
        title: 'Build in the destination room',
        description:
          'Large IKEA units are designed to be assembled where they will live. We build in place so nothing has to be wrestled through a doorway or up a stairwell.',
      },
      {
        title: 'Anchor, align and adjust',
        description:
          'Tall units get anchored to framing. Doors get adjusted until they sit flush, drawers get aligned, and the whole piece gets checked for square and stability.',
      },
      {
        title: 'Cardboard out, walkthrough done',
        description:
          'We break down and remove every box, then walk each piece with you. Payment only after you have confirmed you are happy with it.',
      },
    ],
    showcase: {
      heading: 'IKEA Ranges We Build Regularly',
      intro:
        'If it came from IKEA, we have almost certainly built one. These are the ranges that come up most across Spring Hill, Franklin and Nashville.',
      items: [
        'PAX',
        'MALM',
        'KALLAX',
        'BILLY',
        'HEMNES',
        'BESTÅ',
        'BRIMNES',
        'BEKANT',
        'MICKE',
        'IVAR',
        'GALANT',
        'SONGESAND',
      ],
    },
    faqs: [
      {
        question: 'How much does IKEA furniture assembly cost in Spring Hill, TN?',
        answer: `We charge the same transparent per-item rates for IKEA as for every other brand — there is no IKEA surcharge. Small pieces such as chairs and nightstands start at $${SMALL_ITEM_PRICE}, desks and tables at $${DESK_PRICE}, shelving and storage units at $${SHELVING_PRICE}, bed frames at $${BED_PRICE}, and dressers and wardrobes at $${DRESSER_PRICE}. Most IKEA orders involve several pieces, so volume discounts usually apply. Send us your order list and we will quote it exactly.`,
      },
      {
        question: 'Can you assemble a PAX wardrobe system?',
        answer:
          'Yes — PAX is one of the most common systems we build. A full PAX run involves the frames, the interior fittings, the doors (hinged or sliding), and the wall anchoring, and getting the doors to hang square is the part most people find frustrating. We assemble the frames in the room they will live in, level and anchor them to framing, then adjust every hinge until the doors sit flush.',
      },
      {
        question: 'Do you anchor IKEA furniture to the wall?',
        answer:
          'Always, on any unit IKEA ships a restraint with — and every tall dresser, bookcase and wardrobe in a home with children. Tip-over incidents are a genuine hazard, and the anchor is only as good as what it is attached to, so we locate a stud rather than relying on a drywall plug. We show you the finished attachment during the walkthrough.',
      },
      {
        question: 'What if a part is missing from my IKEA box?',
        answer:
          'We inventory all hardware against the parts list before starting, which usually catches it early. If something is genuinely missing, we will tell you immediately, help you order the replacement part through IKEA (they ship missing hardware free), and assemble everything else in the meantime. We will come back and finish the piece once the part arrives.',
      },
      {
        question: 'Do I need to unbox everything before you arrive?',
        answer:
          'No — please do not. Leaving pieces in their original packaging until we arrive keeps the small hardware bags with the right unit and makes the inventory check far quicker. We handle the unboxing as part of the service, and we take all of it away afterwards.',
      },
    ],
    related: [
      {
        href: '/services/furniture-assembly',
        title: 'All Furniture Assembly',
        subtitle: 'Wayfair, Target, Walmart, Amazon and more',
      },
      {
        href: '/services/move-in-assembly',
        title: 'Move-In Assembly',
        subtitle: 'Whole-house setup on closing week',
      },
      {
        href: '/services/nursery-setup',
        title: 'Nursery & Crib Setup',
        subtitle: 'Built to spec and safely anchored',
      },
      {
        href: '/service-areas/spring-hill-tn',
        title: 'Serving Spring Hill, TN',
        subtitle: 'And eight more Middle Tennessee cities',
      },
    ],
  },
  {
    slug: 'nursery-setup',
    navLabel: 'Nursery & Crib Setup',
    navDescription: 'Cribs, changing tables & safe anchoring',
    metaTitle: 'Nursery & Crib Assembly Spring Hill, TN | Boxed2Built',
    metaDescription:
      'Professional nursery furniture and crib assembly in Spring Hill, TN. Built to manufacturer spec, anti-tip anchored, packaging removed. Book before baby arrives.',
    ogTitle: 'Nursery & Crib Assembly in Spring Hill, TN | Boxed2Built',
    ogDescription:
      'Cribs, changing tables, gliders and dressers — assembled to spec and anchored safely. Serving Spring Hill, Franklin, Nolensville and Middle Tennessee.',
    breadcrumbLabel: 'Nursery Setup',
    h1: 'Nursery & Crib Assembly in Spring Hill, TN',
    heroSubtitle:
      'The one room where "close enough" is not good enough. Every fastener to spec, every tall piece anchored, every box gone before you get home.',
    schemaName: 'Nursery Furniture and Crib Assembly Service',
    schemaDescription:
      'Professional nursery furniture assembly in Spring Hill, TN. Convertible cribs, changing tables, dressers, gliders and full nursery sets assembled strictly to manufacturer specification, with anti-tip wall anchoring and complete packaging removal.',
    serviceType: 'Nursery Furniture Assembly',
    intro: [
      'Nursery assembly is the job we are most careful with, and it is worth explaining why. A crib is a piece of safety equipment: the slat spacing, the mattress-support height, the torque on every bolt and the absence of any modification are all specified by the manufacturer and backed by federal safety standards. A crib that is merely "put together" is not the same as a crib that is built correctly.',
      'So we do it properly. We follow the manufacturer instructions exactly rather than from memory, torque every fastener to spec, re-check the frame after the first tightening pass, and confirm the mattress support is set at the right height for your baby’s stage. Every dresser, changing table and bookcase in the room gets anchored to wall framing. Then we take all the packaging with us, because the last thing anyone needs at eight months pregnant is a living room full of cardboard.',
    ],
    highlights: [
      {
        title: 'Built strictly to manufacturer spec',
        description:
          'Instructions followed step by step, every fastener torqued as specified, and the frame re-checked after the first pass. No improvising, no substituted hardware.',
      },
      {
        title: 'Anti-tip anchoring on everything tall',
        description:
          'Dressers, changing tables and bookcases anchored into a stud — not a drywall plug. If your set did not include anchors, tell us and we will bring them.',
      },
      {
        title: 'Convertible cribs handled at every stage',
        description:
          'We set the mattress support for your baby’s current stage and show you how to lower it later, or convert the crib to a toddler or full bed when the time comes.',
      },
      {
        title: 'Zero mess left behind',
        description:
          'All boxes, foam, plastic and hardware waste removed and disposed of by us. You come back to a finished room, not a project.',
      },
    ],
    pricingHeading: 'Nursery Assembly Pricing',
    pricingIntro:
      'Standard per-item pricing, with volume discounts that apply to essentially every nursery — you are rarely buying just one piece. Send us the set and we will quote the whole room.',
    pricing: [
      {
        name: 'Crib or convertible crib',
        description: 'Assembled to manufacturer spec with the mattress support set for your stage.',
        price: BED_PRICE,
      },
      {
        name: 'Dresser or changing table',
        description: 'Multi-drawer units with drawer alignment and anti-tip wall anchoring.',
        price: DRESSER_PRICE,
      },
      {
        name: 'Bookcase, storage cubbies & shelving',
        description: 'Book and toy storage, assembled and anchored to framing.',
        price: SHELVING_PRICE,
      },
      {
        name: 'Glider, rocker, bassinet or side table',
        description: 'Smaller nursery pieces, typically 30 to 60 minutes each.',
        price: SMALL_ITEM_PRICE,
      },
      {
        name: 'Complete nursery package',
        description: 'Crib, dresser, changing table, glider and storage in a single visit.',
        priceNote: 'Custom quote — volume discount applies',
      },
    ],
    alsoIncluded: [
      'Anti-tip wall anchoring on every tall piece in the room',
      'Mattress support set to the correct height for your baby’s stage',
      'Hardware inventory and torque check before we finish',
      'Furniture placed where you want it, floors protected while we work',
      'Complete packaging removal — nothing left in the house',
    ],
    processHeading: 'How Nursery Day Works',
    process: [
      {
        title: 'Book ahead of the due date',
        description:
          'Most families book two to six weeks out. Furniture deliveries slip, so tell us your window and we will hold flexible scheduling around it.',
      },
      {
        title: 'Hardware inventory first',
        description:
          'Every bolt, barrel nut and bracket checked against the manifest before assembly begins. Crib hardware is not something to improvise around.',
      },
      {
        title: 'Assemble to specification',
        description:
          'Instructions followed step by step, fasteners torqued to spec, frame re-checked after the first tightening pass, mattress support set for your stage.',
      },
      {
        title: 'Anchor and safety check',
        description:
          'Every tall piece anchored into framing. We test each unit for stability and walk you through what we installed and why.',
      },
      {
        title: 'Everything cleared out',
        description:
          'All packaging removed and disposed of on our end. The room is finished and ready when we leave.',
      },
    ],
    showcase: {
      heading: 'Nursery Pieces We Assemble',
      intro:
        'Whatever the brand — Pottery Barn Kids, Babyletto, DaVinci, Delta, Graco, IKEA, Wayfair or Amazon — the safety standard is the same.',
      items: [
        'Convertible cribs',
        'Mini and portable cribs',
        'Changing tables',
        'Dressers & chests',
        'Gliders & rockers',
        'Bassinets',
        'Toy storage & cubbies',
        'Bookcases',
        'Toddler beds',
        'Bunk & loft beds',
        'Playards',
        'Rocking chairs',
      ],
    },
    faqs: [
      {
        question: 'Do you assemble cribs in Spring Hill and the surrounding area?',
        answer:
          'Yes — crib and nursery assembly is one of our most requested services across Spring Hill, Franklin, Thompson’s Station, Nolensville and Columbia. We build strictly to the manufacturer’s instructions, torque every fastener to specification, and re-check the frame before we call it done.',
      },
      {
        question: 'Is it actually safer to have a crib professionally assembled?',
        answer:
          'It removes the most common failure points. Cribs are safety-rated equipment, and the specification covers slat spacing, mattress-support height, hardware torque and the requirement that nothing be substituted or modified. The frequent DIY mistakes — under-torqued bolts, a mattress support left at the wrong height, or reusing hardware from a different set — are exactly what we check for. If we find damaged or missing hardware, we will stop and tell you rather than working around it.',
      },
      {
        question: 'Do you anchor nursery furniture to the wall?',
        answer:
          'Yes, on every tall piece in the room, and it is not optional as far as we are concerned. Dresser and bookcase tip-overs are a leading cause of furniture-related injuries to small children. We locate a stud, install the restraint properly, and show you the finished attachment. If your furniture did not ship with an anchor kit, tell us when you book and we will bring one.',
      },
      {
        question: 'Can you convert a crib to a toddler bed later?',
        answer:
          'Yes. Convertible cribs typically move through toddler bed, daybed and full-size configurations, each with its own hardware and instructions. We can handle any of those conversions as a separate visit — bring us the original conversion kit and the manual if you still have them.',
      },
      {
        question: 'How far in advance should I book nursery assembly?',
        answer:
          'Two to six weeks before your due date is the sweet spot — early enough that a delivery delay does not create a crisis, late enough that the room is ready. If you are past that and need it quickly, call us anyway; we keep some flexibility for exactly this.',
      },
    ],
    related: [
      {
        href: '/services/furniture-assembly',
        title: 'All Furniture Assembly',
        subtitle: 'Every brand, every room',
      },
      {
        href: '/services/ikea-furniture-assembly',
        title: 'IKEA Assembly',
        subtitle: 'PAX, MALM, KALLAX and the rest',
      },
      {
        href: '/services/move-in-assembly',
        title: 'Move-In Assembly',
        subtitle: 'Nursery plus the rest of the house',
      },
      {
        href: '/service-areas/nolensville-tn',
        title: 'Serving Nolensville, TN',
        subtitle: 'And eight more Middle Tennessee cities',
      },
    ],
  },
  {
    slug: 'garage-organization',
    navLabel: 'Garage Organization',
    navDescription: 'Shelving, overhead racks & workbenches',
    metaTitle: 'Garage Organization & Storage Spring Hill, TN | Boxed2Built',
    metaDescription:
      'Garage shelving, overhead racks and workbench installation in Spring Hill, TN. Anchored into framing so it holds real weight. Free quote from Boxed2Built.',
    ogTitle: 'Garage Organization & Storage in Spring Hill, TN | Boxed2Built',
    ogDescription:
      'Wall shelving, overhead racks, workbenches and wall-track systems — installed into framing, not drywall. Serving Spring Hill and Middle Tennessee.',
    breadcrumbLabel: 'Garage Organization',
    h1: 'Garage Organization & Storage in Spring Hill, TN',
    heroSubtitle:
      'Get the floor back. Shelving, overhead racks, workbenches and wall systems installed into real framing — rated to hold what you actually own.',
    schemaName: 'Garage Organization and Storage Installation Service',
    schemaDescription:
      'Garage organization and storage installation in Spring Hill, TN. Freestanding and wall-mounted shelving, ceiling-mounted overhead racks, workbenches, wall-track systems and cabinet installation, anchored into structural framing.',
    serviceType: 'Garage Organization',
    intro: [
      'Almost every garage storage failure comes down to the same thing: the shelf, rack or hook went into drywall instead of into structure. Drywall anchors are rated for a picture frame. They are not rated for a ceiling rack holding twelve bins of Christmas decorations above your car, and when that lets go it takes the drywall with it.',
      'We install into framing. Ceiling racks get lagged into joists, running perpendicular so the load spreads across several. Wall shelving and track systems get located on studs. Workbenches get levelled on a garage floor that is deliberately sloped toward the door. It is not complicated work, but it is the difference between storage that lasts a decade and storage you re-hang every spring.',
    ],
    highlights: [
      {
        title: 'Anchored into joists and studs',
        description:
          'Overhead racks lagged into ceiling joists, wall systems located on studs. We find real structure before anything gets loaded.',
      },
      {
        title: 'Overhead racks done right',
        description:
          'Ceiling storage frees the most square footage of anything in a garage, and it is the installation people most often get wrong. We run perpendicular to the joists and spread the load.',
      },
      {
        title: 'Workbenches levelled to a sloped floor',
        description:
          'Garage slabs pitch toward the door by design. We shim benches and cabinets so your work surface is actually flat.',
      },
      {
        title: 'We plan the layout with you',
        description:
          'Seasonal storage high, daily-use items at eye level, heavy things low. Ten minutes of planning up front beats moving a rack later.',
      },
    ],
    pricingHeading: 'Garage Organization Pricing',
    pricingIntro:
      'Shelving units price the same as any other storage assembly. Overhead racks, wall systems and full garage build-outs are quoted per project, because a two-car garage and a three-bay workshop are not the same job.',
    pricing: [
      {
        name: 'Freestanding or wall-mounted shelving unit',
        description: 'Per unit, assembled and secured to the wall where applicable.',
        price: SHELVING_PRICE,
      },
      {
        name: 'Workbench or garage cabinet',
        description: 'Assembled, levelled to the slope of your slab and secured.',
        price: DESK_PRICE,
      },
      {
        name: 'Ceiling-mounted overhead rack',
        description: 'Located on joists, lagged in and load-tested. Priced by rack size and count.',
        priceNote: 'Custom quote',
      },
      {
        name: 'Wall track & slatwall systems',
        description: 'Rail, hook and accessory systems mounted across studs.',
        priceNote: 'Custom quote',
      },
      {
        name: 'Full garage build-out',
        description: 'Shelving, overhead racks, bench and wall systems planned and installed together.',
        priceNote: 'Custom quote — volume discount applies',
      },
    ],
    alsoIncluded: [
      'Stud and joist location before anything is drilled',
      'Layout planning around your vehicles, door tracks and existing outlets',
      'Levelling and shimming on sloped garage slabs',
      'Load testing on overhead racks before we leave',
      'All packaging and cardboard removed',
    ],
    processHeading: 'How a Garage Project Works',
    process: [
      {
        title: 'Walk the space together',
        description:
          'We look at ceiling height, door track clearance, joist direction, outlets and where the cars actually park. That determines what can go where.',
      },
      {
        title: 'Plan the zones',
        description:
          'Seasonal and rarely-used storage overhead, daily-use at eye level, heavy items low. We agree the layout before anything is mounted.',
      },
      {
        title: 'Locate structure',
        description:
          'Studs and joists mapped and marked. Nothing load-bearing goes into drywall — this is the step that determines whether the install lasts.',
      },
      {
        title: 'Install and level',
        description:
          'Racks lagged in, shelving secured, benches shimmed level against the slab’s slope. Everything gets checked under load.',
      },
      {
        title: 'Load test and clean up',
        description:
          'We test overhead racks before trusting them with your belongings, then remove every box and offcut of packaging.',
      },
    ],
    showcase: {
      heading: 'What We Install',
      intro:
        'Gladiator, NewAge, Fleximounts, Husky, SafeRacks, Rubbermaid FastTrack or whatever you already bought — the install principles are the same.',
      items: [
        'Overhead ceiling racks',
        'Freestanding shelving',
        'Wall-mounted shelving',
        'Slatwall & track systems',
        'Workbenches',
        'Garage cabinets',
        'Bike & ladder hooks',
        'Tool chests',
        'Utility racks',
        'Sports equipment storage',
        'Pegboard walls',
        'Storage lockers',
      ],
    },
    faqs: [
      {
        question: 'How much weight can an overhead garage rack actually hold?',
        answer:
          'That depends on the rack’s rating and, far more importantly, on how it is attached. Most consumer overhead racks are rated somewhere between 400 and 600 pounds, but that rating assumes the unit is lagged into ceiling joists — usually running perpendicular so the load spreads across several. Mounted into drywall alone, the real capacity is close to nothing. We locate the joists, use appropriately sized lag bolts, and load test before we leave.',
      },
      {
        question: 'Can you install racks if my garage ceiling is finished with drywall?',
        answer:
          'Yes. Finished garage ceilings are common in newer Spring Hill and Thompson’s Station construction. We locate the joists behind the drywall, mark them, and lag through into solid framing. The drywall is not carrying the load — the joists are.',
      },
      {
        question: 'My garage floor slopes. Will my workbench sit level?',
        answer:
          'Yes. Nearly every garage slab is deliberately pitched toward the door so water drains out, which means a bench set directly on it will not be flat. We shim and level benches and cabinets against the slope so your work surface is true.',
      },
      {
        question: 'Do you help plan the layout, or just install what I bought?',
        answer:
          'Both. If you have already bought a system, we install it. If you are still deciding, we will walk the space with you first — ceiling height, garage door track clearance, joist direction, outlets, and where the cars actually sit — and tell you what will fit before you spend money on something that will not.',
      },
      {
        question: 'Do you serve garages outside Spring Hill?',
        answer:
          'Yes. Garage projects are common right across our service area, particularly in the newer builds around Thompson’s Station and Nolensville and on the larger properties in Chapel Hill and Mount Pleasant. All nine of our service areas are covered with no trip fee.',
      },
    ],
    related: [
      {
        href: '/services/furniture-assembly',
        title: 'All Furniture Assembly',
        subtitle: 'Every brand, every room',
      },
      {
        href: '/services/move-in-assembly',
        title: 'Move-In Assembly',
        subtitle: 'Get the whole house set up at once',
      },
      {
        href: '/services/tv-mounting',
        title: 'TV Mounting',
        subtitle: 'Secure installation on any wall type',
      },
      {
        href: '/service-areas',
        title: 'All Service Areas',
        subtitle: 'Nine Middle Tennessee cities',
      },
    ],
  },
  {
    slug: 'move-in-assembly',
    navLabel: 'Move-In Assembly',
    navDescription: 'Whole-house setup on closing week',
    metaTitle: 'Move-In Furniture Assembly Spring Hill, TN | Boxed2Built',
    metaDescription:
      'Whole-house move-in assembly in Spring Hill, TN. Beds, dressers, desks and TVs set up in one visit so your first night is comfortable. Realtor packages available.',
    ogTitle: 'Move-In Assembly Services in Spring Hill, TN | Boxed2Built',
    ogDescription:
      'One visit, whole house. Bedrooms first so you can sleep, then living areas — and every box gone before we leave. Serving Spring Hill and Middle Tennessee.',
    breadcrumbLabel: 'Move-In Assembly',
    h1: 'Move-In Assembly Services in Spring Hill, TN',
    heroSubtitle:
      'One visit, whole house. We sequence the rooms so your beds are made up the first night — and every box leaves with us.',
    schemaName: 'Move-In Furniture Assembly Service',
    schemaDescription:
      'Whole-house move-in assembly in Spring Hill, TN. Multi-room furniture assembly, bed and dresser setup, TV mounting and packaging removal scheduled around closing and delivery dates, for homeowners, renters, realtors and property managers.',
    serviceType: 'Move-In Assembly',
    intro: [
      'Moving into a new house in Spring Hill usually means every piece of furniture you own arriving inside the same seven days — the movers on one day, the Wayfair freight on another, the mattress on a third, and a garage full of boxes in between. Doing that yourself costs a weekend you do not have during the week you can least afford it.',
      'We take the whole stack in a single block and sequence it deliberately: bedrooms first, so the house is genuinely livable that night, then the office if you are working the next morning, then living and dining, then anything headed for the garage. TVs go up the same day. Every box, bag and foam corner leaves with us. You spend closing week unpacking the things that matter instead of arguing with an Allen key at midnight.',
    ],
    highlights: [
      {
        title: 'Bedrooms first, always',
        description:
          'The single most useful thing on move-in day is a bed you can sleep in. We build the bedrooms before anything else, then work outward.',
      },
      {
        title: 'Scheduled around your closing',
        description:
          'Closings move and deliveries slip. Tell us your date and we will keep the appointment flexible rather than charging you to reschedule.',
      },
      {
        title: 'One visit, not four appointments',
        description:
          'Assembly, TV mounting, garage shelving and packaging removal handled in the same block, by the same people, with one invoice at the end.',
      },
      {
        title: 'Realtor and property manager packages',
        description:
          'Closing-gift assembly for buyers and turn-day setup for rentals. We coordinate directly with your client so you do not have to project-manage it.',
      },
    ],
    pricingHeading: 'Move-In Assembly Pricing',
    pricingIntro:
      'Whole-house projects are quoted as a package, built from the same per-item rates we publish everywhere else — with volume discounts that get better the more rooms are involved.',
    pricing: [
      {
        name: 'Single bedroom setup',
        description: 'Bed frame, dresser and nightstands assembled, placed and anchored.',
        priceNote: 'Custom quote — from the per-item rates below',
      },
      {
        name: 'Bed frames & headboards',
        description: 'Per item, including slats, storage drawers and headboard attachment.',
        price: BED_PRICE,
      },
      {
        name: 'Dressers & wardrobes',
        description: 'Per item, with drawer alignment and anti-tip anchoring.',
        price: DRESSER_PRICE,
      },
      {
        name: 'Desks, tables & dining sets',
        description: 'Per item, for the home office and dining room.',
        price: DESK_PRICE,
      },
      {
        name: 'Whole-house move-in package',
        description: 'Every room in a single visit, TV mounting included, all packaging removed.',
        priceNote: 'Custom quote — best volume discount',
      },
    ],
    alsoIncluded: [
      'Room-by-room sequencing agreed with you before we start',
      'Furniture placed exactly where you want it, floors protected',
      'Anti-tip anchoring on tall pieces in every room',
      'TV mounting and cable management on the same visit',
      'Complete removal of all boxes, packaging and pallet wrap',
    ],
    processHeading: 'How Move-In Day Works',
    process: [
      {
        title: 'Tell us the closing date',
        description:
          'Even an approximate date is enough to start. We will pencil in a window and firm it up as your delivery schedule settles.',
      },
      {
        title: 'Send the inventory',
        description:
          'A list or a few order screenshots lets us quote accurately and block the right amount of time. Guessing at the door helps nobody.',
      },
      {
        title: 'Agree the running order',
        description:
          'We walk the house with you at the start and confirm the sequence — bedrooms, office, living areas, garage — and where each piece is going.',
      },
      {
        title: 'Build the house',
        description:
          'Straight through, room by room. Beds first so the house is livable tonight, TVs mounted the same day, tall furniture anchored as we go.',
      },
      {
        title: 'Clear out completely',
        description:
          'Every box, bag and pallet wrap goes with us. Then a full walkthrough, and payment only once you are satisfied.',
      },
    ],
    showcase: {
      heading: 'What a Move-In Day Usually Covers',
      intro:
        'A typical whole-house visit in Spring Hill or Thompson’s Station runs through most of this list in a single block.',
      items: [
        'Bed frames & headboards',
        'Dressers & nightstands',
        'Bunk beds',
        'Home office desks',
        'Dining tables & chairs',
        'Bar stools',
        'TV stands & media units',
        'TV wall mounting',
        'Bookcases & shelving',
        'Patio & deck furniture',
        'Garage shelving',
        'Packaging removal',
      ],
    },
    faqs: [
      {
        question: 'Can you assemble an entire house of furniture in one day?',
        answer:
          'In most cases, yes. A typical three- to four-bedroom move-in fits into a single block if we know the inventory in advance and can block the time properly. Very large projects, or ones where deliveries arrive across several days, sometimes make more sense as two visits — we will tell you honestly which one your job is when we quote it, rather than promising one day and returning for a second.',
      },
      {
        question: 'My closing date keeps moving. Will you charge me to reschedule?',
        answer:
          'No. Closings slip and furniture deliveries slip, and we have never thought it reasonable to charge someone for that. Contact us as soon as you know the new date and we will move the appointment at no additional cost.',
      },
      {
        question: 'Do you work with realtors and property managers?',
        answer:
          'Yes. Move-in assembly makes a genuinely useful closing gift, and we coordinate directly with the buyer so the agent does not have to project-manage it. We also handle turn-day setup for rentals and property managers. Our partners page has the details on how those arrangements work.',
      },
      {
        question: 'What do you do with all the boxes?',
        answer:
          'We take them. Every box, bag, foam insert, plastic wrap and pallet wrap leaves with us and gets disposed of on our end. On a whole-house move-in that is often a truck bed’s worth of cardboard, and it is included in the price — not an add-on.',
      },
      {
        question: 'Can you mount the TVs on the same visit?',
        answer:
          'Yes, and it is the sensible way to do it. Mounting on move-in day means the cabling is handled before the furniture is placed against the wall. We will do the mounts as part of the same block rather than sending you back to book a separate appointment.',
      },
    ],
    related: [
      {
        href: '/services/furniture-assembly',
        title: 'All Furniture Assembly',
        subtitle: 'Every brand, every room',
      },
      {
        href: '/services/tv-mounting',
        title: 'TV Mounting',
        subtitle: 'Mounted the same day as your move-in',
      },
      {
        href: '/partners',
        title: 'Realtor & Mover Partnerships',
        subtitle: 'Closing gifts and turn-day setup',
      },
      {
        href: '/service-areas/spring-hill-tn',
        title: 'Serving Spring Hill, TN',
        subtitle: 'And eight more Middle Tennessee cities',
      },
    ],
  },
];

export function getServiceLandingBySlug(slug: string): ServiceLandingContent | undefined {
  return SERVICE_LANDING_PAGES.find((page) => page.slug === slug);
}

export function serviceLandingPath(slug: string): string {
  return `/services/${slug}`;
}
