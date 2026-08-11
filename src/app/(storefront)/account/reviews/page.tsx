import type { Metadata } from "next";
import Link from "next/link";
import { ReviewForm } from "@/components/account/review-form";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default async function AccountReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const user = await requireUser("/account/reviews");
  const { product: productSlug } = await searchParams;

  const [deliveredOrders, existingReviews] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id, status: "DELIVERED" },
      orderBy: { placedAt: "desc" },
      include: {
        items: {
          select: {
            productId: true,
            productName: true,
            productSlug: true,
          },
        },
      },
    }),
    prisma.review.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { slug: true, name: true } },
      },
    }),
  ]);

  const reviewedKeys = new Set(
    existingReviews.map((r) => `${r.orderId}:${r.productId}`),
  );

  const pieces = deliveredOrders.flatMap((order) => {
    const seen = new Set<string>();
    return order.items
      .filter((item) => {
        if (!item.productId || seen.has(item.productId)) return false;
        seen.add(item.productId);
        return true;
      })
      .map((item) => ({
        productId: item.productId!,
        productName: item.productName,
        productSlug: item.productSlug,
        orderId: order.id,
        orderNumber: order.orderNumber,
        alreadyReviewed: reviewedKeys.has(`${order.id}:${item.productId}`),
      }));
  });

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <div>
        <h2 className="font-display text-2xl text-ink">Your reviews</h2>
        <p className="mt-1 text-sm text-muted">
          Verified reviews from delivered orders. New submissions are checked
          before they appear on the product page.
        </p>

        {existingReviews.length === 0 ? (
          <p className="mt-8 text-sm text-muted">You have not submitted a review yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-hairline border border-hairline">
            {existingReviews.map((review) => (
              <li key={review.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Rating value={review.rating} />
                  <Badge
                    tone={
                      review.status === "APPROVED"
                        ? "success"
                        : review.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {review.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-ink">
                  <Link
                    href={`/product/${review.product.slug}`}
                    className="hover:text-gold"
                  >
                    {review.product.name}
                  </Link>
                </p>
                {review.title ? (
                  <p className="mt-1 font-display text-lg text-ink">{review.title}</p>
                ) : null}
                <p className="mt-1 text-sm leading-relaxed text-muted">{review.body}</p>
                <p className="mt-2 text-xs text-muted-light">
                  {formatDate(review.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <ReviewForm pieces={pieces} initialProductSlug={productSlug} />
      </div>
    </div>
  );
}
