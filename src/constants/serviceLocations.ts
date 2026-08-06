// Per-city content for the /service-areas/* local landing pages.
//
// Each entry drives one pre-rendered page, so the copy here has to be genuinely
// different city to city — same-shell pages with the city name swapped in read
// as doorway pages to Google and get filtered out of local results. Everything
// below is written from the real service footprint: Williamson County, Maury
// County, and the Nashville metro, all reachable from the Spring Hill base.

export interface LocationFAQ {
  question: string;
  answer: string;
}

export interface LocationHighlight {
  title: string;
  description: string;
}

export interface ServiceLocation {
  /** URL segment under /service-areas/ */
  slug: string;
  city: string;
  /** Short label used in nav/link lists */
  shortLabel: string;
  region: string;
  county: string;
  zipCodes: string[];
  coordinates: { latitude: string; longitude: string };
  /** Honest travel time from the Spring Hill base */
  driveTime: string;
  /** True for Spring Hill — the page gets "based here" rather than "we serve here" framing */
  isHomeBase?: boolean;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  heroSubtitle: string;
  /** Two paragraphs of city-specific body copy */
  intro: string[];
  /** Why this particular city hires us — must be specific to the housing stock/market */
  highlights: LocationHighlight[];
  neighborhoods: string[];
  /** What people in this city actually book most */
  popularServices: string[];
  faqs: LocationFAQ[];
  /** Slugs of adjacent locations, for internal linking */
  nearbySlugs: string[];
}

