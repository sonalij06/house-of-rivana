import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EditorialBand } from "@/components/home/editorial-band";
import { Button } from "@/components/ui/button";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "The House",
  description:
    "House of Rivana is an artificial fashion jewellery brand — plated metals, CZ and AD stones, designed for everyday shine and festive statement looks.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Fashion first",
    body: "We make artificial jewellery on purpose — so you can refresh your look with the season without a precious-metal budget.",
  },
  {
    title: "Honest materials",
    body: "Product pages say what you’re buying: gold-plated, rose gold-plated, silver-tone, CZ, AD or kundan-style glass. No hallmark theatre.",
  },
  {
    title: "Short runs",
    body: "We drop collections in limited batches and move on. It keeps the catalogue feeling current, not permanent-heirloom.",
  },
  {
    title: "Direct only",
    body: "No department-store markup. The margin goes into finish quality, packaging and reliable shipping.",
  },
];

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <div>
      <div className="container-site py-12 md:py-16">
        <PageHeader
          eyebrow="Est. Jaipur"
          title="Jewellery made to be worn, not locked away"
          description="House of Rivana began with a simple idea: fashion jewellery should look considered in photographs, feel light on the skin, and cost what a treat costs — not what a loan costs."
          crumbs={[{ label: "The House" }]}
        />

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <p className="font-display text-[1.5rem] leading-snug text-ink md:text-[1.75rem]">
              We started because the two options in front of us felt wrong: throwaway
              plating that fades in a week, or fine counters that price a simple look
              like an event.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="space-y-4 text-sm leading-relaxed text-muted">
              <p>
                So we built a fashion jewellery house — plated finishes, cubic zirconia
                and American diamond looks, kundan-style festive pieces — the kinds of
                things you actually want to wear to brunch, office, and a cousin&apos;s
                wedding.
              </p>
              <p>
                Selling directly is what keeps prices honest. Without a shopfront and a
                distributor between us, the same budget buys better plating, cleaner
                settings and packaging you&apos;re proud to gift.
              </p>
              <p>
                Everything is quality-checked before it ships, insured in transit, and
                photographed clearly so what you see is what arrives.
              </p>
            </div>
          </Reveal>
        </div>

        <StaggerGroup className="mt-20 grid gap-x-10 gap-y-9 border-t border-hairline pt-12 md:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((principle) => (
            <StaggerItem key={principle.title}>
              <h2 className="font-display text-xl leading-snug text-ink">
                {principle.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{principle.body}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>

      <EditorialBand
        eyebrow="The studio"
        title="Designed in Jaipur, shipped across India"
        body={[
          "Our team works from Jaipur — picking finishes, reviewing samples and packing orders. We are a fashion jewellery brand, not a gold smithy, and we would rather say that plainly.",
          "Each piece is checked for plating colour, stone seating and clasp strength before it is boxed. If it isn’t right, it doesn’t ship.",
        ]}
        imageUrl="/placeholders/editorial-2.svg"
        href="/shop"
        linkLabel="Shop the collection"
        notes={[
          { label: "Founded", value: "2024" },
          { label: "Category", value: "Fashion" },
          { label: "Ships from", value: "Jaipur" },
        ]}
        flip
      />

      <div className="container-site py-16 text-center md:py-24">
        <Reveal>
          <p className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight text-ink">
            Questions about a piece, a size, or a look?
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">
            Write to us at {settings.supportEmail} and a person who knows the catalogue
            will reply.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/contact">Talk to us</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collections">See the collections</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
