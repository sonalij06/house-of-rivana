import Link from "next/link";
import { Quote } from "lucide-react";
import { CollectionShowcase } from "@/components/home/collection-showcase";
import { EditorialBand } from "@/components/home/editorial-band";
import { Hero } from "@/components/home/hero";
import { PromiseStrip } from "@/components/home/promise-strip";
import {
  Marquee,
  Reveal,
  StaggerGroup,
  StaggerItem,
} from "@/components/motion/primitives";
import { ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  getFeaturedCollections,
  getHeroSlides,
  getShowcaseProducts,
} from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { getWishlistedProductIds } from "@/lib/wishlist";

const MARQUEE_WORDS = [
  "Fashion jewellery",
  "CZ & AD stones",
  "Anti-tarnish plating",
  "Bridal & everyday edits",
  "Insured delivery",
  "Easy exchanges",
];

export default async function HomePage() {
  const [slides, collections, showcase, wishlisted, testimonials] =
    await Promise.all([
      getHeroSlides(),
      getFeaturedCollections(),
      getShowcaseProducts(),
      getWishlistedProductIds(),
      prisma.review.findMany({
        where: { status: "APPROVED", rating: { gte: 4 } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { product: { select: { name: true, slug: true } } },
      }),
    ]);

  return (
    <>
      <Hero slides={slides} />

      <Marquee className="border-b border-hairline bg-ink py-3.5" speed={38}>
        {MARQUEE_WORDS.map((word) => (
          <span
            key={word}
            className="flex items-center gap-8 px-8 text-[0.625rem] font-medium uppercase tracking-[0.24em] text-cream/70"
          >
            {word}
            <span className="text-champagne">&#9670;</span>
          </span>
        ))}
      </Marquee>

      <section className="container-site section-y">
        <SectionHeading
          eyebrow="The collections"
          title="Six ways into the house."
          description="Each edit answers a different moment — what to wear every day, what to wear to a wedding, and what photographs beautifully."
          href="/collections"
          hrefLabel="All collections"
        />
        <div className="mt-12">
          <CollectionShowcase
            collections={collections.map((c) => ({
              slug: c.slug,
              name: c.name,
              subtitle: c.subtitle,
              heroImage: c.heroImage,
              productCount: c._count.products,
            }))}
          />
        </div>
      </section>

      {showcase.featured.length > 0 ? (
        <section className="container-site section-y pt-0">
          <SectionHeading
            eyebrow="Selected pieces"
            title="What we would choose."
            description="The pieces our own team wears on repeat, and the ones that sell out every festive week."
            href="/shop"
            hrefLabel="Shop all"
          />
          <ProductGrid
            products={showcase.featured}
            wishlisted={wishlisted}
            className="mt-12"
          />
        </section>
      ) : null}

      <PromiseStrip />

      <EditorialBand
        eyebrow="The studio"
        title="Designed for trends. Finished in small runs."
        body={[
          "House of Rivana makes artificial fashion jewellery — plated metals, CZ and AD stones, kundan-style glass — so you can change your look with the season without a precious-metal budget.",
          "We QC every piece before it ships: clasp strength, plating colour, stone seating and finish. If something isn’t right, it doesn’t leave the studio.",
        ]}
        imageUrl="/placeholders/editorial-1.svg"
        href="/about"
        linkLabel="Inside the house"
        notes={[
          { label: "Founded", value: "2024" },
          { label: "Focus", value: "Fashion" },
          { label: "Dispatch", value: "2 days" },
        ]}
      />

      {showcase.newArrivals.length > 0 ? (
        <section className="container-site section-y pt-0">
          <SectionHeading
            eyebrow="Just arrived"
            title="New this season."
            href="/shop?sort=newest"
            hrefLabel="See all new"
          />
          <ProductGrid
            products={showcase.newArrivals}
            wishlisted={wishlisted}
            className="mt-12"
          />
        </section>
      ) : null}

      {testimonials.length > 0 ? (
        <section className="border-y border-hairline bg-surface">
          <div className="container-site section-y">
            <SectionHeading
              eyebrow="In their words"
              title="What customers tell us."
              align="center"
            />
            <StaggerGroup className="mt-12 grid gap-8 md:grid-cols-3" stagger={0.1}>
              {testimonials.map((review) => (
                <StaggerItem
                  key={review.id}
                  className="flex flex-col border border-hairline bg-cream p-7"
                >
                  <Quote className="size-5 text-champagne" strokeWidth={1.5} />
                  <Rating value={review.rating} className="mt-5" />
                  {review.title ? (
                    <p className="mt-4 font-display text-xl leading-snug text-ink">
                      {review.title}
                    </p>
                  ) : null}
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                    {review.body}
                  </p>
                  <div className="mt-6 border-t border-hairline pt-4">
                    <p className="text-xs font-medium text-ink">
                      {review.authorName}
                    </p>
                    <Link
                      href={`/product/${review.product.slug}`}
                      className="mt-0.5 inline-block text-xs text-muted transition-colors hover:text-gold"
                    >
                      on the {review.product.name}
                    </Link>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
      ) : null}

      <EditorialBand
        eyebrow="Styling help"
        title="Tell us the outfit. We’ll shortlist looks."
        body={[
          "Not sure whether you need a bridal set, everyday stacks or something for a cocktail? Send a photo of the outfit or the vibe and we’ll reply with a few pieces that fit.",
          "No hard sell — just honest suggestions from people who actually wear the catalogue.",
        ]}
        imageUrl="/placeholders/editorial-2.svg"
        href="/contact"
        linkLabel="Ask for a shortlist"
        flip
      />

      <section className="container-site pb-24">
        <Reveal>
          <div className="relative overflow-hidden border border-hairline bg-ink px-8 py-16 text-center md:px-16 md:py-20">
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 0%, rgba(201,169,98,0.55) 0%, rgba(201,169,98,0) 70%)",
              }}
            />
            <p className="eyebrow relative text-champagne">
              Not sure where to start?
            </p>
            <h2 className="relative mt-4 font-display text-[clamp(1.9rem,4vw,3.25rem)] leading-tight text-cream">
              Tell us the occasion. We will shortlist five pieces.
            </h2>
            <p className="relative mx-auto mt-5 max-w-lg text-sm leading-relaxed text-cream/70">
              A real person reads every message and replies within a business day —
              no chatbot, no upsell.
            </p>
            <div className="relative mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild variant="gold" size="lg">
                <Link href="/contact">Ask a question</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-cream/40 text-cream hover:border-champagne hover:text-champagne"
              >
                <Link href="/shop">Browse everything</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
