import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  generateAccessToken,
  generateOrderNumber,
  generateSku,
} from "../src/lib/ids.js";
import { priceCart, type PricingSettings } from "../src/lib/pricing.js";
import {
  CARE_TEXT,
  collections,
  coupons,
  heroSlides,
  products,
  reviews,
} from "./seed-data.js";

const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("Set DIRECT_URL or DATABASE_URL before seeding.");
}
const isLocal = /localhost|127\.0\.0\.1/.test(rawUrl);
const connectionString = (() => {
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return rawUrl;
  }
})();
const pool = new Pool({
  connectionString,
  max: 5,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const rupees = (value: number) => Math.round(value * 100);

type Details = {
  brand: { name: string; tagline: string };
  contact: {
    email: string;
    phone: string;
    address: Record<string, string>;
    social: Record<string, string>;
  };
  commerce: {
    upiPayeeName: string;
    upiVpa: string;
    freeShippingThresholdRupees: number;
    flatShippingRateRupees: number;
    gstPercent: number;
    paymentHoldMinutes: number;
  };
};

async function readDetails(): Promise<Details> {
  const raw = await readFile(new URL("../project-details.json", import.meta.url), "utf8");
  return JSON.parse(raw) as Details;
}

async function seedSettings(details: Details) {
  const { brand, contact, commerce } = details;
  const data = {
    brandName: brand.name,
    tagline: brand.tagline,
    supportEmail: contact.email,
    supportPhone: contact.phone,
    whatsappNumber: contact.social.whatsapp ?? "",
    instagramUrl: contact.social.instagram ?? "",
    facebookUrl: contact.social.facebook ?? "",
    pinterestUrl: contact.social.pinterest ?? "",
    addressText: [
      contact.address.street,
      contact.address.city,
      `${contact.address.state} ${contact.address.postalCode}`,
      contact.address.country,
    ]
      .filter(Boolean)
      .join(", "),
    announcementText: "Complimentary insured shipping on orders above ₹2,500",
    announcementEnabled: true,
    upiVpa: commerce.upiVpa,
    upiPayeeName: commerce.upiPayeeName,
    freeShippingThresholdPaise: rupees(commerce.freeShippingThresholdRupees),
    flatShippingRatePaise: rupees(commerce.flatShippingRateRupees),
    gstBasisPoints: Math.round(commerce.gstPercent * 100),
    gstInclusive: true,
    paymentHoldMinutes: commerce.paymentHoldMinutes,
  };

  const settings = await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  console.log("  settings ready");
  return settings;
}

/**
 * Better Auth stores credentials in the `account` table with providerId
 * "credential" and its own scrypt envelope, so we hash with its helper rather
 * than rolling our own — otherwise sign-in would reject the seeded password.
 */
async function upsertUser(input: {
  email: string;
  name: string;
  password?: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  phone?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  const id = existing?.id ?? randomUUID();

  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      phone: input.phone,
      emailVerified: true,
    },
    update: { name: input.name, role: input.role, phone: input.phone, emailVerified: true },
  });

  if (input.password) {
    const hash = await hashPassword(input.password);
    const account = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hash },
      });
    } else {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hash,
        },
      });
    }
  }

  return user;
}

async function seedUsers() {
  const admin = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@houseofrivana.com",
    name: process.env.SEED_ADMIN_NAME ?? "Rivana Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026",
    role: "ADMIN",
    phone: "+919000000001",
  });

  const staff = await upsertUser({
    email: "orders@houseofrivana.com",
    name: "Orders Desk",
    password: "StaffDesk!2026",
    role: "STAFF",
    phone: "+919000000002",
  });

  const customer = await upsertUser({
    email: "ananya@example.com",
    name: "Ananya Rao",
    password: "Customer!2026",
    role: "CUSTOMER",
    phone: "+919812345678",
  });

  const existingAddress = await prisma.address.findFirst({
    where: { userId: customer.id },
  });
  if (!existingAddress) {
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: "Home",
        fullName: "Ananya Rao",
        phone: "+919812345678",
        line1: "402, Sunbeam Residency",
        line2: "18th Main, Koramangala 5th Block",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560095",
        isDefault: true,
      },
    });
  }

  console.log(`  users ready (admin: ${admin.email})`);
  return { admin, staff, customer };
}

