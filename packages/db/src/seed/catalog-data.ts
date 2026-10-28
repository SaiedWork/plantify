export type SeedCategory = { slug: string; name: string; description: string };

export const CATEGORIES: SeedCategory[] = [
  { slug: 'indoor-plants', name: 'Indoor Plants', description: 'Easy-going greenery for every room.' },
  { slug: 'succulents-cacti', name: 'Succulents & Cacti', description: 'Sun lovers that forgive a missed watering.' },
  { slug: 'herbs', name: 'Herbs', description: 'Fresh flavour for the kitchen windowsill.' },
  { slug: 'flowering', name: 'Flowering Plants', description: 'Colour all year round.' },
  { slug: 'pots-planters', name: 'Pots & Planters', description: 'Homes for your plants.' },
  { slug: 'care-supplies', name: 'Care & Supplies', description: 'Soil, feed and tools.' },
];

export type SeedProduct = {
  name: string;
  category: string;
  baseCents: number;
  /** "plant" gets Small/Medium/Large pots, "single" gets one Standard variant. */
  kind: 'plant' | 'single';
  blurb: string;
  featured?: boolean;
};

export const PRODUCTS: SeedProduct[] = [
  // Indoor plants
  { name: 'Monstera Deliciosa', category: 'indoor-plants', baseCents: 2400, kind: 'plant', blurb: 'Iconic split leaves that make any corner feel tropical.', featured: true },
  { name: 'Snake Plant Laurentii', category: 'indoor-plants', baseCents: 1800, kind: 'plant', blurb: 'Nearly indestructible and great at tolerating low light.', featured: true },
  { name: 'Fiddle Leaf Fig', category: 'indoor-plants', baseCents: 3800, kind: 'plant', blurb: 'A statement tree with big, glossy violin-shaped leaves.' },
  { name: 'Pothos Golden', category: 'indoor-plants', baseCents: 1400, kind: 'plant', blurb: 'Trailing vines that thrive on neglect.', featured: true },
  { name: 'ZZ Plant', category: 'indoor-plants', baseCents: 2200, kind: 'plant', blurb: 'Shiny, drought-tolerant leaves for dim offices.' },
  { name: 'Peace Lily', category: 'indoor-plants', baseCents: 2000, kind: 'plant', blurb: 'Elegant white blooms and an air-freshening reputation.' },
  { name: 'Rubber Plant Burgundy', category: 'indoor-plants', baseCents: 2600, kind: 'plant', blurb: 'Deep burgundy leaves with a polished finish.' },
  { name: 'Calathea Orbifolia', category: 'indoor-plants', baseCents: 2800, kind: 'plant', blurb: 'Striped, rounded leaves that fold up at night.' },
  { name: 'Chinese Money Plant', category: 'indoor-plants', baseCents: 1600, kind: 'plant', blurb: 'Coin-shaped leaves and plenty of pups to share.' },
  { name: 'Boston Fern', category: 'indoor-plants', baseCents: 1900, kind: 'plant', blurb: 'Lush, feathery fronds for humid bathrooms.' },
  { name: 'Bird of Paradise', category: 'indoor-plants', baseCents: 4200, kind: 'plant', blurb: 'Dramatic banana-like leaves for bright rooms.' },
  { name: 'Spider Plant Variegata', category: 'indoor-plants', baseCents: 1200, kind: 'plant', blurb: 'Arching striped leaves, safe for pets.' },
  // Succulents and cacti
  { name: 'Aloe Vera', category: 'succulents-cacti', baseCents: 1300, kind: 'plant', blurb: 'Soothing gel on tap and almost no upkeep.', featured: true },
  { name: 'Echeveria Elegans', category: 'succulents-cacti', baseCents: 900, kind: 'plant', blurb: 'A pale blue-green rosette shaped like a rose.' },
  { name: 'Jade Plant', category: 'succulents-cacti', baseCents: 1500, kind: 'plant', blurb: 'The classic good-luck succulent with thick stems.' },
  { name: 'Golden Barrel Cactus', category: 'succulents-cacti', baseCents: 2100, kind: 'plant', blurb: 'A round, spiky sphere that loves full sun.' },
  { name: 'String of Pearls', category: 'succulents-cacti', baseCents: 1700, kind: 'plant', blurb: 'Cascading bead-like leaves for hanging pots.' },
  { name: 'Haworthia Zebra', category: 'succulents-cacti', baseCents: 1000, kind: 'plant', blurb: 'Tiny striped rosettes that tolerate shade.' },
  { name: 'Christmas Cactus', category: 'succulents-cacti', baseCents: 1800, kind: 'plant', blurb: 'Blooms bright pink right in the holiday season.' },
  { name: 'Burro’s Tail', category: 'succulents-cacti', baseCents: 1600, kind: 'plant', blurb: 'Plump trailing stems perfect for high shelves.' },
  // Herbs
  { name: 'Sweet Basil', category: 'herbs', baseCents: 600, kind: 'plant', blurb: 'Fragrant leaves for pasta, pizza and pesto.' },
  { name: 'Rosemary', category: 'herbs', baseCents: 800, kind: 'plant', blurb: 'Woody, aromatic and ideal for roasting.' },
  { name: 'Mint Spearmint', category: 'herbs', baseCents: 600, kind: 'plant', blurb: 'Cool and fast-growing; keep it in its own pot.' },
  { name: 'Thyme', category: 'herbs', baseCents: 700, kind: 'plant', blurb: 'Tiny leaves with big flavour.' },
  { name: 'Flat-Leaf Parsley', category: 'herbs', baseCents: 600, kind: 'plant', blurb: 'A kitchen staple you will snip daily.' },
  { name: 'Lavender English', category: 'herbs', baseCents: 1100, kind: 'plant', blurb: 'Calming scent that bees adore.' },
  // Flowering
  { name: 'Phalaenopsis Orchid', category: 'flowering', baseCents: 3200, kind: 'plant', blurb: 'Long-lasting blooms on graceful arching stems.', featured: true },
  { name: 'African Violet', category: 'flowering', baseCents: 1100, kind: 'plant', blurb: 'Velvety leaves and compact purple flowers.' },
  { name: 'Anthurium Red', category: 'flowering', baseCents: 2700, kind: 'plant', blurb: 'Glossy red heart-shaped blooms.' },
  { name: 'Kalanchoe Mix', category: 'flowering', baseCents: 1000, kind: 'plant', blurb: 'Clusters of cheerful flowers in mixed colours.' },
  { name: 'Begonia Rex', category: 'flowering', baseCents: 1900, kind: 'plant', blurb: 'Painted leaves in silver, pink and green.' },
  // Pots and planters
  { name: 'Terracotta Pot', category: 'pots-planters', baseCents: 900, kind: 'plant', blurb: 'Classic breathable clay with a drainage hole.' },
  { name: 'Ceramic Planter White', category: 'pots-planters', baseCents: 1800, kind: 'plant', blurb: 'Minimal matte glaze with matching saucer.' },
  { name: 'Hanging Macramé Planter', category: 'pots-planters', baseCents: 1500, kind: 'single', blurb: 'Hand-knotted cotton cord that fits 6" pots.' },
  { name: 'Self-Watering Planter', category: 'pots-planters', baseCents: 2400, kind: 'single', blurb: 'A built-in reservoir keeps roots happy for weeks.' },
  { name: 'Wooden Plant Stand', category: 'pots-planters', baseCents: 3400, kind: 'single', blurb: 'Mid-century style legs in solid oak.' },
  // Care and supplies
  { name: 'Premium Potting Mix 5L', category: 'care-supplies', baseCents: 1200, kind: 'single', blurb: 'Light, airy blend with perlite for healthy roots.' },
  { name: 'Cactus & Succulent Soil 5L', category: 'care-supplies', baseCents: 1100, kind: 'single', blurb: 'Fast-draining mix that prevents rot.' },
  { name: 'Liquid Plant Food 500ml', category: 'care-supplies', baseCents: 1000, kind: 'single', blurb: 'Balanced feed for all houseplants.' },
  { name: 'Copper Watering Can', category: 'care-supplies', baseCents: 2800, kind: 'single', blurb: 'Long spout for precise watering.' },
  { name: 'Pruning Shears', category: 'care-supplies', baseCents: 1600, kind: 'single', blurb: 'Sharp stainless blades and a comfy grip.', featured: false },
  { name: 'Plant Mister Glass', category: 'care-supplies', baseCents: 1400, kind: 'single', blurb: 'Fine mist for ferns and calatheas.' },
];

export const PLANT_VARIANTS = [
  { label: 'Small (4" pot)', multiplier: 1, suffix: 'S' },
  { label: 'Medium (6" pot)', multiplier: 1.7, suffix: 'M' },
  { label: 'Large (8" pot)', multiplier: 2.6, suffix: 'L' },
] as const;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
