import { BadgeCheck, PackageCheck, RefreshCcw, Truck } from "lucide-react";
import { StaggerGroup, StaggerItem } from "@/components/motion/primitives";

const PROMISES = [
  {
    icon: BadgeCheck,
    title: "Quality checked",
    body: "Every piece is inspected for plating, stone seating and clasp strength before it ships.",
  },
  {
    icon: Truck,
    title: "Insured delivery",
    body: "Fully insured, signature-required courier anywhere in India. Free above ₹2,500.",
  },
  {
    icon: RefreshCcw,
    title: "Easy size exchange",
    body: "Need a different size in the same design? We’ll help you exchange within fifteen days.",
  },
  {
    icon: PackageCheck,
    title: "15-day returns",
    body: "Unworn pieces with tags intact can go back within fifteen days, no fuss.",
  },
];

export function PromiseStrip() {
  return (
    <section className="border-y border-hairline bg-surface">
      <StaggerGroup
        className="container-site grid gap-x-8 gap-y-9 py-12 sm:grid-cols-2 lg:grid-cols-4"
        stagger={0.09}
      >
        {PROMISES.map((promise) => (
          <StaggerItem key={promise.title} className="flex gap-4">
            <promise.icon
              className="mt-0.5 size-5 shrink-0 text-gold"
              strokeWidth={1.5}
            />
            <div>
              <p className="text-[0.8125rem] font-medium uppercase tracking-[0.1em] text-ink">
                {promise.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {promise.body}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
