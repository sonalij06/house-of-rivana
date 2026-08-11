/**
 * Demo catalog for House of Rivana — artificial / fashion jewellery.
 *
 * Prices are in rupees here for readability; the seed converts to paise.
 * Images point at the generated SVG placeholders in /public/placeholders —
 * swap them for real photography through /admin/products.
 */

export type SeedVariant = {
  label: string;
  size?: string;
  metal?:
    | "YELLOW_GOLD"
    | "ROSE_GOLD"
    | "WHITE_GOLD"
    | "STERLING_SILVER"
    | "PLATINUM"
    | "GOLD_VERMEIL"
    | "BRASS";
  length?: string;
  price: number;
  compareAt?: number;
  stock: number;
};

export type SeedProduct = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  story?: string;
  metal: SeedVariant["metal"];
  purity?: string;
  gemstone?: string;
  weightGrams?: number;
  dimensions?: string;
  price: number;
  compareAt?: number;
  images: [string, string];
  collections: string[];
  featured?: boolean;
  bestseller?: boolean;
  newArrival?: boolean;
  madeToOrderDays?: number;
  variants: SeedVariant[];
};

export const CARE_TEXT =
  "Store each piece in its own pouch, away from moisture. Remove before swimming, bathing or applying perfume. Wipe gently with a soft dry cloth after wear. Plating and colour can soften with heavy daily use — that is normal for fashion jewellery.";

export const collections = [
  {
    slug: "bridal-edit",
    name: "Bridal Edit",
    subtitle: "Wedding & festive statement",
    description:
      "Bold plated sets, AD polki looks and party pieces designed for shaadi season — statement shine without precious-metal prices.",
    heroImage: "/placeholders/collection-bridal.svg",
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: "everyday-shine",
    name: "Everyday Shine",
    subtitle: "Lightweight looks for daily wear",
    description:
      "Feather-light plated chains, hoops and stacks meant for office-to-dinner — easy to layer, easy on the budget.",
    heroImage: "/placeholders/collection-everyday.svg",
    isFeatured: true,
    sortOrder: 2,
  },
  {
    slug: "rings",
    name: "Rings",
    subtitle: "Stacks, bands and solitaire-style",
    description:
      "From whisper-thin stackers to CZ solitaire-style rings — sized for everyday wear and photo-ready sparkle.",
    heroImage: "/placeholders/collection-rings.svg",
    isFeatured: true,
    sortOrder: 3,
  },
  {
    slug: "necklaces",
    name: "Necklaces",
    subtitle: "Chains, pendants and layers",
    description:
      "Adjustable lengths, secure clasps and pendants weighted to sit where you want them — made for layering.",
    heroImage: "/placeholders/collection-necklaces.svg",
    isFeatured: true,
    sortOrder: 4,
  },
  {
    slug: "earrings",
    name: "Earrings",
    subtitle: "Studs to statement drops",
    description:
      "Comfort posts, secure backs and drops balanced to hang straight through a long evening.",
    heroImage: "/placeholders/collection-earrings.svg",
    isFeatured: false,
    sortOrder: 5,
  },
  {
    slug: "bracelets",
    name: "Bracelets & Bangles",
    subtitle: "Wrist stories",
    description:
      "Slip-on bangles and clasp bracelets in popular wrist sizes — kundan-style, tennis looks and everyday cuffs.",
    heroImage: "/placeholders/collection-bracelets.svg",
    isFeatured: false,
    sortOrder: 6,
  },
];

