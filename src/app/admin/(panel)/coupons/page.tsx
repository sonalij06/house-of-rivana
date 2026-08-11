import type { Metadata } from "next";
import { AdminHeader, StatCard } from "@/components/admin/primitives";
import { CouponManager } from "@/components/admin/coupon-manager";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  await requireStaff("/admin/coupons");

  const [coupons, redemptions] = await Promise.all([
    prisma.coupon.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
    prisma.couponRedemption.groupBy({
      by: ["couponId"],
      _sum: { discountPaise: true },
    }),
  ]);

  const discountByCoupon = new Map(
    redemptions.map((row) => [row.couponId, row._sum.discountPaise ?? 0]),
  );
  const totalGiven = redemptions.reduce((sum, row) => sum + (row._sum.discountPaise ?? 0), 0);
  const liveCount = coupons.filter(
    (coupon) =>
      coupon.isActive && (!coupon.endsAt || new Date(coupon.endsAt) > new Date()),
  ).length;

  return (
    <>
      <AdminHeader
        title="Coupons"
        description="Discounts are validated server-side at checkout — the code here only sets the rules."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Live codes" value={String(liveCount)} hint={`${coupons.length} total`} />
        <StatCard
          label="Discount given"
          value={formatPaise(totalGiven)}
          hint="Across all orders"
          tone="gold"
        />
        <StatCard
          label="Redemptions"
          value={String(coupons.reduce((sum, coupon) => sum + coupon.usedCount, 0))}
        />
      </div>

      <CouponManager
        coupons={coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          minSubtotalPaise: coupon.minSubtotalPaise,
          maxDiscountPaise: coupon.maxDiscountPaise,
          startsAt: coupon.startsAt,
          endsAt: coupon.endsAt,
          usageLimit: coupon.usageLimit,
          usageLimitPerUser: coupon.usageLimitPerUser,
          usedCount: coupon.usedCount,
          isActive: coupon.isActive,
          discountedPaise: discountByCoupon.get(coupon.id) ?? 0,
        }))}
      />
    </>
  );
}
