import { connectDB, disconnectDB } from '../config/db.js'
import Brand from '../modules/catalog/brand.model.js'
import Category from '../modules/catalog/category.model.js'
import Product from '../modules/catalog/product.model.js'
import Review from '../modules/reviews/review.model.js'
import Coupon from '../modules/coupon/coupon.model.js'
import User from '../modules/auth/user.model.js'
import { createBrand, createCategory, createProduct } from '../modules/catalog/catalog.service.js'
import { hashPassword } from '../services/security.service.js'
import { refreshProductRating } from '../modules/reviews/review.service.js'

const img = (seed) => `https://picsum.photos/seed/${seed}/800/800`

const BRANDS = [
  { name: 'SoundWave', description: 'Premium audio engineering for everyday life.' },
  { name: 'PulseFit', description: 'Wearables built around your health.' },
  { name: 'VoltCharge', description: 'Fast, safe charging for every device.' },
  { name: 'AeroHome', description: 'Smart home audio and entertainment.' },
  { name: 'NimbusGear', description: 'Minimal tech accessories with bold colors.' }
]

const CATEGORY_TREE = [
  {
    name: 'Audio',
    slug: 'audio',
    children: [
      { name: 'Headphones', slug: 'headphones' },
      { name: 'Earbuds', slug: 'earbuds' },
      { name: 'Speakers', slug: 'speakers' }
    ]
  },
  {
    name: 'Wearables',
    slug: 'wearables',
    children: [
      { name: 'Smartwatches', slug: 'smartwatches' },
      { name: 'Fitness Bands', slug: 'fitness-bands' }
    ]
  },
  {
    name: 'Charging',
    slug: 'charging',
    children: [
      { name: 'Wall Chargers', slug: 'wall-chargers' },
      { name: 'Cables', slug: 'cables' },
      { name: 'Power Banks', slug: 'power-banks' }
    ]
  },
  {
    name: 'Smart Home',
    slug: 'smart-home',
    children: [
      { name: 'Speakers', slug: 'smart-speakers' },
      { name: 'Lighting', slug: 'lighting' }
    ]
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    children: [{ name: 'Bags & Sleeves', slug: 'bags-sleeves' }]
  }
]

function variantOptions(name, values) {
  return values.map((value) => ({ [name]: value }))
}

function makeVariants(skuBase, optionName, values, priceMinor, compareAtMinor) {
  return values.map((value, index) => ({
    sku: `${skuBase}-${index + 1}`,
    options: { [optionName]: value },
    priceMinor: priceMinor + index * 200,
    compareAtMinor: compareAtMinor ? compareAtMinor + index * 200 : null,
    stock: [6, 12, 9, 4][index % 4] + index,
    active: true
  }))
}

