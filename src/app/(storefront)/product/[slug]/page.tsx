import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { BuyPanel } from "@/components/product/buy-panel";
import { ProductDetails } from "@/components/product/product-details";
import { ProductGallery } from "@/components/product/product-gallery";
import { ReviewList } from "@/components/product/review-list";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { availableStock, metalLabel } from "@/lib/product";
import { getSettings } from "@/lib/settings";
import { getWishlistedProductIds } from "@/lib/wishlist";
import { env } from "@/lib/env";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Piece not found" };

  const title = product.metaTitle ?? product.name;
  const description =
    product.metaDescription ??
    product.shortDescription ??
    product.description.slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "ACTIVE") notFound();

  const collectionSlugs = product.collections.map((c) => c.collection.slug);
  const [related, settings, wishlisted] = await Promise.all([
    getRelatedProducts(product.id, collectionSlugs, 4),
    getSettings(),
    getWishlistedProductIds(),
  ]);

  const primaryCollection = product.collections[0]?.collection;
  const inStock = product.variants.some((v) => availableStock(v) > 0);
  const cheapest = Math.min(...product.variants.map((v) => v.pricePaise), product.basePricePaise);

  return (
    <div>
      <script
        type="application/ld+json"
        // Product/Offer/AggregateRating so the listing can win a rich result.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            productJsonLd({
              product,
              inStock,
              cheapest,
              baseUrl: env.NEXT_PUBLIC_APP_URL,
              brandName: settings.brandName,
              collection: primaryCollection,
            }),
          ),
        }}
      />

      <div className="container-site py-8 md:py-10">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            ...(primaryCollection
              ? [
                  {
                    label: primaryCollection.name,
                    href: `/collections/${primaryCollection.slug}`,
                  },
                ]
              : []),
            { label: product.name },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery
            images={product.images
              .filter((image) => !image.is360Frame)
              .map((image) => ({
                id: image.id,
                url: image.url,
                alt: image.alt,
                blurDataUrl: image.blurDataUrl,
              }))}
            productName={product.name}
            slug={product.slug}
          />

          {/* Sticky only wraps the buy UI — details sit below so they never
              scroll over Add to bag when the panel sticks. */}
          <div className="lg:sticky lg:top-28 lg:self-start lg:z-10 lg:bg-cream">
            <BuyPanel
              productId={product.id}
              productName={product.name}
              slug={product.slug}
              shortDescription={product.shortDescription}
              metal={product.metal}
              purity={product.purity}
              gemstone={product.gemstone}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                sku: variant.sku,
                label: variant.label,
                optionSize: variant.optionSize,
                optionMetal: variant.optionMetal,
                optionLength: variant.optionLength,
                pricePaise: variant.pricePaise,
                compareAtPaise: variant.compareAtPaise,
                stockQty: variant.stockQty,
                reservedQty: variant.reservedQty,
                lowStockThreshold: variant.lowStockThreshold,
              }))}
              ratingAverage={product.ratingAverage}
              ratingCount={product.ratingCount}
              madeToOrderDays={product.madeToOrderDays}
              freeShippingThresholdPaise={settings.freeShippingThresholdPaise}
              isWishlisted={wishlisted.has(product.id)}
              collection={
                primaryCollection
                  ? { slug: primaryCollection.slug, name: primaryCollection.name }
                  : undefined
              }
            />
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="hidden lg:block" aria-hidden />
          <ProductDetails
            sections={[
              { id: "description", label: "Description", body: product.description },
              { id: "story", label: "The story", body: product.story },
              {
                id: "specs",
                label: "Specification",
                body: null,
                rows: [
                  { label: "Finish", value: metalLabel(product.metal) },
                  ...(product.purity ? [{ label: "Plating", value: product.purity }] : []),
                  ...(product.gemstone
                    ? [{ label: "Stone", value: product.gemstone }]
                    : []),
                  ...(product.weightGrams
                    ? [{ label: "Weight", value: `${product.weightGrams} g` }]
                    : []),
                  ...(product.dimensions
                    ? [{ label: "Dimensions", value: product.dimensions }]
                    : []),
                ],
              },
              { id: "care", label: "Care", body: product.careInstructions },
              {
                id: "shipping",
                label: "Shipping & returns",
                body: `Insured delivery across India, free above ₹${(settings.freeShippingThresholdPaise / 100).toLocaleString("en-IN")}. Dispatched within two working days${product.madeToOrderDays ? `, or ${product.madeToOrderDays} days for this made-to-order piece` : ""}.\n\nReturns accepted within 15 days of delivery provided the piece is unworn and in its original packaging. Personalised items are final sale.`,
              },
            ]}
          />
        </div>
      </div>

      <div className="container-site pb-20">
        <ReviewList
          reviews={product.reviews.map((review) => ({
            id: review.id,
            authorName: review.authorName,
            rating: review.rating,
            title: review.title,
            body: review.body,
            imageUrls: review.imageUrls,
            isVerifiedPurchase: review.isVerifiedPurchase,
            createdAt: review.createdAt,
          }))}
          ratingAverage={product.ratingAverage}
          ratingCount={product.ratingCount}
        >
          <Link
            href={`/account/reviews?product=${product.slug}`}
            className="text-[0.6875rem] uppercase tracking-[0.14em] text-gold underline-offset-4 hover:underline"
          >
            Write a review
          </Link>
        </ReviewList>

        {related.length ? (
          <div className="mt-20">
            <SectionHeading
              eyebrow="You may also like"
              title="Pieces that sit well together"
              href={
                primaryCollection ? `/collections/${primaryCollection.slug}` : "/shop"
              }
              hrefLabel={
                primaryCollection ? `All ${primaryCollection.name}` : "Shop all"
              }
            />
            <ProductGrid products={related} wishlisted={wishlisted} className="mt-10" />
          </div>
        ) : null}
      </div>

      {/* Clears the fixed mobile buy bar. */}
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}

function productJsonLd({
  product,
  inStock,
  cheapest,
  baseUrl,
  brandName,
  collection,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;
  inStock: boolean;
  cheapest: number;
  baseUrl: string;
  brandName: string;
  collection?: { slug: string; name: string };
}) {
  const url = `${baseUrl}/product/${product.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": url,
        name: product.name,
        description: product.shortDescription ?? product.description,
        sku: product.variants[0]?.sku,
        image: product.images.map((image) => `${baseUrl}${image.url}`),
        material: metalLabel(product.metal),
        brand: { "@type": "Brand", name: brandName },
        ...(product.ratingCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.ratingAverage.toFixed(1),
                reviewCount: product.ratingCount,
              },
            }
          : {}),
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          lowPrice: (cheapest / 100).toFixed(2),
          highPrice: (
            Math.max(...product.variants.map((v) => v.pricePaise), product.basePricePaise) / 100
          ).toFixed(2),
          offerCount: product.variants.length,
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${baseUrl}/shop` },
          ...(collection
            ? [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: collection.name,
                  item: `${baseUrl}/collections/${collection.slug}`,
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: collection ? 4 : 3,
            name: product.name,
            item: url,
          },
        ],
      },
    ],
  };
}