export const SERVICE_LOCATIONS: ServiceLocation[] = [
  {
    slug: 'spring-hill-tn',
    city: 'Spring Hill',
    shortLabel: 'Spring Hill',
    region: 'TN',
    county: 'Williamson & Maury Counties',
    zipCodes: ['37174'],
    coordinates: { latitude: '35.7512', longitude: '-86.9300' },
    driveTime: 'Home base — same-day slots most often open here',
    isHomeBase: true,
    metaTitle: 'Furniture Assembly Spring Hill, TN | Boxed2Built',
    metaDescription:
      'Boxed2Built is based in Spring Hill, TN. Professional IKEA, Wayfair, Target and Walmart furniture assembly plus TV mounting. Same-day often available — free quote.',
    h1: 'Furniture Assembly & TV Mounting in Spring Hill, TN',
    heroSubtitle:
      'We live and work here. Spring Hill is our home base, which means shorter lead times, same-day slots when the schedule allows, and no travel fee anywhere in 37174.',
    intro: [
      'Boxed2Built started in Spring Hill and still runs out of Spring Hill. That matters more than it sounds: when a Wayfair delivery lands on your porch Thursday afternoon, we are minutes away rather than an hour up I-65. Spring Hill has been one of the fastest-growing cities in Tennessee for a decade, and most weeks our calendar is a mix of brand-new closings in Wyngate and Benevento East, GM families relocating in from out of state, and long-time residents finally replacing the guest room set.',
      'New construction is the through-line here. A lot of Spring Hill homes are five years old or newer, which means clean drywall, predictable stud spacing, and straightforward TV mounts — but it also means whole houses arriving in boxes at once. We regularly handle full move-in days: beds and dressers in every bedroom, a desk for the office, bar stools for the kitchen island, the patio set for the back deck, and every scrap of cardboard hauled off before we leave.',
    ],
    highlights: [
      {
        title: 'No travel fee, shortest lead time',
        description:
          'Spring Hill is our home ZIP. You get the tightest scheduling window we offer and zero trip charge anywhere in 37174, on either the Williamson or Maury County side of town.',
      },
      {
        title: 'Built for new-construction move-ins',
        description:
          'Whole-house assembly days are routine here. We sequence rooms so your bedrooms are usable by evening, then finish the living areas and haul away every box.',
      },
      {
        title: 'We know the delivery rhythm',
        description:
          'Big-box freight to Spring Hill tends to land late in the week. We keep Friday and Saturday capacity open specifically for the "it just arrived and we need it built" calls.',
      },
    ],
    neighborhoods: [
      'Wyngate Estates',
      'Benevento East',
      'Campbell Station',
      'Cherry Grove',
      'The Crossings',
      'Port Royal',
      'Autumn Ridge',
      'Kings Creek',
      'Burtonwood',
      'Hardison Hills',
    ],
    popularServices: [
      'Whole-house move-in assembly for new builds off Buckner and Duplex',
      'Nursery and crib setup for first-time parents',
      'TV mounting over the fireplace in open-concept great rooms',
      'Garage shelving and overhead storage before winter',
      'Patio and outdoor furniture assembly each spring',
    ],
    faqs: [
      {
        question: 'Do you charge a travel fee in Spring Hill?',
        answer:
          'No. Spring Hill, TN 37174 is our home base, so there is never a trip charge — on either the Williamson County or Maury County side of town. What we quote for the assembly is what you pay.',
      },
      {
        question: 'Can you do same-day furniture assembly in Spring Hill?',
        answer:
          'Often, yes. Because we are based in Spring Hill we can usually work a same-day or next-day job into the schedule, especially midweek. Call or text as soon as your delivery lands and we will tell you honestly what is open.',
      },
      {
        question: 'Do you work in the new subdivisions off Buckner Lane and Duplex Road?',
        answer:
          'Constantly. Newer Spring Hill construction is a large share of what we do — Wyngate Estates, Benevento East, Campbell Station and the developments still going up around them. We are used to gate codes, builder punch-list timing, and closing-day deliveries.',
      },
    ],
    nearbySlugs: ['thompsons-station-tn', 'columbia-tn', 'franklin-tn', 'chapel-hill-tn'],
  },
  {
    slug: 'franklin-tn',
    city: 'Franklin',
    shortLabel: 'Franklin',
    region: 'TN',
    county: 'Williamson County',
    zipCodes: ['37064', '37067', '37069'],
    coordinates: { latitude: '35.9251', longitude: '-86.8689' },
    driveTime: 'About 20 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Franklin, TN | TV Mounting | Boxed2Built',
    metaDescription:
      'Professional furniture assembly and TV mounting in Franklin, TN. IKEA, Pottery Barn, Wayfair and more — historic homes and new builds alike. Free quote, no trip fee.',
    h1: 'Furniture Assembly & TV Mounting in Franklin, TN',
    heroSubtitle:
      'From 1890s homes off Main Street to brand-new builds in Berry Farms, we bring the right hardware for the wall you actually have. About 20 minutes from our Spring Hill shop.',
    intro: [
      'Franklin is two housing markets wearing one name, and the assembly work reflects it. Downtown and the historic district are full of homes with plaster-over-lath walls, irregular stud spacing, and rooms that were never squared to begin with. Out toward Berry Farms, Ladd Park and Westhaven, it is modern framing and predictable layouts. We show up prepared for either — stud finders that actually work through plaster, masonry anchors for brick chimney breasts, and the patience to shim a dresser level on a floor that has been settling since Grover Cleveland was president.',
      'Franklin also buys differently. Alongside the usual IKEA and Wayfair boxes we assemble a lot of Pottery Barn, Arhaus, Restoration Hardware and Room & Board pieces here — heavier hardwood furniture where a stripped cam lock or an over-torqued bolt is an expensive mistake. We torque by hand where the manufacturer calls for it, keep the packaging until you have inspected the finish, and take every box with us when we go.',
    ],
    highlights: [
      {
        title: 'Plaster, brick and 100-year-old framing',
        description:
          'Historic Franklin walls do not behave like drywall. We carry toggle, masonry and heavy-duty anchors so a TV or a tall bookcase gets secured into something real, not just lath.',
      },
      {
        title: 'Careful with premium furniture',
        description:
          'Pottery Barn, Arhaus and Restoration Hardware pieces get hand-finished torque and blanket protection on hardwood floors. No power driver where the instructions say otherwise.',
      },
      {
        title: 'Cool Springs delivery turnaround',
        description:
          'Plenty of Franklin orders come out of the Cool Springs corridor with tight delivery windows. We schedule around the freight, not the other way around.',
      },
    ],
    neighborhoods: [
      'Westhaven',
      'Berry Farms',
      'Ladd Park',
      'Fieldstone Farms',
      "McKay's Mill",
      'Downtown / Historic District',
      'Cool Springs',
      'Sullivan Farms',
      'Simmons Ridge',
      'Founders Pointe',
    ],
    popularServices: [
      'TV mounting on brick and plaster in historic downtown homes',
      'Home office and built-in style shelving assembly in Cool Springs',
      'Premium hardwood bedroom sets in Westhaven and Ladd Park',
      'Playset and swing set builds on larger Fieldstone Farms lots',
      'Move-in assembly for relocations into Berry Farms',
    ],
    faqs: [
      {
        question: 'Can you mount a TV on a plaster or brick wall in a historic Franklin home?',
        answer:
          'Yes — that is one of the most common calls we get in 37064. Plaster-over-lath and old brick both need different anchors than modern drywall, and stud spacing in pre-1930 homes is rarely the tidy 16 inches on center. We locate real structure before we drill, use masonry or heavy-duty toggle hardware where appropriate, and tell you honestly if a particular wall is not safe for the mount you bought.',
      },
      {
        question: 'Do you assemble Pottery Barn and Restoration Hardware furniture?',
        answer:
          'Regularly. Franklin buys a lot of solid-wood furniture from Pottery Barn, Arhaus, Restoration Hardware, Room & Board and Ethan Allen. These pieces use different joinery than flat-pack particle board and are far easier to damage by over-tightening, so we follow manufacturer torque guidance by hand and protect your floors while we work.',
      },
      {
        question: 'Is there a travel charge to Franklin?',
        answer:
          'No. Franklin is a core service area for us — roughly 20 minutes up Columbia Pike from our Spring Hill base — and all three ZIP codes (37064, 37067 and 37069) are covered with no additional trip fee.',
      },
    ],
    nearbySlugs: ['brentwood-tn', 'thompsons-station-tn', 'spring-hill-tn', 'nolensville-tn'],
  },
  {
    slug: 'brentwood-tn',
    city: 'Brentwood',
    shortLabel: 'Brentwood',
    region: 'TN',
    county: 'Williamson County',
    zipCodes: ['37027'],
    coordinates: { latitude: '36.0331', longitude: '-86.7828' },
    driveTime: 'About 30 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Brentwood, TN | TV Mounting | Boxed2Built',
    metaDescription:
      'Furniture assembly and TV mounting in Brentwood, TN 37027. Media rooms, home offices, large-format displays and premium furniture handled properly. Free quote.',
    h1: 'Furniture Assembly & TV Mounting in Brentwood, TN',
    heroSubtitle:
      'Bigger rooms, bigger displays, and furniture worth being careful with. We handle Brentwood media rooms, home offices and multi-room projects start to finish.',
    intro: [
      'Brentwood jobs tend to be larger than average, and not just in square footage. A typical 37027 call is a 75-inch or larger display going up in a great room with a two-story wall, a full home office build-out, or a media room where the mount, the sound bar and the component shelf all have to line up and the cabling has to disappear. Large-format TVs are genuinely unforgiving — the leverage on the bracket is significant, and a mount that catches only one stud is a real hazard. We find structure, we use hardware rated for the load, and we will tell you when a wall needs a different approach.',
      'The furniture side skews premium here too: solid hardwood office suites, custom closet systems, oversized sectionals, and Peloton and home-gym equipment that arrives in three heavy boxes with a manual written for someone else. Multi-room and whole-floor projects are common, so we usually block a longer window for Brentwood rather than squeezing it between jobs, and we bring floor protection for hardwood and stair runners.',
    ],
    highlights: [
      {
        title: 'Large-format and over-fireplace mounting',
        description:
          '75-inch and up displays need multi-stud attachment and correctly rated hardware. On stone and masonry fireplaces we anchor into the substrate properly rather than hoping for a stud.',
      },
      {
        title: 'Media rooms and full cable management',
        description:
          'Mount, sound bar, center channel and components aligned and levelled, with in-wall routing or clean channel work so nothing dangles.',
      },
      {
        title: 'Multi-room days, properly scheduled',
        description:
          'Whole-floor and multi-room Brentwood projects get a dedicated block, floor and stair protection, and a room-by-room walkthrough before we call it done.',
      },
    ],
    neighborhoods: [
      'Governors Club',
      'Annandale',
      'Taramore',
      'Witherspoon',
      'Concord Hunt',
      'Maryland Farms',
      'Raintree Forest',
      'Sunset Park',
      'Brentwood South',
      'Riverwood',
    ],
    popularServices: [
      'Large-format TV mounting over stone fireplaces',
      'Complete media room and sound bar installation',
      'Executive home office and hardwood desk assembly',
      'Home gym and fitness equipment assembly',
      'Closet system and custom storage installation',
    ],
    faqs: [
      {
        question: 'Can you mount a 75-inch or 85-inch TV in Brentwood?',
        answer:
          'Yes, and large-format displays are a big share of our 37027 work. A TV that size puts real leverage on the bracket, so it has to catch multiple studs or be anchored into solid substrate — never a single stud and never drywall anchors alone. We verify what is behind the wall before drilling and use hardware rated for the actual weight of your display and mount.',
      },
      {
        question: 'Can you mount a TV above a stone or masonry fireplace?',
        answer:
          'Usually, yes. Stone, brick and stacked-veneer fireplaces need masonry anchors set into the substrate rather than the veneer face, and heat above a working firebox is worth discussing before you commit to the location. We will look at the specific fireplace, tell you what is safe, and route cabling so the finished wall stays clean.',
      },
      {
        question: 'Do you handle whole-floor or multi-room projects?',
        answer:
          'Yes. Brentwood projects are frequently several rooms at once, so we block a longer window rather than fitting it between other jobs. We bring floor and stair protection, sequence the rooms with you at the start, and walk every completed space before we ask for payment.',
      },
    ],
    nearbySlugs: ['franklin-tn', 'nolensville-tn', 'nashville-tn', 'spring-hill-tn'],
  },
  {
    slug: 'thompsons-station-tn',
    city: "Thompson's Station",
    shortLabel: "Thompson's Station",
    region: 'TN',
    county: 'Williamson County',
    zipCodes: ['37179'],
    coordinates: { latitude: '35.8039', longitude: '-86.9089' },
    driveTime: 'About 10 minutes from our Spring Hill base',
    metaTitle: "Furniture Assembly Thompson's Station, TN | Boxed2Built",
    metaDescription:
      "Furniture assembly and TV mounting in Thompson's Station, TN 37179. New-build move-ins, nursery setup and garage storage. Ten minutes from our Spring Hill base.",
    h1: "Furniture Assembly & TV Mounting in Thompson's Station, TN",
    heroSubtitle:
      "Our closest neighbor. Thompson's Station is about ten minutes up the road, so scheduling here is nearly as flexible as Spring Hill itself.",
    intro: [
      "Thompson's Station is the shortest drive on our map, and it shows in how we schedule it — short-notice requests in 37179 are usually easy to accommodate. The town has grown quickly around Tollgate Village, Bridgemore Village and Canterbury, which means a steady stream of first-time closings and young families furnishing an entire house on a budget and a deadline.",
      'That produces a very particular kind of job: several rooms of flat-pack at once, mostly from Wayfair, Amazon, Target and IKEA, all delivered within a week of each other. We are happy to take the whole stack in one visit. Bedrooms first so the house is livable that night, then the office and living areas, then garage shelving if it is on the list — and every box, bag and foam corner leaves with us.',
    ],
    highlights: [
      {
        title: 'Ten minutes away',
        description:
          "Thompson's Station is our nearest service area. Short-notice and same-day requests in 37179 are usually workable, and there is no trip charge.",
      },
      {
        title: 'New-build friendly',
        description:
          'Tollgate Village, Bridgemore and Canterbury are largely recent construction — clean framing, predictable studs, and TV mounts that go up without drama.',
      },
      {
        title: 'Whole-house in one visit',
        description:
          'Rather than three separate appointments, we will take the full stack of boxes in a single block and sequence the rooms so the bedrooms are usable first.',
      },
    ],
    neighborhoods: [
      'Tollgate Village',
      'Bridgemore Village',
      'Canterbury',
      'Fields of Canterbury',
      'Bridgemore Estates',
      'Cherry Hill',
      'Heritage Common',
      'Fountain Brooke',
    ],
    popularServices: [
      'Full move-in assembly for new closings in Tollgate Village',
      'Crib and nursery furniture setup',
      'Bunk beds and kids’ bedroom furniture',
      'Garage shelving and overhead racks',
      'TV mounting and cable concealment in new builds',
    ],
    faqs: [
      {
        question: "How quickly can you get to Thompson's Station?",
        answer:
          "Thompson's Station is our closest service area — roughly ten minutes from our Spring Hill base. Short-notice and same-day requests in 37179 are usually the easiest ones on our schedule to accommodate. Call or text and we will tell you what is open today.",
      },
      {
        question: 'Can you assemble an entire house of furniture in one appointment?',
        answer:
          'Yes, and it is common here. Rather than booking three separate visits, we will block the time to take the whole delivery at once. We start with bedrooms so the house is livable by that evening, move through the office and living areas, and finish with anything headed for the garage. All packaging leaves with us.',
      },
      {
        question: 'Do you build bunk beds and kids’ furniture?',
        answer:
          'Frequently. Bunk beds in particular are worth having done properly — every guardrail bolt, ladder attachment and frame connection has to be torqued correctly, and tall pieces in a child’s room should be anchored to the wall. We follow the manufacturer’s safety instructions to the letter and will not skip the anti-tip hardware.',
      },
    ],
    nearbySlugs: ['spring-hill-tn', 'franklin-tn', 'columbia-tn', 'brentwood-tn'],
  },
  {
    slug: 'nolensville-tn',
    city: 'Nolensville',
    shortLabel: 'Nolensville',
    region: 'TN',
    county: 'Williamson County',
    zipCodes: ['37135'],
    coordinates: { latitude: '35.9526', longitude: '-86.6689' },
    driveTime: 'About 30 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Nolensville, TN | TV Mounting | Boxed2Built',
    metaDescription:
      'Furniture assembly and TV mounting in Nolensville, TN 37135. Bent Creek, Silver Stream Farm and Summerlyn. Nursery setup, playsets, garage storage. Free quote.',
    h1: 'Furniture Assembly & TV Mounting in Nolensville, TN',
    heroSubtitle:
      'One of the youngest towns in Williamson County by household age — which means a lot of nurseries, bunk beds, playsets and garages that need to hold more than they were built for.',
    intro: [
      'Nolensville has grown from a crossroads into one of the fastest-expanding towns in Williamson County, and the work here reflects an unusually young population. Bent Creek, Silver Stream Farm, Summerlyn and Winterset Woods are full of families with small children, and our 37135 calendar leans heavily toward nursery furniture, convertible cribs, bunk beds, playroom storage and backyard playsets.',
      'Child-focused assembly is the part of this trade where shortcuts actually matter. Cribs have to meet the manufacturer’s spec exactly, bunk bed guardrails and ladders need every fastener torqued and re-checked, and any tall dresser or bookcase in a kid’s room gets anchored to a stud — not to a drywall plug. We bring the anti-tip hardware, we install it, and we show you it is in before we leave.',
    ],
    highlights: [
      {
        title: 'Nursery and child-safety focused',
        description:
          'Cribs, changing tables, convertible beds and bunk beds built to manufacturer spec, with anti-tip anchoring installed on every tall piece in a child’s room.',
      },
      {
        title: 'Backyard playsets and swing sets',
        description:
          'Multi-hour outdoor builds with every structural connection double-checked. Bring us the boxes; we will bring the drill, the level and the patience.',
      },
      {
        title: 'Garage storage that holds up',
        description:
          'Wall shelving and overhead racks anchored into framing so they carry real weight, not just the empty bins you started with.',
      },
    ],
    neighborhoods: [
      'Bent Creek',
      'Silver Stream Farm',
      'Summerlyn',
      'Winterset Woods',
      'Ballenger Farms',
      'Benington',
      'Burkitt Village',
      'Historic Nolensville',
    ],
    popularServices: [
      'Convertible crib and full nursery setup',
      'Bunk beds and loft beds with safety anchoring',
      'Outdoor playset and swing set assembly',
      'Playroom storage cubbies and toy organization',
      'Garage overhead racks and wall shelving',
    ],
    faqs: [
      {
        question: 'Do you assemble cribs and nursery furniture in Nolensville?',
        answer:
          'Yes — nursery work is one of our most requested services in 37135. Cribs are built strictly to the manufacturer’s instructions with every fastener torqued to spec, and we anchor dressers, changing tables and bookcases to wall framing with the anti-tip hardware included in the box. If your set did not come with anchors, tell us when you book and we will bring them.',
      },
      {
        question: 'Can you build an outdoor playset or swing set?',
        answer:
          'Yes. Playsets are genuinely large jobs — often several hours — and they are much safer built by someone who has done it before. We follow the manufacturer sequence exactly, verify every structural bolt, and check the finished frame for square and stability. Send us the model and we will quote it accurately.',
      },
      {
        question: 'Will you anchor tall furniture to the wall?',
        answer:
          'Always, in any room a child uses, and we recommend it everywhere else. Tip-over incidents involving dressers and bookcases are a real hazard, so we locate a stud, install the anchor kit properly, and show you the finished attachment during the walkthrough.',
      },
    ],
    nearbySlugs: ['brentwood-tn', 'franklin-tn', 'nashville-tn', 'spring-hill-tn'],
  },
  {
    slug: 'columbia-tn',
    city: 'Columbia',
    shortLabel: 'Columbia',
    region: 'TN',
    county: 'Maury County',
    zipCodes: ['38401'],
    coordinates: { latitude: '35.6151', longitude: '-87.0353' },
    driveTime: 'About 15 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Columbia, TN | TV Mounting | Boxed2Built',
    metaDescription:
      'Furniture assembly and TV mounting in Columbia, TN 38401. Historic homes and new subdivisions, apartments and rentals. Fifteen minutes from Spring Hill — free quote.',
    h1: 'Furniture Assembly & TV Mounting in Columbia, TN',
    heroSubtitle:
      'Maury County’s seat, fifteen minutes down the pike from us. Historic homes near the square, new subdivisions on the edges, and a lot of first apartments in between.',
    intro: [
      'Columbia has the widest range of housing of anywhere we work. Within a couple of miles you will find 1880s homes around the courthouse square with plaster walls and twelve-foot ceilings, mid-century ranches with real hardwood and unpredictable framing, brand-new subdivisions going up toward Northfield and Cherry Glen, and a growing stock of apartments and rentals. Each one changes how a TV gets mounted and what a dresser needs to sit level.',
      'It also means a lot of budget-conscious, practical work — Amazon and Walmart flat-pack, first apartments, student and starter furniture, and rentals where the tenant needs the mount done cleanly enough to come back down at move-out. We are straightforward about pricing on all of it, and there is no trip fee to Columbia; it is fifteen minutes from our door.',
    ],
    highlights: [
      {
        title: 'Historic square to new subdivision',
        description:
          'Plaster and lath near downtown, modern framing out toward Northfield. We bring anchors and technique for both rather than assuming drywall.',
      },
      {
        title: 'Rental and apartment friendly',
        description:
          'Mounts installed cleanly and documented so they can come back down at move-out, and assembly sized for smaller rooms and tighter stairwells.',
      },
      {
        title: 'No trip fee from Spring Hill',
        description:
          'Columbia is fifteen minutes from our base. Maury County is core territory for us, not an outlying add-on.',
      },
    ],
    neighborhoods: [
      'Historic Downtown Square',
      'Northfield',
      'Cherry Glen',
      'Deerfield Estates',
      'Graymere',
      'Riverside',
      'Hampshire Pike corridor',
      'Highlands',
    ],
    popularServices: [
      'TV mounting in older homes with plaster or uneven framing',
      'Apartment and first-place furniture assembly',
      'Amazon and Walmart flat-pack builds',
      'Rental-friendly mounting and later removal',
      'Dining sets, bed frames and dresser assembly',
    ],
    faqs: [
      {
        question: 'Do you serve Columbia and the rest of Maury County?',
        answer:
          'Yes. Columbia is about fifteen minutes from our Spring Hill base and is one of our core service areas — no travel fee to 38401. We also cover the surrounding Maury County communities, including Mount Pleasant.',
      },
      {
        question: 'Can you mount a TV in a rental or apartment?',
        answer:
          'Yes, and we do a lot of it in Columbia. We install cleanly, keep the hole count to the minimum the mount requires, and can walk you through what your landlord will likely expect at move-out. If you need the mount removed and the wall patched later, we can come back and do that too.',
      },
      {
        question: 'What about older homes near the downtown square?',
        answer:
          'Those are some of our favorite jobs. Pre-1930 Columbia homes typically have plaster over lath, irregular stud spacing, and floors that have settled — none of which is a problem if you plan for it. We locate real structure before drilling, use anchors suited to the wall, and shim furniture level rather than leaving it rocking.',
      },
    ],
    nearbySlugs: ['spring-hill-tn', 'mount-pleasant-tn', 'thompsons-station-tn', 'chapel-hill-tn'],
  },
  {
    slug: 'nashville-tn',
    city: 'Nashville',
    shortLabel: 'Nashville',
    region: 'TN',
    county: 'Davidson County',
    zipCodes: ['37203', '37204', '37205', '37206', '37209', '37211', '37215', '37220'],
    coordinates: { latitude: '36.1627', longitude: '-86.7816' },
    driveTime: 'About 45 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Nashville, TN | IKEA | Boxed2Built',
    metaDescription:
      'Furniture assembly and TV mounting in Nashville, TN. IKEA and Wayfair flat-pack, condos, walk-ups and tight-turn apartments. Book a window that fits your building.',
    h1: 'Furniture Assembly & TV Mounting in Nashville, TN',
    heroSubtitle:
      'Condos, walk-ups, tall-and-skinnies and 1920s bungalows. Nashville assembly is as much a logistics problem as a build problem — we plan for both.',
    intro: [
      'There is no IKEA store in Middle Tennessee, so every IKEA piece in Nashville arrives as freight on a pallet or a stack of boxes at your door. That single fact shapes a lot of our Davidson County work: MALM dressers, PAX wardrobe systems, KALLAX units and BILLY bookcases that showed up flat and now have to get up a staircase, through a doorway, and into a room that is smaller than the showroom photo suggested.',
      'Nashville jobs are logistics as much as carpentry. Tall-and-skinnies in Sylvan Park and East Nashville have staircases that will not take a fully assembled wardrobe, so we build in place. Condos in the Gulch and Germantown have loading-dock hours and freight elevator reservations we plan around. Historic bungalows in 12 South have plaster walls and antique framing. Tell us the building when you book and we will size the window accordingly.',
    ],
    highlights: [
      {
        title: 'Built in the room, not the driveway',
        description:
          'Narrow stairwells and tight doorways in tall-and-skinnies and walk-ups mean assembling in place. We plan the sequence so the finished piece actually fits where it is going.',
      },
      {
        title: 'IKEA and flat-pack specialists',
        description:
          'PAX, MALM, KALLAX, BILLY and the rest. With no IKEA store in the region, every one of these arrives boxed — and we have built most of the catalogue more than once.',
      },
      {
        title: 'Condo and building logistics',
        description:
          'Freight elevator windows, loading-dock hours, COI requirements and parking. Tell us the building and we will schedule around its rules instead of yours.',
      },
    ],
    neighborhoods: [
      '12 South',
      'East Nashville',
      'Germantown',
      'The Gulch',
      'Green Hills',
      'Sylvan Park',
      'Donelson',
      'Berry Hill',
      'The Nations',
      'Antioch',
    ],
    popularServices: [
      'IKEA PAX wardrobe and MALM dresser assembly',
      'Small-space and studio apartment furniture',
      'TV mounting in condos and historic bungalows',
      'Murphy beds and space-saving furniture',
      'Office and desk setups for work-from-home',
    ],
    faqs: [
      {
        question: 'Do you assemble IKEA furniture in Nashville?',
        answer:
          'Yes, and it is a large share of our Davidson County work. There is no IKEA store in Middle Tennessee, so everything ships flat — PAX wardrobes, MALM dressers, KALLAX shelving, BILLY bookcases and the rest. We have built most of the catalogue repeatedly and know where the instructions are misleading.',
      },
      {
        question: 'Can you work in a condo with a freight elevator or loading dock?',
        answer:
          'Yes. Tell us the building when you book and we will work within its rules — freight elevator reservations, loading-dock hours, parking and any certificate-of-insurance requirement. Planning that up front is the difference between a smooth appointment and a wasted trip.',
      },
      {
        question: 'My staircase is too narrow for an assembled wardrobe. Is that a problem?',
        answer:
          'No — it is normal in Nashville, especially in tall-and-skinnies and older walk-ups. We assemble in the destination room rather than building downstairs and carrying it up, which is also how the manufacturer intends most large flat-pack pieces to be handled.',
      },
    ],
    nearbySlugs: ['brentwood-tn', 'nolensville-tn', 'franklin-tn', 'spring-hill-tn'],
  },
  {
    slug: 'mount-pleasant-tn',
    city: 'Mount Pleasant',
    shortLabel: 'Mount Pleasant',
    region: 'TN',
    county: 'Maury County',
    zipCodes: ['38474'],
    coordinates: { latitude: '35.5359', longitude: '-87.2003' },
    driveTime: 'About 25 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Mount Pleasant, TN | Boxed2Built',
    metaDescription:
      'Furniture assembly, TV mounting and outdoor builds in Mount Pleasant, TN 38474. Patio sets, sheds, workshop shelving and flat-pack. Maury County — no trip fee.',
    h1: 'Furniture Assembly & TV Mounting in Mount Pleasant, TN',
    heroSubtitle:
      'Bigger lots, older houses, and a lot of work that happens outside the walls. Mount Pleasant is about 25 minutes from us and squarely inside our Maury County footprint.',
    intro: [
      'Mount Pleasant is a different kind of job from the Williamson County subdivisions. Lots are larger, houses are older, and a good share of what we assemble here never goes indoors: patio and deck furniture, gazebos and pergolas, storage sheds, workshop benches, grills and smokers, and the occasional trampoline. Outdoor builds are heavier, more weather-dependent and considerably more fiddly than a bedroom dresser, and they are much easier with a second set of hands and the right tools already on the truck.',
      'Indoors, the historic housing stock around the Main Street district behaves like Columbia’s — plaster, lath, real wood framing and floors with opinions. We plan for it rather than discovering it halfway through. Mount Pleasant is roughly 25 minutes from our Spring Hill base and carries no trip charge.',
    ],
    highlights: [
      {
        title: 'Outdoor and workshop builds',
        description:
          'Patio sets, pergolas, sheds, workbenches, grills and smokers. Heavier, weather-sensitive assembly that goes much faster with the right tools already on site.',
      },
      {
        title: 'Older-home experience',
        description:
          'Plaster walls, true-dimension lumber and settled floors around the historic district. We locate real structure and shim things level.',
      },
      {
        title: 'Full Maury County coverage',
        description:
          'Mount Pleasant is inside our standard service area — about 25 minutes from Spring Hill, with no additional travel charge.',
      },
    ],
    neighborhoods: [
      'Historic Main Street District',
      'Hay Long Avenue area',
      'Ridley Park',
      'Arrow Lake',
      'Bethel',
      'Rural Maury County properties',
    ],
    popularServices: [
      'Patio, deck and outdoor furniture assembly',
      'Storage shed, gazebo and pergola builds',
      'Workshop benches and garage shelving',
      'Grill and smoker assembly',
      'Bed frames, dressers and indoor flat-pack',
    ],
    faqs: [
      {
        question: 'Do you build storage sheds and outdoor structures?',
        answer:
          'Yes. Kit sheds, gazebos, pergolas and similar outdoor structures are regular work for us in Mount Pleasant and rural Maury County. These are multi-hour builds that depend on a reasonably level base, so tell us what the site looks like when you book and we will quote it honestly.',
      },
      {
        question: 'Do you travel to rural addresses outside town?',
        answer:
          'Yes — rural Maury County addresses are covered at no extra charge within our standard service area. If you are unsure whether your address qualifies, send it over and we will confirm before you book. We would rather check than surprise you.',
      },
      {
        question: 'Can you assemble a grill, smoker or trampoline?',
        answer:
          'All three, and we do them often. Grills and smokers involve gas fittings and heat-critical components that need to be right, and trampolines have enclosure and spring assemblies that are far safer with two people and the correct tools. We take the packaging with us when we go.',
      },
    ],
    nearbySlugs: ['columbia-tn', 'spring-hill-tn', 'chapel-hill-tn', 'thompsons-station-tn'],
  },
  {
    slug: 'chapel-hill-tn',
    city: 'Chapel Hill',
    shortLabel: 'Chapel Hill',
    region: 'TN',
    county: 'Marshall County',
    zipCodes: ['37034'],
    coordinates: { latitude: '35.6317', longitude: '-86.6939' },
    driveTime: 'About 20 minutes from our Spring Hill base',
    metaTitle: 'Furniture Assembly Chapel Hill, TN | Boxed2Built',
    metaDescription:
      'Furniture assembly and TV mounting in Chapel Hill, TN 37034. Playsets, patio furniture, garage storage and flat-pack builds. Twenty minutes from Spring Hill.',
    h1: 'Furniture Assembly & TV Mounting in Chapel Hill, TN',
    heroSubtitle:
      'Twenty minutes south of Spring Hill down Highway 31A. Bigger yards, more garage space, and plenty of projects the delivery driver leaves at the end of the driveway.',
    intro: [
      'Chapel Hill sits just over the Marshall County line, about twenty minutes from our Spring Hill base, and the work here has a distinctly rural-residential character. Properties are larger, garages and outbuildings actually get used as workshops, and outdoor projects dominate the warm months — playsets, trampolines, patio sets, carports and storage buildings, usually delivered curbside on a pallet with a manual and best wishes.',
      'Indoors it is mostly straightforward flat-pack: bedroom sets, dining tables, entertainment centres and office furniture from Amazon, Walmart, Wayfair and Ashley. Because it is a shorter drive than most people assume, Chapel Hill sits comfortably inside our no-trip-fee area, and we can usually pair it with a Spring Hill or Columbia job the same day if timing is tight.',
    ],
    highlights: [
      {
        title: 'Curbside pallet to finished build',
        description:
          'Freight drops at the end of the driveway are normal out here. We handle getting it where it needs to go, then build it there.',
      },
      {
        title: 'Playsets, trampolines and patio sets',
        description:
          'The outdoor projects that eat an entire weekend. We bring the tools, follow the manufacturer sequence, and check every structural connection.',
      },
      {
        title: 'Garage and workshop storage',
        description:
          'Shelving, overhead racks and workbenches anchored into framing so they hold real tools and real weight.',
      },
    ],
    neighborhoods: [
      'Downtown Chapel Hill',
      'Duplex Road corridor',
      'Fly',
      'Wilhoite',
      'Rural Marshall County properties',
      'Henry Horton area',
    ],
    popularServices: [
      'Playset, swing set and trampoline assembly',
      'Patio and outdoor furniture builds',
      'Garage shelving, racks and workbenches',
      'Bedroom, dining and living room flat-pack',
      'TV mounting and entertainment centre setup',
    ],
    faqs: [
      {
        question: 'Do you come out to Chapel Hill and Marshall County?',
        answer:
          'Yes. Chapel Hill is about twenty minutes from our Spring Hill base down Highway 31A — closer than several of the Williamson County towns we serve — and it is inside our no-trip-fee area. If your address is further out in Marshall County, send it to us and we will confirm coverage before you book.',
      },
      {
        question: 'My delivery was left on a pallet at the end of the driveway. Can you still help?',
        answer:
          'Yes, that is routine out here. Freight carriers rarely bring anything past the curb. We will get the boxes to where the furniture is going and assemble it in place, then take all the packaging and pallet wrap with us.',
      },
      {
        question: 'Can you build a trampoline or playset?',
        answer:
          'Yes, both are common Chapel Hill jobs. They are long builds — often several hours — and safety depends on getting every structural connection and enclosure fastener right. We follow the manufacturer sequence exactly and check the finished frame before we leave.',
      },
    ],
    nearbySlugs: ['spring-hill-tn', 'columbia-tn', 'thompsons-station-tn', 'nolensville-tn'],
  },
];

export const LOCATION_HUB_META = {
  title: 'Service Areas | Furniture Assembly Middle TN | Boxed2Built',
  description:
    'Boxed2Built serves Spring Hill, Franklin, Brentwood, Thompson’s Station, Nolensville, Columbia, Nashville, Mount Pleasant and Chapel Hill, TN. Find your city.',
};

export const SITE_URL = 'https://boxed2built.com';

export function locationPath(slug: string): string {
  return `/service-areas/${slug}`;
}

export function locationUrl(slug: string): string {
  return `${SITE_URL}${locationPath(slug)}`;
}

export function getLocationBySlug(slug: string): ServiceLocation | undefined {
  return SERVICE_LOCATIONS.find((location) => location.slug === slug);
}

export function getNearbyLocations(location: ServiceLocation): ServiceLocation[] {
  return location.nearbySlugs
    .map((slug) => getLocationBySlug(slug))
    .filter((nearby): nearby is ServiceLocation => Boolean(nearby));
}

/** "Spring Hill, TN" — used in schema areaServed and NAP-consistent body copy. */
export function locationLabel(location: ServiceLocation): string {
  return `${location.city}, ${location.region}`;
}