/** Retired fine-jewellery demo rows from earlier seeds. */
const OBSOLETE_COLLECTION_SLUGS = ["bridal-heirloom", "everyday-fine"];
const OBSOLETE_PRODUCT_SLUGS = ["noor-diamond-studs", "mira-heritage-brooch"];
const OBSOLETE_COUPON_CODES = ["RIVANA500"];

async function retireObsoleteDemoCatalog() {
  if (OBSOLETE_COLLECTION_SLUGS.length) {
    await prisma.collection.updateMany({
      where: { slug: { in: OBSOLETE_COLLECTION_SLUGS } },
      data: { isActive: false, isFeatured: false },
    });
  }
  if (OBSOLETE_PRODUCT_SLUGS.length) {
    await prisma.product.updateMany({
      where: { slug: { in: OBSOLETE_PRODUCT_SLUGS } },
      data: { status: "ARCHIVED", isFeatured: false, isBestseller: false, isNewArrival: false },
    });
  }
  if (OBSOLETE_COUPON_CODES.length) {
    await prisma.coupon.updateMany({
      where: { code: { in: OBSOLETE_COUPON_CODES } },
      data: { isActive: false },
    });
  }
}

async function seedCollections() {
  const map = new Map<string, string>();
  for (const c of collections) {
    const record = await prisma.collection.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        subtitle: c.subtitle,
        description: c.description,
        heroImage: c.heroImage,
        isFeatured: c.isFeatured,
        sortOrder: c.sortOrder,
        isActive: true,
        metaTitle: `${c.name} | House of Rivana`,
        metaDescription: c.description.slice(0, 155),
      },
      update: {
        name: c.name,
        subtitle: c.subtitle,
        description: c.description,
        heroImage: c.heroImage,
        isFeatured: c.isFeatured,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
    map.set(c.slug, record.id);
  }
  console.log(`  ${map.size} collections ready`);
  return map;
}

async function seedProducts(collectionIds: Map<string, string>, actorId: string) {
  const variantIndex = new Map<string, { id: string; productSlug: string }>();

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        story: p.story,
        metal: p.metal,
        purity: p.purity,
        gemstone: p.gemstone,
        weightGrams: p.weightGrams,
        dimensions: p.dimensions,
        careInstructions: CARE_TEXT,
        basePricePaise: rupees(p.price),
        compareAtPaise: p.compareAt ? rupees(p.compareAt) : null,
        status: "ACTIVE",
        isFeatured: p.featured ?? false,
        isBestseller: p.bestseller ?? false,
        isNewArrival: p.newArrival ?? false,
        madeToOrderDays: p.madeToOrderDays,
        metaTitle: `${p.name} | House of Rivana`,
        metaDescription: p.shortDescription.slice(0, 155),
        publishedAt: new Date(),
      },
      update: {
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        story: p.story,
        metal: p.metal,
        purity: p.purity,
        gemstone: p.gemstone ?? null,
        weightGrams: p.weightGrams,
        dimensions: p.dimensions,
        careInstructions: CARE_TEXT,
        basePricePaise: rupees(p.price),
        compareAtPaise: p.compareAt ? rupees(p.compareAt) : null,
        isFeatured: p.featured ?? false,
        isBestseller: p.bestseller ?? false,
        isNewArrival: p.newArrival ?? false,
        madeToOrderDays: p.madeToOrderDays ?? null,
        metaTitle: `${p.name} | House of Rivana`,
        metaDescription: p.shortDescription.slice(0, 155),
        status: "ACTIVE",
      },
    });

    if (!existing) {
      await prisma.productImage.createMany({
        data: p.images.map((url, i) => ({
          productId: product.id,
          url,
          alt: `${p.name} — view ${i + 1}`,
          width: 1000,
          height: 1000,
          sortOrder: i,
          isPrimary: i === 0,
        })),
      });
    }

    await prisma.productCollection.deleteMany({ where: { productId: product.id } });
    await prisma.productCollection.createMany({
      data: p.collections
        .map((slug, i) => ({
          productId: product.id,
          collectionId: collectionIds.get(slug)!,
          sortOrder: i,
        }))
        .filter((row) => Boolean(row.collectionId)),
    });

    for (const [i, v] of p.variants.entries()) {
      const sku = generateSku(p.slug.split("-")[0], v.size ?? v.length ?? String(i + 1));
      const existingVariant = await prisma.productVariant.findFirst({
        where: { productId: product.id, label: v.label },
      });

      const variant = existingVariant
        ? await prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: {
              pricePaise: rupees(v.price),
              compareAtPaise: v.compareAt ? rupees(v.compareAt) : null,
              isActive: true,
              sortOrder: i,
            },
          })
        : await prisma.productVariant.create({
            data: {
              productId: product.id,
              sku,
              label: v.label,
              optionSize: v.size,
              optionMetal: v.metal,
              optionLength: v.length,
              pricePaise: rupees(v.price),
              compareAtPaise: v.compareAt ? rupees(v.compareAt) : null,
              weightGrams: p.weightGrams,
              stockQty: v.stock,
              sortOrder: i,
            },
          });

      // Opening stock goes through the ledger so balances always reconcile.
      if (!existingVariant) {
        await prisma.inventoryMovement.create({
          data: {
            variantId: variant.id,
            delta: v.stock,
            reason: "RESTOCK",
            balanceAfter: v.stock,
            note: "Opening stock (seed)",
            actorId,
          },
        });
      }

      variantIndex.set(variant.id, { id: variant.id, productSlug: p.slug });
    }
  }

  console.log(`  ${products.length} products ready`);
  return variantIndex;
}