const PRODUCTS = [
  {
    name: 'Aurora ANC Over-Ear Headphones',
    slug: 'aurora-anc-over-ear-headphones',
    sku: 'SW-HEAD-001',
    brand: 'SoundWave',
    category: 'headphones',
    priceMinor: 24900,
    compareAtMinor: 32900,
    shortDescription: 'Adaptive noise cancelling, 40h battery and plush memory-foam earcups.',
    featured: true,
    stock: 24,
    tags: ['noise cancelling', 'wireless', 'bluetooth'],
    attributes: [
      { name: 'Battery Life', value: '40 hours' },
      { name: 'Bluetooth', value: '5.3' },
      { name: 'Weight', value: '254 g' }
    ],
    variants: makeVariants('AURORA', 'Color', ['Midnight', 'Silver', 'Sage'], 24900, 32900)
  },
  {
    name: 'Echo Buds Pro',
    slug: 'echo-buds-pro',
    sku: 'SW-EAR-002',
    brand: 'SoundWave',
    category: 'earbuds',
    priceMinor: 14900,
    compareAtMinor: null,
    shortDescription: 'Studio-grade sound with adaptive EQ and wireless charging case.',
    featured: true,
    stock: 42,
    tags: ['earbuds', 'tws', 'wireless charging'],
    attributes: [
      { name: 'Battery Life', value: '8h + 24h case' },
      { name: 'Water Resistance', value: 'IPX5' }
    ],
    variants: makeVariants('ECHOPRO', 'Color', ['White', 'Black'], 14900, null)
  },
  {
    name: 'Wave XL Bluetooth Speaker',
    slug: 'wave-xl-bluetooth-speaker',
    sku: 'SW-SPK-003',
    brand: 'SoundWave',
    category: 'speakers',
    priceMinor: 19900,
    compareAtMinor: 24900,
    shortDescription: '360° sound, deep bass radiators and 24-hour playtime.',
    featured: false,
    stock: 15,
    tags: ['speaker', 'portable', 'outdoor'],
    attributes: [
      { name: 'Battery Life', value: '24 hours' },
      { name: 'Water Resistance', value: 'IPX7' }
    ],
    variants: []
  },
  {
    name: 'Pulse S2 Smartwatch',
    slug: 'pulse-s2-smartwatch',
    sku: 'PF-WAT-004',
    brand: 'PulseFit',
    category: 'smartwatches',
    priceMinor: 17900,
    compareAtMinor: 21900,
    shortDescription: 'AMOLED display, GPS, SpO2 and 10-day battery in a slim case.',
    featured: true,
    stock: 30,
    tags: ['smartwatch', 'gps', 'fitness'],
    attributes: [
      { name: 'Display', value: '1.43" AMOLED' },
      { name: 'Battery', value: '10 days' }
    ],
    variants: makeVariants('PULSES2', 'Size', ['42mm', '46mm'], 17900, 21900)
  },
  {
    name: 'Pulse Band Mini',
    slug: 'pulse-band-mini',
    sku: 'PF-FIT-005',
    brand: 'PulseFit',
    category: 'fitness-bands',
    priceMinor: 5900,
    compareAtMinor: null,
    shortDescription: 'Sleep, heart-rate and step tracking in a featherlight band.',
    featured: false,
    stock: 80,
    tags: ['fitness band', 'tracker'],
    attributes: [{ name: 'Water Resistance', value: '5 ATM' }],
    variants: makeVariants('PULSEMINI', 'Color', ['Black', 'Lavender', 'Mint'], 5900, null)
  },
  {
    name: 'GaN 65W Wall Charger',
    slug: 'gan-65w-wall-charger',
    sku: 'VC-CHG-006',
    brand: 'VoltCharge',
    category: 'wall-chargers',
    priceMinor: 3900,
    compareAtMinor: 5900,
    shortDescription: 'Pocket-size 65W GaN charger with 2x USB-C and 1x USB-A.',
    featured: true,
    stock: 120,
    tags: ['gan', 'usb-c', 'fast charge'],
    attributes: [
      { name: 'Power', value: '65W' },
      { name: 'Ports', value: '2C + 1A' }
    ],
    variants: []
  },
  {
    name: 'Braid 100W USB-C Cable 2m',
    slug: 'braid-100w-usb-c-cable',
    sku: 'VC-CAB-007',
    brand: 'VoltCharge',
    category: 'cables',
    priceMinor: 1900,
    compareAtMinor: null,
    shortDescription: 'Durable braided 100W USB-C to USB-C cable in two metres.',
    featured: false,
    stock: 200,
    tags: ['cable', 'usb-c', 'braided'],
    attributes: [{ name: 'Length', value: '2 m' }],
    variants: variantOptions('Color', ['Black', 'Blue', 'Orange']).map((options, index) => ({
      sku: `BRAID2M-${index + 1}`,
      options,
      priceMinor: 1900,
      compareAtMinor: null,
      stock: 30 + index * 10,
      active: true
    }))
  },
  {
    name: 'PowerCore 20K Power Bank',
    slug: 'powercore-20k-power-bank',
    sku: 'VC-PB-008',
    brand: 'VoltCharge',
    category: 'power-banks',
    priceMinor: 4900,
    compareAtMinor: 6500,
    shortDescription: '20000mAh fast-charging power bank with digital display.',
    featured: false,
    stock: 55,
    tags: ['power bank', '20000mah'],
    attributes: [{ name: 'Capacity', value: '20000 mAh' }],
    variants: []
  },
  {
    name: 'Aero Mini Smart Speaker',
    slug: 'aero-mini-smart-speaker',
    sku: 'AH-SPK-009',
    brand: 'AeroHome',
    category: 'smart-speakers',
    priceMinor: 9900,
    compareAtMinor: 12900,
    shortDescription: 'Room-filling sound with voice control and multi-room sync.',
    featured: true,
    stock: 34,
    tags: ['smart speaker', 'voice assistant'],
    attributes: [{ name: 'Voice', value: 'Built-in assistant' }],
    variants: variantOptions('Color', ['Graphite', 'Stone']).map((options, index) => ({
      sku: `AEROMINI-${index + 1}`,
      options,
      priceMinor: 9900,
      compareAtMinor: 12900,
      stock: 12 + index * 4,
      active: true
    }))
  },
  {
    name: 'Aero Hue Smart Bulb',
    slug: 'aero-hue-smart-bulb',
    sku: 'AH-LIT-010',
    brand: 'AeroHome',
    category: 'lighting',
    priceMinor: 2400,
    compareAtMinor: null,
    shortDescription: '16M colors, schedules and scenes without a hub.',
    featured: false,
    stock: 90,
    tags: ['smart bulb', 'zigbee-free'],
    attributes: [{ name: 'Color', value: '16M colors' }],
    variants: []
  },
  {
    name: 'Nimbus Minimal Backpack',
    slug: 'nimbus-minimal-backpack',
    sku: 'NG-BAG-011',
    brand: 'NimbusGear',
    category: 'bags-sleeves',
    priceMinor: 8900,
    compareAtMinor: 11900,
    shortDescription: 'Water-resistant 20L backpack with a padded 16" laptop sleeve.',
    featured: true,
    stock: 40,
    tags: ['backpack', 'laptop'],
    attributes: [{ name: 'Capacity', value: '20 L' }],
    variants: variantOptions('Color', ['Sand', 'Charcoal', 'Olive']).map((options, index) => ({
      sku: `NIMBUS20-${index + 1}`,
      options,
      priceMinor: 8900,
      compareAtMinor: 11900,
      stock: 8 + index * 3,
      active: true
    }))
  },
  {
    name: 'Studio One Monitor Headphones',
    slug: 'studio-one-monitor-headphones',
    sku: 'SW-HEAD-012',
    brand: 'SoundWave',
    category: 'headphones',
    priceMinor: 18900,
    compareAtMinor: null,
    shortDescription: 'Reference-tuned monitors for creators, wired and lossless.',
    featured: false,
    stock: 12,
    tags: ['studio', 'wired', 'monitor'],
    attributes: [{ name: 'Impedance', value: '32 Ω' }],
    variants: []
  },
  {
    name: 'Racer True Wireless Earbuds',
    slug: 'racer-true-wireless-earbuds',
    sku: 'SW-EAR-013',
    brand: 'SoundWave',
    category: 'earbuds',
    priceMinor: 9900,
    compareAtMinor: 13900,
    shortDescription: 'Low-latency gaming earbuds with punchy bass and mic.',
    featured: false,
    stock: 0,
    tags: ['gaming', 'low latency'],
    attributes: [{ name: 'Latency', value: '60 ms' }],
    variants: makeVariants('RACER', 'Color', ['Black', 'Red'], 9900, 13900)
  },
  {
    name: 'Home Hub Display 8"',
    slug: 'home-hub-display-8',
    sku: 'AH-HUB-014',
    brand: 'AeroHome',
    category: 'lighting',
    priceMinor: 14900,
    compareAtMinor: null,
    shortDescription: 'Touchscreen hub for smart home controls and video calls.',
    featured: false,
    stock: 22,
    tags: ['smart home', 'hub'],
    attributes: [{ name: 'Display', value: '8"' }],
    variants: []
  },
  {
    name: 'Titan Charge Stand',
    slug: 'titan-charge-stand',
    sku: 'VC-STD-015',
    brand: 'VoltCharge',
    category: 'wall-chargers',
    priceMinor: 4500,
    compareAtMinor: 6000,
    shortDescription: '3-in-1 magnetic charging stand for phone, watch and earbuds.',
    featured: false,
    stock: 48,
    tags: ['magnetic', '3-in-1'],
    attributes: [{ name: 'Output', value: '15W max' }],
    variants: variantOptions('Color', ['Silver', 'Black']).map((options, index) => ({
      sku: `TITAN3IN1-${index + 1}`,
      options,
      priceMinor: 4500,
      compareAtMinor: 6000,
      stock: 15 + index * 5,
      active: true
    }))
  }
]

