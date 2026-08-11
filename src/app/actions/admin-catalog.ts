"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { failField, failMessage, failWrite, failZod } from "@/lib/action-errors";
import { assertStaff, recordAudit } from "@/lib/session";
import { deleteProductImage, uploadProductImage } from "@/lib/storage";
import type { ActionResult } from "@/app/actions/cart";

const METALS = [
  "YELLOW_GOLD",
  "ROSE_GOLD",
  "WHITE_GOLD",
  "STERLING_SILVER",
  "PLATINUM",
  "GOLD_VERMEIL",
  "BRASS",
] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function refreshCatalog(slug?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/product/${slug}`);
}

const productSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .trim()
    .min(3, "The slug needs at least three characters.")
    .max(80)
    .regex(slugPattern, "Use lowercase words separated by hyphens."),
  name: z.string().trim().min(2, "Give the piece a name.").max(120),
  shortDescription: z.string().trim().max(200).optional(),
  description: z.string().trim().min(20, "Write at least a couple of sentences."),
  story: z.string().trim().max(2000).optional(),
  metal: z.enum(METALS),
  purity: z.string().trim().max(40).optional(),
  gemstone: z.string().trim().max(120).optional(),
  weightGrams: z.number().min(0).max(5000).optional(),
  dimensions: z.string().trim().max(120).optional(),
  careInstructions: z.string().trim().max(1000).optional(),
  basePriceRupees: z
    .number({ error: "Set a price." })
    .min(1, "Set a price.")
    .max(50_000_000),
  compareAtRupees: z
    .number({ error: "Enter a valid compare-at price." })
    .min(0)
    .max(50_000_000)
    .optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  isFeatured: z.boolean(),
  isBestseller: z.boolean(),
  isNewArrival: z.boolean(),
  madeToOrderDays: z
    .number({ error: "Enter days as a whole number." })
    .int()
    .min(0)
    .max(180)
    .optional(),
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(180).optional(),
  collectionIds: z.array(z.string()).max(12),
});

export async function saveProduct(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const actor = await assertStaff();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  const clash = await prisma.product.findFirst({
    where: { slug: data.slug, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return failField("slug", `The slug “${data.slug}” is already in use.`);
  }

  const payload = {
    slug: data.slug,
    name: data.name,
    shortDescription: data.shortDescription || null,
    description: data.description,
    story: data.story || null,
    metal: data.metal,
    purity: data.purity || null,
    gemstone: data.gemstone || null,
    weightGrams: data.weightGrams ?? null,
    dimensions: data.dimensions || null,
    careInstructions: data.careInstructions || null,
    basePricePaise: Math.round(data.basePriceRupees * 100),
    compareAtPaise: data.compareAtRupees ? Math.round(data.compareAtRupees * 100) : null,
    status: data.status,
    isFeatured: data.isFeatured,
    isBestseller: data.isBestseller,
    isNewArrival: data.isNewArrival,
    madeToOrderDays: data.madeToOrderDays ?? null,
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    // publishedAt is the date the storefront sorts "new in" by.
    publishedAt: data.status === "ACTIVE" ? new Date() : null,
  };

  try {
    const before = data.id
      ? await prisma.product.findUnique({ where: { id: data.id } })
      : null;

    const product = data.id
      ? await prisma.product.update({
          where: { id: data.id },
          data: {
            ...payload,
            publishedAt:
              data.status === "ACTIVE" ? (before?.publishedAt ?? new Date()) : null,
          },
        })
      : await prisma.product.create({ data: payload });

    // Collection membership is a full replace: simpler to reason about than diffing.
    await prisma.productCollection.deleteMany({ where: { productId: product.id } });
    if (data.collectionIds.length > 0) {
      await prisma.productCollection.createMany({
        data: data.collectionIds.map((collectionId, index) => ({
          productId: product.id,
          collectionId,
          sortOrder: index,
        })),
      });
    }

    await recordAudit({
      actor,
      action: data.id ? "product.update" : "product.create",
      entity: "Product",
      entityId: product.id,
      before,
      after: product,
    });

    refreshCatalog(product.slug);
    return { ok: true, data: { id: product.id, slug: product.slug } };
  } catch (err) {
    return failWrite(err, {
      slug: `The slug “${data.slug}” is already in use.`,
    });
  }
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, name: true, _count: { select: { orderItems: true } } },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  // Order history must stay readable, so anything ever sold is archived instead.
  if (product._count.orderItems > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { status: "ARCHIVED", publishedAt: null },
    });
    await recordAudit({
      actor,
      action: "product.archive",
      entity: "Product",
      entityId: productId,
      after: { reason: "has order history" },
    });
    refreshCatalog(product.slug);
    return {
      ok: true,
    };
  }

  await prisma.product.delete({ where: { id: productId } });
  await recordAudit({
    actor,
    action: "product.delete",
    entity: "Product",
    entityId: productId,
    before: product,
  });
  refreshCatalog(product.slug);
  return { ok: true };
}

/** Single-flag toggle used by the homepage editor, which has no full form. */
export async function toggleProductFlag(input: {
  productId: string;
  flag: "isFeatured" | "isBestseller" | "isNewArrival";
  value: boolean;
}): Promise<ActionResult> {
  const actor = await assertStaff();

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { slug: true, name: true },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  await prisma.product.update({
    where: { id: input.productId },
    data: { [input.flag]: input.value },
  });

  await recordAudit({
    actor,
    action: "product.flag",
    entity: "Product",
    entityId: input.productId,
    after: { name: product.name, [input.flag]: input.value },
  });

  refreshCatalog(product.slug);
  revalidatePath("/admin/content");
  return { ok: true };
}

const variantSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  sku: z
    .string()
    .trim()
    .min(3, "A SKU needs at least three characters.")
    .max(60)
    .regex(/^[A-Z0-9-]+$/, "Use capitals, digits and hyphens only."),
  label: z.string().trim().min(1, "Give the variant a label.").max(80),
  optionSize: z.string().trim().max(40).optional(),
  optionMetal: z.enum(METALS, { error: "Choose a metal finish." }).optional(),
  optionLength: z.string().trim().max(40).optional(),
  priceRupees: z
    .number({ error: "Set a price." })
    .min(1, "Set a price.")
    .max(50_000_000),
  compareAtRupees: z
    .number({ error: "Enter a valid compare-at price." })
    .min(0)
    .max(50_000_000)
    .optional(),
  stockQty: z
    .number({ error: "Enter stock as a whole number." })
    .int("Enter stock as a whole number.")
    .min(0)
    .max(100_000),
  lowStockThreshold: z
    .number({ error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(0)
    .max(1000),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export async function saveVariant(input: unknown): Promise<ActionResult> {
  const actor = await assertStaff();

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  const clash = await prisma.productVariant.findFirst({
    where: { sku: data.sku, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (clash) return failField("sku", `SKU ${data.sku} already exists.`);

  const payload = {
    productId: data.productId,
    sku: data.sku,
    label: data.label,
    optionSize: data.optionSize || null,
    optionMetal: data.optionMetal ?? null,
    optionLength: data.optionLength || null,
    pricePaise: Math.round(data.priceRupees * 100),
    compareAtPaise: data.compareAtRupees ? Math.round(data.compareAtRupees * 100) : null,
    lowStockThreshold: data.lowStockThreshold,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  };

  try {
    if (data.id) {
      const before = await prisma.productVariant.findUnique({ where: { id: data.id } });
      if (!before) return failMessage("That variant no longer exists.");

      // Stock only ever moves through the ledger, so an edit here writes a movement
      // rather than silently overwriting the count.
      const delta = data.stockQty - before.stockQty;
      await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({ where: { id: data.id }, data: payload });
        if (delta !== 0) {
          await tx.productVariant.update({
            where: { id: data.id },
            data: { stockQty: data.stockQty },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: data.id!,
              delta,
              reason: "ADJUSTMENT",
              balanceAfter: data.stockQty,
              note: `Set to ${data.stockQty} from the product editor`,
              actorId: actor.id,
            },
          });
        }
      });

      await recordAudit({
        actor,
        action: "variant.update",
        entity: "ProductVariant",
        entityId: data.id,
        before,
        after: { ...payload, stockQty: data.stockQty },
      });
    } else {
      const created = await prisma.productVariant.create({
        data: { ...payload, stockQty: data.stockQty },
      });
      if (data.stockQty > 0) {
        await prisma.inventoryMovement.create({
          data: {
            variantId: created.id,
            delta: data.stockQty,
            reason: "RESTOCK",
            balanceAfter: data.stockQty,
            note: "Opening stock",
            actorId: actor.id,
          },
        });
      }
      await recordAudit({
        actor,
        action: "variant.create",
        entity: "ProductVariant",
        entityId: created.id,
        after: created,
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { slug: true },
    });
    refreshCatalog(product?.slug);
    return { ok: true };
  } catch (err) {
    return failWrite(err, {
      sku: `SKU ${data.sku} already exists.`,
    });
  }
}

export async function deleteVariant(variantId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      sku: true,
      productId: true,
      product: { select: { slug: true, _count: { select: { variants: true } } } },
      _count: { select: { orderItems: true } },
    },
  });
  if (!variant) return { ok: false, error: "That variant no longer exists." };
  if (variant.product._count.variants <= 1) {
    return { ok: false, error: "A product needs at least one variant." };
  }

  if (variant._count.orderItems > 0) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });
  } else {
    await prisma.productVariant.delete({ where: { id: variantId } });
  }

  await recordAudit({
    actor,
    action: variant._count.orderItems > 0 ? "variant.deactivate" : "variant.delete",
    entity: "ProductVariant",
    entityId: variantId,
    before: variant,
  });

  refreshCatalog(variant.product.slug);
  return { ok: true };
}

/** Multipart upload into Postgres (`StoredImage`), exposed at `/api/media/[id]`. */
export async function uploadImages(
  formData: FormData,
): Promise<ActionResult<{ added: number }>> {
  const actor = await assertStaff();

  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, _count: { select: { images: true } } },
  });
  if (!product) return failMessage("That product no longer exists.");

  const files = formData.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) return failMessage("Choose at least one image.");

  try {
    let added = 0;
    const errors: string[] = [];
    for (const [index, file] of files.entries()) {
      if (file.size === 0) continue;
      const uploaded = await uploadProductImage(product.slug, file);
      if (!uploaded.ok || !uploaded.publicUrl) {
        errors.push(uploaded.ok ? "Stored, but no public URL came back." : uploaded.error);
        continue;
      }
      await prisma.productImage.create({
        data: {
          productId,
          url: uploaded.publicUrl,
          alt: `${product.slug} photograph`,
          sortOrder: product._count.images + index,
          isPrimary: product._count.images === 0 && index === 0,
        },
      });
      added += 1;
    }

    if (added === 0) {
      return failMessage(errors[0] ?? "None of those files could be stored.");
    }

    await recordAudit({
      actor,
      action: "product.images.upload",
      entity: "Product",
      entityId: productId,
      after: { added },
    });

    refreshCatalog(product.slug);
    return { ok: true, data: { added } };
  } catch (err) {
    return failWrite(err);
  }
}

/** Persists the order produced by dragging thumbnails. */
export async function reorderImages(input: {
  productId: string;
  imageIds: string[];
}): Promise<ActionResult> {
  await assertStaff();

  try {
    await prisma.$transaction(
      input.imageIds.map((id, index) =>
        prisma.productImage.update({
          where: { id },
          data: { sortOrder: index, isPrimary: index === 0 },
        }),
      ),
    );

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { slug: true },
    });
    refreshCatalog(product?.slug);
    return { ok: true };
  } catch (err) {
    return failWrite(err);
  }
}

export async function removeImage(imageId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { url: true, productId: true, product: { select: { slug: true } } },
  });
  if (!image) return failMessage("That image is already gone.");

  try {
    await prisma.productImage.delete({ where: { id: imageId } });
    await deleteProductImage(image.url);

    // Whatever is now first becomes the card image.
    const remaining = await prisma.productImage.findMany({
      where: { productId: image.productId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (remaining.length > 0) {
      await prisma.productImage.update({
        where: { id: remaining[0].id },
        data: { isPrimary: true },
      });
    }

    await recordAudit({
      actor,
      action: "product.images.remove",
      entity: "Product",
      entityId: image.productId,
      before: { url: image.url },
    });

    refreshCatalog(image.product.slug);
    return { ok: true };
  } catch (err) {
    return failWrite(err);
  }
}

export async function updateImageAlt(input: {
  imageId: string;
  alt: string;
}): Promise<ActionResult> {
  await assertStaff();
  const alt = input.alt.trim();
  if (alt.length < 3) {
    return failField("alt", "Describe the image in a few words.");
  }

  try {
    const image = await prisma.productImage.update({
      where: { id: input.imageId },
      data: { alt },
      select: { product: { select: { slug: true } } },
    });
    refreshCatalog(image.product.slug);
    return { ok: true };
  } catch (err) {
    return failWrite(err);
  }
}

const collectionSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .trim()
    .min(3, "The slug needs at least three characters.")
    .max(80)
    .regex(slugPattern, "Use lowercase words separated by hyphens."),
  name: z.string().trim().min(2, "Name the collection.").max(80),
  subtitle: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1200).optional(),
  heroImage: z.string().trim().max(500).optional(),
  sortOrder: z
    .number({ error: "Enter a sort order." })
    .int("Enter a whole number.")
    .min(0)
    .max(999),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(180).optional(),
});

export async function saveCollection(input: unknown): Promise<ActionResult> {
  const actor = await assertStaff();

  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  const clash = await prisma.collection.findFirst({
    where: { slug: data.slug, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return failField("slug", `The slug “${data.slug}” is already in use.`);
  }

  const payload = {
    slug: data.slug,
    name: data.name,
    subtitle: data.subtitle || null,
    description: data.description || null,
    heroImage: data.heroImage || null,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
  };

  try {
    const collection = data.id
      ? await prisma.collection.update({ where: { id: data.id }, data: payload })
      : await prisma.collection.create({ data: payload });

    await recordAudit({
      actor,
      action: data.id ? "collection.update" : "collection.create",
      entity: "Collection",
      entityId: collection.id,
      after: collection,
    });

    revalidatePath("/", "layout");
    revalidatePath(`/collections/${collection.slug}`);
    revalidatePath("/admin/collections");
    return { ok: true };
  } catch (err) {
    return failWrite(err, {
      slug: `The slug “${data.slug}” is already in use.`,
    });
  }
}

export async function deleteCollection(collectionId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { slug: true, name: true },
  });
  if (!collection) return { ok: false, error: "That collection no longer exists." };

  await prisma.collection.delete({ where: { id: collectionId } });
  await recordAudit({
    actor,
    action: "collection.delete",
    entity: "Collection",
    entityId: collectionId,
    before: collection,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/collections");
  return { ok: true };
}

/** Manual stock correction from the inventory screen. */
export async function adjustInventory(input: {
  variantId: string;
  delta: number;
  reason: "RESTOCK" | "ADJUSTMENT" | "DAMAGE";
  note: string;
}): Promise<ActionResult<{ balance: number }>> {
  const actor = await assertStaff();

  if (!Number.isInteger(input.delta) || input.delta === 0) {
    return failField("delta", "Enter how many units to add or remove.");
  }
  if (input.note.trim().length < 3) {
    return failField("note", "Say why — this is an audited change.");
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    select: { stockQty: true, sku: true, product: { select: { slug: true } } },
  });
  if (!variant) return failMessage("That variant no longer exists.");

  const balance = variant.stockQty + input.delta;
  if (balance < 0) {
    return failField("delta", `Only ${variant.stockQty} on hand.`);
  }

  try {
    await prisma.$transaction([
      prisma.productVariant.update({
        where: { id: input.variantId },
        data: { stockQty: balance },
      }),
      prisma.inventoryMovement.create({
        data: {
          variantId: input.variantId,
          delta: input.delta,
          reason: input.reason,
          balanceAfter: balance,
          note: input.note.trim(),
          actorId: actor.id,
        },
      }),
    ]);

    await recordAudit({
      actor,
      action: "inventory.adjust",
      entity: "ProductVariant",
      entityId: input.variantId,
      after: { sku: variant.sku, delta: input.delta, balance },
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    refreshCatalog(variant.product.slug);
    return { ok: true, data: { balance } };
  } catch (err) {
    return failWrite(err);
  }
}