export const products: SeedProduct[] = [
  {
    slug: "rivana-solitaire-ring",
    name: "Rivana Solitaire-Style Ring",
    shortDescription:
      "A six-prong CZ solitaire look in 18K gold plating — engagement-style sparkle for fashion wear.",
    description:
      "Our signature solitaire-style ring. A brilliant CZ stone sits in a six-prong basket that catches light from every angle, on a slim tapered band that stacks cleanly. Fashion jewellery — plated base metal with cubic zirconia, not solid gold or a natural diamond.",
    story:
      "The first piece we sketched for the house: a classic silhouette at a price you can actually wear every day.",
    metal: "YELLOW_GOLD",
    purity: "18K gold plated",
    gemstone: "Cubic zirconia",
    weightGrams: 3.4,
    dimensions: "Band 1.8-2.1mm · Setting height 6.2mm",
    price: 2499,
    compareAt: 3499,
    images: ["/placeholders/solitaire-a.svg", "/placeholders/solitaire-b.svg"],
    collections: ["bridal-edit", "rings"],
    featured: true,
    bestseller: true,
    variants: [
      { label: "Gold-plated · Size 12", size: "12", metal: "YELLOW_GOLD", price: 2499, compareAt: 3499, stock: 14 },
      { label: "Gold-plated · Size 14", size: "14", metal: "YELLOW_GOLD", price: 2499, compareAt: 3499, stock: 18 },
      { label: "Gold-plated · Size 16", size: "16", metal: "YELLOW_GOLD", price: 2599, compareAt: 3599, stock: 10 },
      { label: "Rose gold-plated · Size 14", size: "14", metal: "ROSE_GOLD", price: 2599, compareAt: 3599, stock: 8 },
      { label: "Silver-tone · Size 14", size: "14", metal: "WHITE_GOLD", price: 2499, compareAt: 3499, stock: 7 },
    ],
  },
  {
    slug: "aurelia-hoop-earrings",
    name: "Aurelia Hoop Earrings",
    shortDescription: "Lightweight plated hoops with a hidden hinge and a clean seamless look.",
    description:
      "Smooth tube hoops in anti-tarnish gold plating with a discreet hinged closure. At 24mm they read as a statement without weighing down your lobes — built for all-day fashion wear.",
    metal: "YELLOW_GOLD",
    purity: "Anti-tarnish gold plated",
    weightGrams: 1.9,
    dimensions: "24mm diameter · 2mm tube",
    price: 1299,
    compareAt: 1799,
    images: ["/placeholders/earrings-a.svg", "/placeholders/earrings-b.svg"],
    collections: ["everyday-shine", "earrings"],
    featured: true,
    bestseller: true,
    variants: [
      { label: "Gold-plated · 24mm", size: "24mm", metal: "YELLOW_GOLD", price: 1299, compareAt: 1799, stock: 32 },
      { label: "Gold-plated · 32mm", size: "32mm", metal: "YELLOW_GOLD", price: 1499, compareAt: 1999, stock: 24 },
      { label: "Rose gold-plated · 24mm", size: "24mm", metal: "ROSE_GOLD", price: 1349, compareAt: 1849, stock: 16 },
    ],
  },
  {
    slug: "meera-emerald-pendant",
    name: "Meera Emerald-Tone Pendant",
    shortDescription: "An emerald-green CZ cabochon on an adjustable gold-plated chain.",
    description:
      "An 8x6mm emerald-tone cubic zirconia in a closed-back bezel that deepens the colour. The chain adjusts between 16 and 18 inches through a sliding bead — easy over high necks and open collars.",
    metal: "YELLOW_GOLD",
    purity: "18K gold plated",
    gemstone: "Emerald-tone CZ",
    weightGrams: 4.1,
    dimensions: "Pendant 12x9mm · Chain 16-18 inch adjustable",
    price: 1899,
    compareAt: 2499,
    images: ["/placeholders/pendant-a.svg", "/placeholders/pendant-b.svg"],
    collections: ["necklaces", "bridal-edit"],
    featured: true,
    newArrival: true,
    variants: [
      { label: "Gold-plated · 16-18 inch", length: "16-18 inch", metal: "YELLOW_GOLD", price: 1899, compareAt: 2499, stock: 14 },
      { label: "Gold-plated · 18-20 inch", length: "18-20 inch", metal: "YELLOW_GOLD", price: 1999, compareAt: 2599, stock: 10 },
    ],
  },
  {
    slug: "kiara-tennis-bracelet",
    name: "Kiara Tennis Bracelet",
    shortDescription: "A flexible line of CZ stones with a folding clasp and safety catch.",
    description:
      "Round brilliant CZ stones in linked settings so the bracelet drapes softly on the wrist. A folding clasp plus secondary safety catch keeps it secure through parties and travel.",
    metal: "WHITE_GOLD",
    purity: "Rhodium-finish plating",
    gemstone: "Cubic zirconia",
    weightGrams: 7.8,
    dimensions: "2.4mm width",
    price: 2999,
    compareAt: 3999,
    images: ["/placeholders/bracelet-a.svg", "/placeholders/bracelet-b.svg"],
    collections: ["bridal-edit", "bracelets"],
    featured: true,
    variants: [
      { label: "Silver-tone · 6.5 inch", size: "6.5 inch", metal: "WHITE_GOLD", price: 2999, compareAt: 3999, stock: 12 },
      { label: "Silver-tone · 7 inch", size: "7 inch", metal: "WHITE_GOLD", price: 3099, compareAt: 4099, stock: 14 },
      { label: "Gold-plated · 7 inch", size: "7 inch", metal: "YELLOW_GOLD", price: 3199, compareAt: 4199, stock: 9 },
    ],
  },
  {
    slug: "noor-crystal-studs",
    name: "Noor Crystal Studs",
    shortDescription: "Classic four-prong CZ studs with locking backs.",
    description:
      "The everyday pair most of our customers reach for first. Screw-on locking backs stay put, and the low martini setting sits close enough to the lobe for long wear.",
    metal: "YELLOW_GOLD",
    purity: "18K gold plated",
    gemstone: "Cubic zirconia",
    weightGrams: 1.4,
    dimensions: "4.1mm stone",
    price: 999,
    compareAt: 1499,
    images: ["/placeholders/studs-a.svg", "/placeholders/studs-b.svg"],
    collections: ["everyday-shine", "earrings", "bridal-edit"],
    bestseller: true,
    variants: [
      { label: "Gold-plated · Petite", metal: "YELLOW_GOLD", price: 999, compareAt: 1499, stock: 40 },
      { label: "Silver-tone · Petite", metal: "WHITE_GOLD", price: 999, compareAt: 1499, stock: 28 },
      { label: "Gold-plated · Bold", metal: "YELLOW_GOLD", price: 1299, compareAt: 1799, stock: 18 },
    ],
  },
  {
    slug: "veda-stacking-band",
    name: "Veda Stacking Band",
    shortDescription: "A 1.4mm textured band made to be worn three at a time.",
    description:
      "Light textured plating so each band catches light a little differently. Thin enough that three stack comfortably, and priced so a set is realistic.",
    metal: "YELLOW_GOLD",
    purity: "Gold-tone plated",
    weightGrams: 1.1,
    dimensions: "1.4mm width",
    price: 599,
    compareAt: 899,
    images: ["/placeholders/ring-a.svg", "/placeholders/ring-b.svg"],
    collections: ["everyday-shine", "rings"],
    newArrival: true,
    variants: [
      { label: "Gold-plated · Size 10", size: "10", metal: "YELLOW_GOLD", price: 599, compareAt: 899, stock: 30 },
      { label: "Gold-plated · Size 12", size: "12", metal: "YELLOW_GOLD", price: 599, compareAt: 899, stock: 36 },
      { label: "Gold-plated · Size 14", size: "14", metal: "YELLOW_GOLD", price: 599, compareAt: 899, stock: 34 },
      { label: "Rose gold-plated · Size 12", size: "12", metal: "ROSE_GOLD", price: 649, compareAt: 949, stock: 20 },
      { label: "Silver-plated · Size 12", size: "12", metal: "STERLING_SILVER", price: 499, compareAt: 799, stock: 40 },
    ],
  },
  {
    slug: "saanjh-rope-chain",
    name: "Saanjh Rope Chain",
    shortDescription: "A 2mm rope chain that holds its twist under a pendant.",
    description:
      "Tightly wound plated rope links that keep their spiral even with a pendant attached. A everyday layering staple with a secure lobster clasp.",
    metal: "YELLOW_GOLD",
    purity: "18K gold plated",
    weightGrams: 5.2,
    dimensions: "2mm width",
    price: 1599,
    compareAt: 2199,
    images: ["/placeholders/chain-a.svg", "/placeholders/chain-b.svg"],
    collections: ["necklaces", "everyday-shine"],
    variants: [
      { label: "Gold-plated · 18 inch", length: "18 inch", metal: "YELLOW_GOLD", price: 1599, compareAt: 2199, stock: 22 },
      { label: "Gold-plated · 20 inch", length: "20 inch", metal: "YELLOW_GOLD", price: 1699, compareAt: 2299, stock: 16 },
      { label: "Gold-plated · 22 inch", length: "22 inch", metal: "YELLOW_GOLD", price: 1799, compareAt: 2399, stock: 12 },
    ],
  },
  {
    slug: "ira-kundan-bangle",
    name: "Ira Kundan-Style Bangle",
    shortDescription: "Traditional kundan-style glass stones on a hollow plated bangle.",
    description:
      "Foil-backed glass stones in a kundan-style setting on a lightweight hollow form — ceremonial scale without precious-metal weight or price. Ideal for weddings and festive wear.",
    story:
      "Inspired by classic Rajasthani bridal aesthetics, finished as wearable fashion jewellery for modern celebrations.",
    metal: "YELLOW_GOLD",
    purity: "Antique gold plating",
    gemstone: "Kundan-style glass",
    weightGrams: 14.6,
    dimensions: "12mm width",
    price: 4499,
    compareAt: 5999,
    images: ["/placeholders/bangle-a.svg", "/placeholders/bangle-b.svg"],
    collections: ["bridal-edit", "bracelets"],
    featured: true,
    variants: [
      { label: "Antique gold · 2.4 inch", size: "2.4", metal: "YELLOW_GOLD", price: 4499, compareAt: 5999, stock: 8 },
      { label: "Antique gold · 2.6 inch", size: "2.6", metal: "YELLOW_GOLD", price: 4599, compareAt: 6099, stock: 10 },
      { label: "Antique gold · 2.8 inch", size: "2.8", metal: "YELLOW_GOLD", price: 4699, compareAt: 6199, stock: 6 },
    ],
  },
  {
    slug: "tara-drop-earrings",
    name: "Tara Drop Earrings",
    shortDescription: "Pear-cut blush CZ drops balanced to hang straight.",
    description:
      "Weighted below the hinge so they stay square to the face through a long evening. Soft blush cubic zirconia on rose-gold plating — a favourite for functions and photos.",
    metal: "ROSE_GOLD",
    purity: "Rose gold plated",
    gemstone: "Blush CZ",
    weightGrams: 3.6,
    dimensions: "34mm drop",
    price: 1799,
    compareAt: 2499,
    images: ["/placeholders/earrings-b.svg", "/placeholders/earrings-a.svg"],
    collections: ["earrings", "bridal-edit"],
    newArrival: true,
    variants: [
      { label: "Rose gold-plated · Blush CZ", metal: "ROSE_GOLD", price: 1799, compareAt: 2499, stock: 14 },
      { label: "Gold-plated · Champagne CZ", metal: "YELLOW_GOLD", price: 1699, compareAt: 2399, stock: 12 },
    ],
  },
  {
    slug: "anaya-layering-necklace",
    name: "Anaya Layering Necklace",
    shortDescription: "A 16-inch chain with a fixed bar so layers never tangle.",
    description:
      "A short spacer bar at the back holds this chain a fixed gap above the next layer, so two or three sit apart without a separator clasp. Soft gold-tone plating for everyday stacks.",
    metal: "GOLD_VERMEIL",
    purity: "High-polish gold tone",
    weightGrams: 2.8,
    dimensions: "1.2mm chain · 16 inch",
    price: 899,
    compareAt: 1299,
    images: ["/placeholders/necklace-a.svg", "/placeholders/necklace-b.svg"],
    collections: ["everyday-shine", "necklaces"],
    bestseller: true,
    variants: [
      { label: "Gold-tone · 16 inch", length: "16 inch", metal: "GOLD_VERMEIL", price: 899, compareAt: 1299, stock: 40 },
      { label: "Gold-tone · 18 inch", length: "18 inch", metal: "GOLD_VERMEIL", price: 949, compareAt: 1349, stock: 34 },
      { label: "Silver-plated · 16 inch", length: "16 inch", metal: "STERLING_SILVER", price: 799, compareAt: 1199, stock: 28 },
    ],
  },
  {
    slug: "leela-anklet",
    name: "Leela Anklet",
    shortDescription: "Silver-tone anklet with seven ghungroo-style bells.",
    description:
      "Delicate bells on an adjustable chain with a flat clasp that sits comfortably under socks and sneakers. Fashion plating — wipe dry after humid days.",
    metal: "STERLING_SILVER",
    purity: "Silver-plated",
    weightGrams: 6.4,
    dimensions: "9-10 inch adjustable",
    price: 799,
    compareAt: 1099,
    images: ["/placeholders/anklet-a.svg", "/placeholders/anklet-b.svg"],
    collections: ["everyday-shine"],
    variants: [
      { label: "Silver-plated · 9-10 inch", length: "9-10 inch", metal: "STERLING_SILVER", price: 799, compareAt: 1099, stock: 36 },
      { label: "Gold-tone · 9-10 inch", length: "9-10 inch", metal: "GOLD_VERMEIL", price: 899, compareAt: 1199, stock: 22 },
    ],
  },
  {
    slug: "mira-statement-brooch",
    name: "Mira Statement Brooch",
    shortDescription: "A convertible brooch that doubles as a pendant.",
    description:
      "The pin folds flat into a channel and a concealed loop swings out, so the same piece works on a lapel or on a chain. Sapphire-blue CZ centre on gold-tone plating.",
    metal: "YELLOW_GOLD",
    purity: "Gold-tone plated",
    gemstone: "Sapphire-blue CZ",
    weightGrams: 8.9,
    dimensions: "32mm diameter",
    price: 2199,
    compareAt: 2999,
    images: ["/placeholders/brooch-a.svg", "/placeholders/brooch-b.svg"],
    collections: ["bridal-edit"],
    variants: [
      { label: "Gold-tone · Blue CZ", metal: "YELLOW_GOLD", price: 2199, compareAt: 2999, stock: 8 },
    ],
  },
];