async function seedCoupons() {
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.type === "FIXED" ? rupees(c.value) : c.value,
        minSubtotalPaise: rupees(c.minSubtotal),
        maxDiscountPaise: c.maxDiscount ? rupees(c.maxDiscount) : null,
        usageLimit: c.usageLimit ?? null,
        usageLimitPerUser: c.usageLimitPerUser ?? null,
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      },
      update: {
        description: c.description,
        type: c.type,
        value: c.type === "FIXED" ? rupees(c.value) : c.value,
        minSubtotalPaise: rupees(c.minSubtotal),
        maxDiscountPaise: c.maxDiscount ? rupees(c.maxDiscount) : null,
        usageLimit: c.usageLimit ?? null,
        usageLimitPerUser: c.usageLimitPerUser ?? null,
        isActive: true,
      },
    });
  }
  console.log(`  ${coupons.length} coupons ready`);
}

async function seedHeroSlides() {
  // Replace demo slides so brand copy updates on reseed.
  await prisma.heroSlide.deleteMany();
  await prisma.heroSlide.createMany({ data: heroSlides });
  console.log(`  ${heroSlides.length} hero slides ready`);
}

async function seedReviews() {
  for (const r of reviews) {
    const product = await prisma.product.findUnique({
      where: { slug: r.productSlug },
    });
    if (!product) continue;

    const existing = await prisma.review.findFirst({
      where: { productId: product.id, authorName: r.authorName },
    });

    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: r.rating,
          title: r.title,
          body: r.body,
          status: r.status,
          isVerifiedPurchase: r.verified,
        },
      });
      continue;
    }

    await prisma.review.create({
      data: {
        productId: product.id,
        authorName: r.authorName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        isVerifiedPurchase: r.verified,
      },
    });
  }

  // Denormalised rating columns keep product grids fast.
  const grouped = await prisma.review.groupBy({
    by: ["productId"],
    where: { status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  for (const g of grouped) {
    await prisma.product.update({
      where: { id: g.productId },
      data: {
        ratingAverage: Math.round((g._avg.rating ?? 0) * 10) / 10,
        ratingCount: g._count.rating,
      },
    });
  }
  console.log(`  ${reviews.length} reviews ready`);
}

const DEMO_ADDRESS = {
  fullName: "Ananya Rao",
  phone: "+919812345678",
  line1: "402, Sunbeam Residency",
  line2: "18th Main, Koramangala 5th Block",
  landmark: "Opposite Forum Mall",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560095",
  country: "India",
};

type DemoOrderSpec = {
  status:
    | "DELIVERED"
    | "SHIPPED"
    | "PROCESSING"
    | "PAYMENT_UNDER_REVIEW"
    | "PENDING_PAYMENT"
    | "CANCELLED";
  daysAgo: number;
  lines: { slug: string; quantity: number }[];
  couponCode?: string;
  withAccount?: boolean;
  paymentStatus: "PAID" | "UNDER_REVIEW" | "AWAITING_CONFIRMATION" | "EXPIRED";
  utr?: string;
  proof?: boolean;
};

const demoOrders: DemoOrderSpec[] = [
  {
    status: "DELIVERED",
    daysAgo: 26,
    lines: [{ slug: "aurelia-hoop-earrings", quantity: 1 }, { slug: "veda-stacking-band", quantity: 2 }],
    couponCode: "WELCOME10",
    withAccount: true,
    paymentStatus: "PAID",
    utr: "418923746512",
  },
  {
    status: "DELIVERED",
    daysAgo: 18,
    lines: [{ slug: "noor-crystal-studs", quantity: 1 }],
    withAccount: true,
    paymentStatus: "PAID",
    utr: "418923746980",
  },
  {
    status: "SHIPPED",
    daysAgo: 5,
    lines: [{ slug: "meera-emerald-pendant", quantity: 1 }],
    paymentStatus: "PAID",
    utr: "521904837261",
  },
  {
    status: "PROCESSING",
    daysAgo: 2,
    lines: [{ slug: "rivana-solitaire-ring", quantity: 1 }],
    withAccount: true,
    paymentStatus: "PAID",
    utr: "667281930455",
  },
  {
    status: "PAYMENT_UNDER_REVIEW",
    daysAgo: 0,
    lines: [{ slug: "anaya-layering-necklace", quantity: 2 }, { slug: "leela-anklet", quantity: 1 }],
    couponCode: "FREESHIP",
    paymentStatus: "UNDER_REVIEW",
    utr: "774590128366",
    proof: true,
  },
  {
    status: "PAYMENT_UNDER_REVIEW",
    daysAgo: 0,
    lines: [{ slug: "tara-drop-earrings", quantity: 1 }],
    withAccount: true,
    paymentStatus: "UNDER_REVIEW",
    utr: "774590199012",
    proof: true,
  },
  {
    status: "PENDING_PAYMENT",
    daysAgo: 0,
    lines: [{ slug: "saanjh-rope-chain", quantity: 1 }],
    paymentStatus: "AWAITING_CONFIRMATION",
  },
  {
    status: "CANCELLED",
    daysAgo: 11,
    lines: [{ slug: "kiara-tennis-bracelet", quantity: 1 }],
    paymentStatus: "EXPIRED",
  },
];

async function seedOrders(
  settings: PricingSettings,
  customerId: string,
  adminId: string,
) {
  const existing = await prisma.order.count();
  if (existing > 0) {
    console.log(`  ${existing} orders already present, skipped`);
    return;
  }

  for (const spec of demoOrders) {
    const placedAt = new Date(Date.now() - spec.daysAgo * 86_400_000 - 3_600_000);

    const lines = [];
    for (const l of spec.lines) {
      const product = await prisma.product.findUnique({
        where: { slug: l.slug },
        include: {
          variants: { orderBy: { sortOrder: "asc" }, take: 1 },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      });
      if (!product?.variants[0]) continue;
      lines.push({ product, variant: product.variants[0], quantity: l.quantity });
    }
    if (lines.length === 0) continue;

    const coupon = spec.couponCode
      ? await prisma.coupon.findUnique({ where: { code: spec.couponCode } })
      : null;

    const breakdown = priceCart({
      lines: lines.map((l) => ({
        variantId: l.variant.id,
        unitPricePaise: l.variant.pricePaise,
        quantity: l.quantity,
      })),
      coupon: coupon
        ? {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minSubtotalPaise: coupon.minSubtotalPaise,
            maxDiscountPaise: coupon.maxDiscountPaise,
          }
        : null,
      settings,
    });

    const isPaid = spec.paymentStatus === "PAID";
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(placedAt),
        userId: spec.withAccount ? customerId : null,
        email: spec.withAccount ? "ananya@example.com" : "guest.buyer@example.com",
        phone: DEMO_ADDRESS.phone,
        status: spec.status,
        subtotalPaise: breakdown.subtotalPaise,
        discountPaise: breakdown.discountPaise,
        shippingPaise: breakdown.shippingPaise,
        taxPaise: breakdown.taxPaise,
        grandTotalPaise: breakdown.grandTotalPaise,
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        shippingAddress: DEMO_ADDRESS,
        accessToken: generateAccessToken(),
        stockCommitted: isPaid,
        stockHoldExpiresAt:
          spec.status === "PENDING_PAYMENT"
            ? new Date(Date.now() + 40 * 60_000)
            : null,
        placedAt,
        createdAt: placedAt,
        paidAt: isPaid ? new Date(placedAt.getTime() + 12 * 60_000) : null,
        shippedAt:
          spec.status === "SHIPPED" || spec.status === "DELIVERED"
            ? new Date(placedAt.getTime() + 2 * 86_400_000)
            : null,
        deliveredAt:
          spec.status === "DELIVERED"
            ? new Date(placedAt.getTime() + 5 * 86_400_000)
            : null,
        cancelledAt: spec.status === "CANCELLED" ? new Date(placedAt.getTime() + 3_600_000) : null,
        items: {
          create: lines.map((l) => ({
            variantId: l.variant.id,
            productId: l.product.id,
            productName: l.product.name,
            productSlug: l.product.slug,
            variantLabel: l.variant.label,
            sku: l.variant.sku,
            imageUrl: l.product.images[0]?.url ?? null,
            unitPricePaise: l.variant.pricePaise,
            quantity: l.quantity,
            lineTotalPaise: l.variant.pricePaise * l.quantity,
          })),
        },
        payments: {
          create: {
            provider: "MANUAL_UPI",
            status: spec.paymentStatus,
            amountPaise: breakdown.grandTotalPaise,
            upiVpa: spec.utr ? "ananya@okhdfcbank" : null,
            upiUtr: spec.utr ?? null,
            payerName: spec.utr ? "Ananya Rao" : null,
            proofPath: spec.proof ? `demo/proof-${spec.utr}.jpg` : null,
            proofMimeType: spec.proof ? "image/jpeg" : null,
            verifiedById: isPaid ? adminId : null,
            verifiedAt: isPaid ? new Date(placedAt.getTime() + 12 * 60_000) : null,
            expiresAt:
              spec.status === "PENDING_PAYMENT"
                ? new Date(Date.now() + 40 * 60_000)
                : null,
            createdAt: placedAt,
          },
        },
      },
    });

    if (coupon) {
      await prisma.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orderId: order.id,
          userId: spec.withAccount ? customerId : null,
          discountPaise: breakdown.discountPaise,
        },
      });
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    // Committed stock leaves the ledger balanced against the variant row.
    if (isPaid) {
      for (const l of lines) {
        const variant = await prisma.productVariant.update({
          where: { id: l.variant.id },
          data: { stockQty: { decrement: l.quantity } },
        });
        await prisma.inventoryMovement.create({
          data: {
            variantId: l.variant.id,
            delta: -l.quantity,
            reason: "ORDER",
            balanceAfter: variant.stockQty,
            orderId: order.id,
            note: `Order ${order.orderNumber}`,
          },
        });
        await prisma.product.update({
          where: { id: l.product.id },
          data: { soldCount: { increment: l.quantity } },
        });
      }
    }

    const timeline: {
      type:
        | "ORDER_PLACED"
        | "PAYMENT_PROOF_SUBMITTED"
        | "PAYMENT_VERIFIED"
        | "STATUS_CHANGED"
        | "SHIPMENT_UPDATED"
        | "CANCELLED";
      message: string;
      at: Date;
    }[] = [
      { type: "ORDER_PLACED", message: "Order placed.", at: placedAt },
    ];
    if (spec.utr) {
      timeline.push({
        type: "PAYMENT_PROOF_SUBMITTED",
        message: `UPI reference ${spec.utr} submitted for verification.`,
        at: new Date(placedAt.getTime() + 8 * 60_000),
      });
    }
    if (isPaid) {
      timeline.push({
        type: "PAYMENT_VERIFIED",
        message: "Payment verified against the UPI statement.",
        at: new Date(placedAt.getTime() + 12 * 60_000),
      });
      timeline.push({
        type: "STATUS_CHANGED",
        message: "Order confirmed and queued for packing.",
        at: new Date(placedAt.getTime() + 13 * 60_000),
      });
    }
    if (spec.status === "SHIPPED" || spec.status === "DELIVERED") {
      timeline.push({
        type: "SHIPMENT_UPDATED",
        message: "Handed to the courier.",
        at: new Date(placedAt.getTime() + 2 * 86_400_000),
      });
    }
    if (spec.status === "DELIVERED") {
      timeline.push({
        type: "SHIPMENT_UPDATED",
        message: "Delivered and signed for.",
        at: new Date(placedAt.getTime() + 5 * 86_400_000),
      });
    }
    if (spec.status === "CANCELLED") {
      timeline.push({
        type: "CANCELLED",
        message: "Cancelled automatically — payment was not completed in time.",
        at: new Date(placedAt.getTime() + 3_600_000),
      });
    }

    await prisma.orderTimelineEntry.createMany({
      data: timeline.map((t) => ({
        orderId: order.id,
        type: t.type,
        message: t.message,
        createdAt: t.at,
      })),
    });

    if (spec.status === "SHIPPED" || spec.status === "DELIVERED") {
      const shippedAt = new Date(placedAt.getTime() + 2 * 86_400_000);
      const awb = `BD${Math.floor(1e10 + Math.random() * 8e10)}`;
      const shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrier: "Bluedart",
          awb,
          trackingUrl: `https://www.bluedart.com/tracking?awb=${awb}`,
          status: spec.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
          weightGrams: 60,
          shippedAt,
          deliveredAt:
            spec.status === "DELIVERED"
              ? new Date(placedAt.getTime() + 5 * 86_400_000)
              : null,
          estimatedDelivery: new Date(placedAt.getTime() + 5 * 86_400_000),
        },
      });
      const events: {
        status:
          | "LABEL_CREATED"
          | "PICKED_UP"
          | "IN_TRANSIT"
          | "OUT_FOR_DELIVERY"
          | "DELIVERED";
        description: string;
        at: Date;
      }[] = [
        { status: "LABEL_CREATED" as const, description: "Shipping label created.", at: shippedAt },
        { status: "PICKED_UP" as const, description: "Picked up from Jaipur hub.", at: new Date(shippedAt.getTime() + 4 * 3_600_000) },
        { status: "IN_TRANSIT" as const, description: "In transit via Delhi sorting centre.", at: new Date(shippedAt.getTime() + 20 * 3_600_000) },
      ];
      if (spec.status === "DELIVERED") {
        events.push(
          { status: "OUT_FOR_DELIVERY" as const, description: "Out for delivery in Bengaluru.", at: new Date(shippedAt.getTime() + 60 * 3_600_000) },
          { status: "DELIVERED" as const, description: "Delivered and signed for by Ananya Rao.", at: new Date(shippedAt.getTime() + 72 * 3_600_000) },
        );
      }
      await prisma.shipmentEvent.createMany({
        data: events.map((e) => ({
          shipmentId: shipment.id,
          status: e.status,
          description: e.description,
          location: "India",
          occurredAt: e.at,
        })),
      });
    }

    await prisma.notificationLog.create({
      data: {
        channel: "EMAIL",
        template: "order-received",
        recipient: order.email,
        subject: `We have your order ${order.orderNumber}`,
        orderId: order.id,
        status: "SENT",
        sentAt: placedAt,
        attempts: 1,
      },
    });
  }

  console.log(`  ${demoOrders.length} demo orders ready`);
}

async function main() {
  console.log("Seeding House of Rivana…");
  const details = await readDetails();

  const settingsRow = await seedSettings(details);
  const { admin, customer } = await seedUsers();
  await retireObsoleteDemoCatalog();
  const collectionIds = await seedCollections();
  await seedProducts(collectionIds, admin.id);
  await seedCoupons();
  await seedHeroSlides();
  await seedReviews();
  await seedOrders(
    {
      freeShippingThresholdPaise: settingsRow.freeShippingThresholdPaise,
      flatShippingRatePaise: settingsRow.flatShippingRatePaise,
      gstBasisPoints: settingsRow.gstBasisPoints,
      gstInclusive: settingsRow.gstInclusive,
    },
    customer.id,
    admin.id,
  );

  console.log("\nDone.");
  console.log(`  Admin login: ${admin.email} / ${process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026"}`);
  console.log("  Customer login: ananya@example.com / Customer!2026");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
