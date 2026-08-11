import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Prose } from "@/components/layout/prose";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/primitives";
import type { PolicyBlock } from "@/content/policies";

export const metadata: Metadata = {
  title: "Jewellery care",
  description:
    "How to clean, store and wear plated fashion jewellery with CZ and AD stones — and what shortens the life of artificial pieces.",
  alternates: { canonical: "/care-guide" },
};

const CARE: PolicyBlock[] = [
  {
    kind: "paragraph",
    text: "Artificial and fashion jewellery lasts longest when you treat plating as a finish, not as solid gold. Moisture, perfume and friction are what dull shine — not careful everyday wear.",
  },
  { kind: "heading", text: "The short version" },
  {
    kind: "list",
    items: [
      "Last on, first off. Put jewellery on after perfume, sunscreen and hairspray, and take it off before you shower or sleep.",
      "Never swim or bathe in it. Water and chlorine lift plating and cloud foil-backed stones.",
      "Store pieces separately in soft pouches so harder stones don’t scratch softer finishes.",
      "Clean with a soft dry cloth. Avoid ultrasonic machines, harsh dips and abrasive pastes.",
    ],
  },
  { kind: "heading", text: "Gold-plated & rose gold-plated" },
  {
    kind: "paragraph",
    text: "Plating is a thin decorative layer over a base metal. High-friction spots — clasps, ring insides, bracelet backs — will soften first with heavy daily wear. That is normal. Wipe after wearing, keep pieces dry, and rotate favourites so one item doesn’t take all the wear.",
  },
  { kind: "heading", text: "Silver-tone & silver-plated" },
  {
    kind: "paragraph",
    text: "Silver-tone finishes can dull or spot in humid air. A soft dry cloth usually restores the look. Store in a closed pouch. Avoid liquid silver dips on antique or oxidised pieces — they can strip the intentional darkening.",
  },
  { kind: "heading", text: "CZ, AD and glass stones" },
  {
    kind: "list",
    items: [
      "Cubic zirconia and American diamond (AD) stones wipe clean with a soft dry or barely damp cloth.",
      "Kundan-style and foil-backed glass dislike soaking — moisture behind the foil can cloud the colour.",
      "Don’t force prongs or bezels if a stone feels loose; write to us with a photo and your order number.",
      "Never use ultrasonic or steam cleaners at home on fashion jewellery.",
    ],
  },
  { kind: "heading", text: "When to contact us" },
  {
    kind: "paragraph",
    text: "If a clasp fails, a stone loosens, or something arrives not as described, send a photograph and your order number. We’ll tell you honestly whether it’s a return, an exchange, or a quick care tip.",
  },
];

export default function CareGuidePage() {
  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Longevity"
        title="Jewellery care"
        description="A short guide for plated fashion jewellery. A minute of care keeps pieces brighter for longer."
        crumbs={[{ label: "Jewellery care" }]}
      />

      <div className="mt-10">
        <Prose blocks={CARE} />
      </div>

      <div className="mt-14 border-t border-hairline pt-10">
        <Reveal distance={14}>
          <p className="font-display text-xl text-ink">
            Something needs attention?
          </p>
          <p className="mt-2 max-w-md text-sm text-muted">
            Send us a photograph and your order number and we will tell you honestly whether
            it needs a return or just a gentle wipe.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/contact">Contact us</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/policies/returns">Returns policy</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
