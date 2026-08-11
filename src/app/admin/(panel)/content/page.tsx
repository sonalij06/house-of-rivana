import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Panel } from "@/components/admin/primitives";
import { HeroEditor } from "@/components/admin/hero-editor";
import {
  CollectionFeatureList,
  ProductFeatureList,
} from "@/components/admin/feature-toggles";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Homepage" };

export default async function AdminContentPage() {
  await requireStaff("/admin/content");

  const [slides, products, collections, settings] = await Promise.all([
    prisma.heroSlide.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        isBestseller: true,
        isNewArrival: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
    }),
    prisma.collection.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);

  return (
    <>
      <AdminHeader
        title="Homepage"
        description="What a first-time visitor sees: the hero, the featured collections and the pieces that lead each row."
      >
        <Link
          href="/"
          target="_blank"
          className="self-center text-[0.625rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold"
        >
          View storefront →
        </Link>
      </AdminHeader>

      <div className="space-y-5">
        <HeroEditor
          slides={slides.map((slide) => ({
            id: slide.id,
            eyebrow: slide.eyebrow,
            title: slide.title,
            subtitle: slide.subtitle,
            imageUrl: slide.imageUrl,
            ctaLabel: slide.ctaLabel,
            ctaHref: slide.ctaHref,
            alignment: slide.alignment,
            sortOrder: slide.sortOrder,
            isActive: slide.isActive,
          }))}
        />

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr] xl:items-start">
          <Panel title="Pieces on the homepage">
            <p className="mb-4 text-sm text-muted">
              Featured pieces fill the editorial row, bestsellers the “most loved” row, and
              new arrivals the newest-first grid.
            </p>
            <ProductFeatureList
              products={products.map((product) => ({
                id: product.id,
                name: product.name,
                slug: product.slug,
                imageUrl: product.images[0]?.url ?? null,
                isFeatured: product.isFeatured,
                isBestseller: product.isBestseller,
                isNewArrival: product.isNewArrival,
              }))}
            />
          </Panel>

          <div className="space-y-5">
            <Panel title="Featured collections">
              <p className="mb-3 text-sm text-muted">
                Ticked collections appear in the homepage collection band, in the order set
                on the collections screen.
              </p>
              <CollectionFeatureList
                collections={collections.map((collection) => ({
                  id: collection.id,
                  slug: collection.slug,
                  name: collection.name,
                  subtitle: collection.subtitle,
                  description: collection.description,
                  heroImage: collection.heroImage,
                  sortOrder: collection.sortOrder,
                  isActive: collection.isActive,
                  isFeatured: collection.isFeatured,
                  metaTitle: collection.metaTitle,
                  metaDescription: collection.metaDescription,
                }))}
              />
            </Panel>

            <Panel title="Announcement bar">
              <p className="text-sm text-muted">
                {settings.announcementEnabled ? (
                  <>
                    Currently showing:{" "}
                    <span className="text-ink">“{settings.announcementText}”</span>
                  </>
                ) : (
                  "The announcement bar is hidden."
                )}
              </p>
              <Link
                href="/admin/settings"
                className="mt-3 inline-block text-[0.625rem] uppercase tracking-[0.16em] text-gold underline-offset-4 hover:underline"
              >
                Edit in settings →
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