export const coupons = [
  {
    code: "WELCOME10",
    description: "10% off a first order, capped at ₹500.",
    type: "PERCENT" as const,
    value: 10,
    minSubtotal: 999,
    maxDiscount: 500,
    usageLimitPerUser: 1,
  },
  {
    code: "RIVANA300",
    description: "Flat ₹300 off orders above ₹1,999.",
    type: "FIXED" as const,
    value: 300,
    minSubtotal: 1999,
  },
  {
    code: "FREESHIP",
    description: "Free insured shipping on any order.",
    type: "FREE_SHIPPING" as const,
    value: 0,
    minSubtotal: 0,
  },
  {
    code: "BRIDAL15",
    description: "15% off the Bridal Edit collection, capped at ₹1,000.",
    type: "PERCENT" as const,
    value: 15,
    minSubtotal: 1999,
    maxDiscount: 1000,
    usageLimit: 200,
  },
];

export const heroSlides = [
  {
    eyebrow: "The Bridal Edit",
    title: "Statement shine for every celebration.",
    subtitle:
      "AD polki looks, kundan-style sets and party pieces — fashion jewellery made for shaadi season.",
    imageUrl: "/placeholders/hero-1.svg",
    ctaLabel: "Explore Bridal",
    ctaHref: "/collections/bridal-edit",
    alignment: "left",
    sortOrder: 1,
  },
  {
    eyebrow: "Everyday Shine",
    title: "Light enough to wear on repeat.",
    subtitle: "Layering chains, stackable bands and hoops under two grams.",
    imageUrl: "/placeholders/hero-2.svg",
    ctaLabel: "Shop Everyday",
    ctaHref: "/collections/everyday-shine",
    alignment: "center",
    sortOrder: 2,
  },
  {
    eyebrow: "New this season",
    title: "The Meera Emerald-Tone.",
    subtitle: "A vivid green CZ cabochon in a closed-back bezel, on an adjustable chain.",
    imageUrl: "/placeholders/hero-3.svg",
    ctaLabel: "See the piece",
    ctaHref: "/product/meera-emerald-pendant",
    alignment: "right",
    sortOrder: 3,
  },
];

