import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/primitives";

export const metadata: Metadata = {
  title: "Size guide",
  description:
    "Indian ring sizes with their diameter and circumference, plus chain, bangle and earring measurements — and how to measure at home without a gauge.",
  alternates: { canonical: "/size-guide" },
};

/** Indian ring sizes 6–26 — the range we stock without a special order. */
const RING_SIZES = [
  { size: 6, diameter: 14.0, circumference: 44.0, us: "3" },
  { size: 8, diameter: 14.8, circumference: 46.5, us: "4" },
  { size: 10, diameter: 15.6, circumference: 49.0, us: "5" },
  { size: 12, diameter: 16.4, circumference: 51.5, us: "6" },
  { size: 14, diameter: 17.2, circumference: 54.0, us: "7" },
  { size: 16, diameter: 18.0, circumference: 56.6, us: "8" },
  { size: 18, diameter: 18.8, circumference: 59.1, us: "9" },
  { size: 20, diameter: 19.6, circumference: 61.6, us: "10" },
  { size: 22, diameter: 20.4, circumference: 64.1, us: "11" },
  { size: 24, diameter: 21.2, circumference: 66.6, us: "12" },
  { size: 26, diameter: 22.0, circumference: 69.1, us: "13" },
];

const CHAIN_LENGTHS = [
  { length: "14 in / 36 cm", sits: "Choker — at the base of the neck" },
  { length: "16 in / 41 cm", sits: "Collarbone" },
  { length: "18 in / 46 cm", sits: "Just below the collarbone — our most-worn length" },
  { length: "20 in / 51 cm", sits: "A few centimetres above the neckline" },
  { length: "22 in / 56 cm", sits: "Over a shirt or kurta" },
  { length: "24 in / 61 cm", sits: "Mid-chest, good for a pendant with weight" },
];

const METHODS = [
  {
    title: "The thread method",
    body: "Wrap a strip of paper or a non-stretch thread around the base of the finger, mark where it overlaps, and measure the length in millimetres. Match that number to the circumference column below.",
  },
  {
    title: "Measure a ring you own",
    body: "Place a ring that fits on a ruler and measure the inside edge to inside edge, straight across. That is the diameter — match it to the table.",
  },
  {
    title: "Time of day matters",
    body: "Fingers are smallest in the morning and after cold weather, and largest in the evening and in the heat. Measure late in the day, at room temperature, and go with the larger reading.",
  },
  {
    title: "Wide bands run tight",
    body: "A band above 4mm sits on more of the finger and feels snugger. For wide bands, take the next size up.",
  },
];

export default function SizeGuidePage() {
  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Fit"
        title="Size guide"
        description="Every ring is made to an Indian size. If you are between two sizes, or unsure, write to us before ordering — resizing a set ring is far harder than making it right the first time."
        crumbs={[{ label: "Size guide" }]}
      />

      <StaggerGroup className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {METHODS.map((method) => (
          <StaggerItem key={method.title}>
            <h2 className="font-display text-xl leading-snug text-ink">{method.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{method.body}</p>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <section className="mt-16">
        <Reveal distance={14}>
          <h2 className="font-display text-[1.5rem] text-ink">Ring sizes</h2>
        </Reveal>
        <Reveal distance={14} delay={0.06}>
          <div className="mt-5 overflow-x-auto border border-hairline">
            <table className="w-full min-w-lg border-collapse text-sm">
              <caption className="sr-only">
                Indian ring sizes with inner diameter, circumference and US equivalent
              </caption>
              <thead>
                <tr className="border-b border-hairline bg-cream-dark/60">
                  <Th>Indian size</Th>
                  <Th>Diameter</Th>
                  <Th>Circumference</Th>
                  <Th>US equivalent</Th>
                </tr>
              </thead>
              <tbody>
                {RING_SIZES.map((row) => (
                  <tr key={row.size} className="border-b border-hairline last:border-0">
                    <Td className="font-medium text-ink">{row.size}</Td>
                    <Td>{row.diameter.toFixed(1)} mm</Td>
                    <Td>{row.circumference.toFixed(1)} mm</Td>
                    <Td>{row.us}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="mt-3 text-xs text-muted">
          Sizes outside 6–26 are made to order and cannot be returned, as they cannot be
          resold.
        </p>
      </section>

      <section className="mt-16">
        <Reveal distance={14}>
          <h2 className="font-display text-[1.5rem] text-ink">Chain lengths</h2>
        </Reveal>
        <Reveal distance={14} delay={0.06}>
          <div className="mt-5 overflow-x-auto border border-hairline">
            <table className="w-full min-w-md border-collapse text-sm">
              <caption className="sr-only">Chain lengths and where each one sits</caption>
              <thead>
                <tr className="border-b border-hairline bg-cream-dark/60">
                  <Th>Length</Th>
                  <Th>Where it sits</Th>
                </tr>
              </thead>
              <tbody>
                {CHAIN_LENGTHS.map((row) => (
                  <tr key={row.length} className="border-b border-hairline last:border-0">
                    <Td className="whitespace-nowrap font-medium text-ink">{row.length}</Td>
                    <Td>{row.sits}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="mt-16 border-t border-hairline pt-10">
        <Reveal distance={14}>
          <h2 className="font-display text-[1.5rem] text-ink">Bangles and bracelets</h2>
        </Reveal>
        <Reveal distance={14} delay={0.06}>
          <div className="mt-4 max-w-2xl space-y-4 text-sm leading-relaxed text-muted">
            <p>
              For a bangle, measure the widest part of your hand with the thumb tucked in
              towards the palm, then match that circumference: 2.4 (about 62mm inner
              diameter) suits most, 2.6 (66mm) for a wider hand.
            </p>
            <p>
              For a chain bracelet, measure your wrist snugly and add 1.5cm for a comfortable
              drape, or 1cm if you prefer it close to the skin. Our tennis bracelets ship at
              17cm with two spare links included.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-[0.625rem] font-medium uppercase tracking-[0.14em] text-muted"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 tabular-nums text-muted ${className ?? ""}`}>{children}</td>;
}