async function run() {
  await connectDB()

  const brandIdByName = {}
  for (const brand of BRANDS) {
    const existing = await Brand.findOne({
      slug: brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    })
    if (existing) {
      brandIdByName[brand.name] = existing._id
      continue
    }
    const created = await createBrand(brand)
    brandIdByName[brand.name] = created.id
  }

  const categoryIdBySlug = {}
  for (const root of CATEGORY_TREE) {
    const existingRoot = await Category.findOne({ slug: root.slug })
    const rootCategory = existingRoot
      ? existingRoot
      : await createCategory({
          name: root.name,
          slug: root.slug,
          description: `${root.name} collection`,
          imageUrl: img(root.slug),
          status: 'active'
        })
    categoryIdBySlug[root.slug] = rootCategory._id ?? rootCategory.id
    for (const child of root.children) {
      const existingChild = await Category.findOne({ slug: child.slug })
      const childCategory = existingChild
        ? existingChild
        : await createCategory({
            name: child.name,
            slug: child.slug,
            parentId: categoryIdBySlug[root.slug],
            description: `${child.name} collection`,
            imageUrl: img(child.slug),
            status: 'active'
          })
      categoryIdBySlug[child.slug] = childCategory._id ?? childCategory.id
    }
  }

  let demoUser = await User.findOne({ email: 'demo@example.com' })
  if (!demoUser) {
    demoUser = await User.create({
      name: 'Demo Customer',
      email: 'demo@example.com',
      passwordHash: await hashPassword('Demo12345!'),
      role: 'customer',
      status: 'active',
      emailVerifiedAt: new Date()
    })
  }

  const productIds = []
  for (let index = 0; index < PRODUCTS.length; index += 1) {
    const p = PRODUCTS[index]
    const existing = await Product.findOne({ slug: p.slug })
    const categoryId = categoryIdBySlug[p.category]
    if (existing) {
      productIds.push(existing._id)
      continue
    }
    const created = await createProduct({
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      shortDescription: p.shortDescription,
      description:
        `${p.shortDescription}\n\nCarefully engineered, rigorously tested and backed by a 1-year warranty. ` +
        `Ships free on orders over $35.`,
      brandId: brandIdByName[p.brand],
      categoryId,
      priceMinor: p.priceMinor,
      compareAtMinor: p.compareAtMinor,
      stock: p.stock,
      lowStockThreshold: 5,
      images: [p.slug, `${p.slug}-2`, `${p.slug}-3`].map((seedName) => ({
        url: img(seedName),
        alt: `${p.name} photo`
      })),
      attributes: p.attributes,
      variants: p.variants ?? [],
      tags: p.tags,
      status: 'published',
      featured: p.featured,
      publishedAt: new Date(Date.now() - index * 86_400_000 * 2),
      seo: {
        title: `${p.name} | Voltify`,
        description: p.shortDescription,
        keywords: p.tags
      }
    })
    productIds.push(created.id)
  }

  const reviewSeeds = [
    {
      slug: 'aurora-anc-over-ear-headphones',
      rating: 5,
      title: 'Worth every penny',
      body: 'The noise cancelling is incredible and they are comfortable for all-day wear.'
    },
    {
      slug: 'aurora-anc-over-ear-headphones',
      rating: 4,
      title: 'Great sound',
      body: 'Superb audio quality. Case is a bit bulky but fine.'
    },
    {
      slug: 'echo-buds-pro',
      rating: 5,
      title: 'Best buds I have owned',
      body: 'Crisp highs, solid bass and the case charges wirelessly. Love them.'
    },
    {
      slug: 'wave-xl-bluetooth-speaker',
      rating: 4,
      title: 'Loud and clear',
      body: 'Battery easily lasts a day of heavy use.'
    },
    {
      slug: 'pulse-s2-smartwatch',
      rating: 5,
      title: 'Accurate and stylish',
      body: 'GPS is spot on and battery really does last ten days.'
    },
    {
      slug: 'gan-65w-wall-charger',
      rating: 5,
      title: 'Tiny but mighty',
      body: 'Charges my laptop and phone at full speed. Fits in a pocket.'
    },
    {
      slug: 'aero-mini-smart-speaker',
      rating: 4,
      title: 'Great for the price',
      body: 'Sounds far bigger than it looks.'
    },
    {
      slug: 'nimbus-minimal-backpack',
      rating: 5,
      title: 'Perfect daily bag',
      body: 'Minimal look, tons of pockets, comfortable straps.'
    }
  ]

  const productIdBySlug = new Map(
    (
      await Product.find({ slug: { $in: reviewSeeds.map((r) => r.slug) } })
        .select('slug')
        .lean()
    ).map((p) => [p.slug, p._id])
  )

  for (const seed of reviewSeeds) {
    const productId = productIdBySlug.get(seed.slug)
    if (!productId) continue
    const exists = await Review.findOne({ product: productId, user: demoUser._id, body: seed.body })
    if (!exists) {
      await Review.create({
        product: productId,
        user: demoUser._id,
        rating: seed.rating,
        title: seed.title,
        body: seed.body,
        status: 'approved',
        verifiedPurchase: true
      })
    }
  }

  for (const productId of productIdBySlug.values()) {
    await refreshProductRating(productId)
  }

  await Coupon.updateOne(
    { code: 'WELCOME10' },
    {
      $setOnInsert: {
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        minSubtotalMinor: 2000,
        maxDiscountMinor: 1500,
        startsAt: null,
        expiresAt: null,
        usageLimit: null,
        perUserLimit: 1,
        enabled: true
      }
    },
    { upsert: true }
  )
  await Coupon.updateOne(
    { code: 'FREESHIP' },
    {
      $setOnInsert: {
        code: 'FREESHIP',
        type: 'fixed',
        value: 499,
        minSubtotalMinor: 2000,
        enabled: true
      }
    },
    { upsert: true }
  )

  console.log('Seed complete')
  console.log(`- Brands: ${BRANDS.length}`)
  console.log(`- Categories: ${Object.keys(categoryIdBySlug).length}`)
  console.log(`- Products: ${productIds.length}`)
  console.log(`- Reviews: ${reviewSeeds.length}`)
  console.log('Login: demo@example.com / Demo12345!')
  await disconnectDB()
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
