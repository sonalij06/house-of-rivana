import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Panel } from "@/components/admin/primitives";
import { ReviewCard } from "@/components/admin/review-moderator";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { key: "PENDING", label: "Awaiting review" },
  { key: "APPROVED", label: "Published" },
  { key: "REJECTED", label: "Rejected" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff("/admin/reviews");
  const { status = "PENDING" } = await searchParams;
  const active = TABS.some((tab) => tab.key === status) ? status : "PENDING";

  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({
      where: { status: active as "PENDING" | "APPROVED" | "REJECTED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        authorName: true,
        imageUrls: true,
        status: true,
        isVerifiedPurchase: true,
        moderationNote: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
        order: { select: { orderNumber: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = new Map(counts.map((row) => [row.status as string, row._count._all]));

  return (
    <>
      <AdminHeader
        title="Reviews"
        description="Nothing appears on a product page until it is published here. Ratings recompute on every decision."
      />

      <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/reviews?status=${tab.key}`}
            className={
              tab.key === active
                ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
                : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
            }
          >
            {tab.label}
            <span
              className={
                tab.key === active ? "ml-1.5 text-champagne" : "ml-1.5 text-muted-light"
              }
            >
              {countByStatus.get(tab.key) ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <Panel>
          <p className="py-10 text-center text-sm text-muted">
            {active === "PENDING"
              ? "The queue is clear."
              : "Nothing in this state yet."}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={{
                id: review.id,
                rating: review.rating,
                title: review.title,
                body: review.body,
                authorName: review.authorName,
                imageUrls: review.imageUrls,
                status: review.status,
                isVerifiedPurchase: review.isVerifiedPurchase,
                moderationNote: review.moderationNote,
                createdAt: review.createdAt,
                product: review.product,
                orderNumber: review.order?.orderNumber ?? null,
                userEmail: review.user?.email ?? null,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
