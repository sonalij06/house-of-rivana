import { Reveal } from "@/components/motion/primitives";
import type { PolicyBlock } from "@/content/policies";

/** Renders structured editorial blocks with the site's typographic rhythm. */
export function Prose({ blocks }: { blocks: PolicyBlock[] }) {
  return (
    <div className="selectable max-w-2xl">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === "heading") {
          return (
            <Reveal key={key} distance={14}>
              <h2 className="mt-11 font-display text-[1.375rem] leading-snug text-ink first:mt-0">
                {block.text}
              </h2>
            </Reveal>
          );
        }

        if (block.kind === "list") {
          return (
            <Reveal key={key} distance={14}>
              <ul className="mt-4 space-y-2.5">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="relative pl-5 text-sm leading-relaxed text-muted"
                  >
                    <span
                      className="absolute left-0 top-[0.6em] size-1 rounded-full bg-champagne"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          );
        }

        return (
          <Reveal key={key} distance={14}>
            <p className="mt-4 text-sm leading-relaxed text-muted first:mt-0">
              {block.text}
            </p>
          </Reveal>
        );
      })}
    </div>
  );
}
