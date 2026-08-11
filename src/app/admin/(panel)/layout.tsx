import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s · Rivana Ops" },
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware guards this too, but a layout check is the boundary that matters.
  const user = await requireStaff();
  const settings = await getSettings();

  const [paymentsToReview, reviewsPending, lowStock] = await Promise.all([
    prisma.payment.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.productVariant.count({
      where: {
        isActive: true,
        stockQty: { lte: settings.lowStockAlertThreshold },
      },
    }),
  ]);

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, role: user.role }}
      badges={{ paymentsToReview, reviewsPending, lowStock }}
    >
      {children}
    </AdminShell>
  );
}