export const reviews = [
  {
    productSlug: "rivana-solitaire-ring",
    authorName: "Ananya R.",
    rating: 5,
    title: "Looks expensive in photos",
    body:
      "Ordered for a friend's cocktail. The CZ catches light beautifully and nobody guessed the price. Sizing matched the chart.",
    status: "APPROVED" as const,
    verified: true,
  },
  {
    productSlug: "rivana-solitaire-ring",
    authorName: "Karthik M.",
    rating: 4,
    title: "Gift packaging was lovely",
    body:
      "Arrived a day later than the estimate, but the ring itself is sharp and the box felt premium. Perfect for a birthday.",
    status: "APPROVED" as const,
    verified: true,
  },
  {
    productSlug: "aurelia-hoop-earrings",
    authorName: "Sneha P.",
    rating: 5,
    title: "The only hoops I wear now",
    body: "Light, no pinch after eight hours. I bought the 32mm a week later.",
    status: "APPROVED" as const,
    verified: true,
  },
  {
    productSlug: "anaya-layering-necklace",
    authorName: "Divya S.",
    rating: 5,
    title: "The anti-tangle bar actually works",
    body:
      "Sceptical about this but it is the first time I have layered two chains without spending five minutes untwisting them.",
    status: "APPROVED" as const,
    verified: true,
  },
  {
    productSlug: "anaya-layering-necklace",
    authorName: "Riya K.",
    rating: 3,
    title: "Pretty — plating softens with daily wear",
    body:
      "Gorgeous for the price. After a few months of daily wear there is some fading at the clasp. Still worth it for the look.",
    status: "APPROVED" as const,
    verified: false,
  },
  {
    productSlug: "noor-crystal-studs",
    authorName: "Pooja T.",
    rating: 5,
    title: "Sleep in them, forget them",
    body: "The locking backs are the whole point. Months in and I have never lost one.",
    status: "APPROVED" as const,
    verified: true,
  },
  {
    productSlug: "veda-stacking-band",
    authorName: "Meghna L.",
    rating: 4,
    title: "Bought three",
    body: "The texture differs slightly between them, which I like. Silver-tone one needs a wipe more often, as expected.",
    status: "PENDING" as const,
    verified: false,
  },
];
