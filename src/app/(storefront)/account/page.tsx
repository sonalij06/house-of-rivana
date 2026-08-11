import type { Metadata } from "next";
import Link from "next/link";
import { Package, Heart, MapPin, Star } from "lucide-react";
import { SignOutButton } from "@/components/account/sign-out-button";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ORDER_STATUS_COPY, type OrderStatus } from "@/lib/order-status";
import { formatDate, formatPaise } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await requireUser("/account");

  const [orders, wishlistCount, addressCount, reviewCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { placedAt: "desc" },
      take: 3,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotalPaise: true,
        placedAt: true,
        accessToken: true,
      },
    }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
    prisma.address.count({ where: { userId: user.id } }),
    prisma.review.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_18rem]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-ink">Hello, {user.name}</h1>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard href="/account/wishlist" icon={<Heart className="size-4" />} label="Wishlist" value={wishlistCount} />
          <StatCard href="/account/addresses" icon={<MapPin className="size-4" />} label="Addresses" value={addressCount} />
          <StatCard href="/account/reviews" icon={<Star className="size-4" />} label="Reviews" value={reviewCount} />
        </div>

        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-xl text-ink">Recent orders</h3>
            <Link
              href="/account/orders"
              className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
            >
              View all
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="mt-6 border border-hairline px-6 py-10 text-center">
              <Package className="mx-auto size-5 text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 font-display text-lg text-ink">No orders yet</p>
              <p className="mt-1 text-sm text-muted">
                When you place an order, it will appear here.
              </p>
              <Button asChild className="mt-5">
                <Link href="/shop">Browse the collection</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-hairline border border-hairline">
              {orders.map((order) => {
                const copy = ORDER_STATUS_COPY[order.status as OrderStatus];
                return (
                  <li key={order.id}>
                    <Link
                      href={`/order/${order.orderNumber}?t=${order.accessToken}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-cream-dark/60"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{order.orderNumber}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(order.placedAt)} · {copy.label}
                        </p>
                      </div>
                      <p className="text-sm tabular-nums text-ink">
                        {formatPaise(order.grandTotalPaise)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="border border-hairline bg-cream-dark/40 p-5 h-fit">
        <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-gold">Need help?</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Questions about sizing, care, or an existing order — write to us and a
          person will reply.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-5">
          <Link href="/contact">Contact care</Link>
        </Button>
      </aside>
    </div>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="border border-hairline bg-surface px-4 py-4 transition-colors hover:border-champagne"
    >
      <div className="flex items-center gap-2 text-muted">{icon}<span className="text-[0.6875rem] uppercase tracking-[0.14em]">{label}</span></div>
      <p className="mt-2 font-display text-2xl tabular-nums text-ink">{value}</p>
    </Link>
  );
}
