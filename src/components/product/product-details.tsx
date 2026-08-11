"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DetailSection = {
  id: string;
  label: string;
  body: string | null;
  rows?: { label: string; value: string }[];
};

export function ProductDetails({ sections }: { sections: DetailSection[] }) {
  const usable = sections.filter((s) => s.body || s.rows?.length);
  const [open, setOpen] = useState<string | null>(usable[0]?.id ?? null);

  if (!usable.length) return null;

  return (
    <div className="border-t border-hairline">
      {usable.map((section) => {
        const expanded = open === section.id;
        return (
          <div key={section.id} className="border-b border-hairline">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : section.id)}
                aria-expanded={expanded}
                aria-controls={`panel-${section.id}`}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span
                  className={cn(
                    "font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-colors",
                    expanded ? "text-gold" : "text-ink",
                  )}
                >
                  {section.label}
                </span>
                <span className="shrink-0 text-muted">
                  {expanded ? (
                    <Minus className="size-3.5" strokeWidth={1.8} />
                  ) : (
                    <Plus className="size-3.5" strokeWidth={1.8} />
                  )}
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  id={`panel-${section.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="selectable pb-5 text-sm leading-relaxed text-muted">
                    {section.body
                      ? section.body
                          .split(/\n{2,}/)
                          .map((paragraph, i) => (
                            <p key={i} className={i > 0 ? "mt-3" : undefined}>
                              {paragraph}
                            </p>
                          ))
                      : null}

                    {section.rows?.length ? (
                      <dl
                        className={cn(
                          "grid grid-cols-[auto_1fr] gap-x-8 gap-y-2",
                          section.body && "mt-4",
                        )}
                      >
                        {section.rows.map((row) => (
                          <div key={row.label} className="col-span-2 grid grid-cols-subgrid">
                            <dt className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted-light">
                              {row.label}
                            </dt>
                            <dd className="text-ink">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
