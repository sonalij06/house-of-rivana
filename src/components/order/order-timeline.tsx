import { formatDate } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
};

/** Append-only audit trail, newest last so it reads like a story. */
export function OrderTimeline({ entries }: { entries: TimelineItem[] }) {
  if (entries.length === 0) return null;

  return (
    <ol className="relative space-y-5 border-l border-hairline pl-5">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative">
          <span
            className={
              index === entries.length - 1
                ? "absolute -left-[1.4375rem] top-1.5 size-2 rounded-full bg-gold"
                : "absolute -left-[1.375rem] top-2 size-1.5 rounded-full bg-muted-light"
            }
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-ink">{entry.message}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-light">
            {formatDate(entry.createdAt, true)}
          </p>
        </li>
      ))}
    </ol>
  );
}
