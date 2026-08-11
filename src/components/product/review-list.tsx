import { BadgeCheck } from "lucide-react";
import { Rating } from "@/components/ui/rating";
import { SafeImage } from "@/components/ui/safe-image";
import { Reveal } from "@/components/motion/primitives";
import { formatDate } from "@/lib/utils";

export type ReviewItem = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  imageUrls: string[];
  isVerifiedPurchase: boolean;
  createdAt: Date;
};

export function ReviewList({
  reviews,
  ratingAverage,
  ratingCount,
  children,
}: {
  reviews: ReviewItem[];
  ratingAverage: number;
  ratingCount: number;
  /** Slot for the write-a-review control, which needs session context. */
  children?: React.ReactNode;
}) {
  const histogram = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const sampled = reviews.length || 1;

  return (
    <section id="reviews" className="scroll-mt-28 border-t border-hairline pt-14">
      <div className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-16">
        <div>
          <h2 className="font-display text-[1.75rem] leading-tight text-ink">
            What owners say
          </h2>

          {ratingCount > 0 ? (
            <>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="font-display text-[2.75rem] leading-none text-ink">
                  {ratingAverage.toFixed(1)}
                </span>
                <div>
                  <Rating value={ratingAverage} size="md" />
                  <p className="mt-1 text-xs text-muted">
                    {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>

              <ul className="mt-6 space-y-1.5">
                {histogram.map((row) => (
                  <li key={row.star} className="flex items-center gap-2.5 text-xs">
                    <span className="w-3 tabular-nums text-muted">{row.star}</span>
                    <span className="h-1 flex-1 overflow-hidden bg-cream-dark">
                      <span
                        className="block h-full bg-gold"
                        style={{ width: `${(row.count / sampled) * 100}%` }}
                      />
                    </span>
                    <span className="w-4 text-right tabular-nums text-muted-light">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              No reviews yet. If you own this piece, yours would be the first.
            </p>
          )}

          {children ? <div className="mt-7">{children}</div> : null}
        </div>

        <div>
          {reviews.length ? (
            <ul className="divide-y divide-hairline">
              {reviews.map((review, index) => (
                <li key={review.id} className={index === 0 ? "pb-7" : "py-7"}>
                  <Reveal delay={Math.min(index, 4) * 0.05} distance={16}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Rating value={review.rating} />
                      <span className="text-sm font-medium text-ink">
                        {review.authorName}
                      </span>
                      {review.isVerifiedPurchase ? (
                        <span className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-[0.12em] text-success">
                          <BadgeCheck className="size-3.5" strokeWidth={1.7} />
                          Verified
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-light">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>

                    {review.title ? (
                      <p className="mt-2.5 font-display text-lg leading-snug text-ink">
                        {review.title}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{review.body}</p>

                    {review.imageUrls.length ? (
                      <div className="mt-4 flex gap-2.5">
                        {review.imageUrls.slice(0, 4).map((url) => (
                          <div
                            key={url}
                            className="relative size-16 overflow-hidden bg-cream-dark"
                          >
                            <SafeImage
                              src={url}
                              alt={`Photo from ${review.authorName}`}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Reveal>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
