"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { ADMIN_NAV } from "@/components/admin/nav";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export type AdminBadges = {
  paymentsToReview: number;
  reviewsPending: number;
  lowStock: number;
};

/**
 * Dark rail, light workspace. The admin is deliberately denser and flatter than
 * the storefront: no reveal animations, no smooth scroll, information first.
 */
export function AdminShell({
  children,
  user,
  badges,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
  badges: AdminBadges;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-ink-soft bg-ink lg:block">
        <div className="sticky top-0 flex h-dvh flex-col overflow-hidden">
          <Rail user={user} badges={badges} />
        </div>
      </aside>

      <div className="flex items-center justify-between border-b border-hairline bg-ink px-4 py-3 lg:hidden">
        <Link href="/admin" className="font-display text-sm tracking-[0.16em] text-cream">
          RIVANA OPS
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open the admin menu"
          className="text-cream"
        >
          <Menu className="size-5" strokeWidth={1.6} />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 bg-ink lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close the admin menu"
                className="absolute right-3 top-3 text-cream/60 hover:text-cream"
              >
                <X className="size-4" />
              </button>
              <div className="flex h-full flex-col overflow-hidden">
                <Rail
                  user={user}
                  badges={badges}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0 px-5 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

function Rail({
  user,
  badges,
  onNavigate,
}: {
  user: { name: string; email: string; role: string };
  badges: AdminBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <div className="shrink-0 border-b border-ink-soft px-5 py-5">
        <BrandLogo
          href="/admin"
          size={48}
          framed={false}
          className="ring-1 ring-cream/15"
        />
        <p className="mt-3 text-[0.5625rem] uppercase tracking-[0.2em] text-champagne">
          Operations
        </p>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        data-lenis-prevent
      >
        {ADMIN_NAV.map((group) => {
          const items = group.items.filter((item) => isAdmin || !item.adminOnly);
          if (items.length === 0) return null;

          return (
            <div key={group.label} className="mb-5">
              <p className="px-2 pb-2 text-[0.5625rem] uppercase tracking-[0.18em] text-cream/35">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  const count = item.badge ? badges[item.badge] : 0;
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-xs px-2 py-2 text-[0.8125rem] transition-colors",
                          active
                            ? "bg-cream/10 text-cream"
                            : "text-cream/60 hover:bg-cream/5 hover:text-cream",
                        )}
                      >
                        {active ? (
                          <motion.span
                            layoutId="admin-active"
                            className="absolute inset-y-1 left-0 w-0.5 bg-champagne"
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          />
                        ) : null}
                        <Icon className="size-4 shrink-0" strokeWidth={1.6} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 ? (
                          <span className="shrink-0 rounded-full bg-champagne px-1.5 py-px text-[0.625rem] font-medium tabular-nums text-ink">
                            {count > 99 ? "99+" : count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-ink-soft px-5 py-4">
        <p className="truncate text-xs text-cream">{user.name}</p>
        <p className="truncate text-[0.625rem] text-cream/40">{user.email}</p>
        <div className="mt-3 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-[0.12em] text-cream/50 transition-colors hover:text-champagne"
          >
            <ExternalLink className="size-3" />
            Storefront
          </Link>
          <button
            type="button"
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.replace("/admin/login");
                    // The rail is rendered inside a server layout that read the
                    // session, so the tree has to be refetched to clear it.
                    router.refresh();
                  },
                },
              })
            }
            className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-[0.12em] text-cream/50 transition-colors hover:text-danger"
          >
            <LogOut className="size-3" />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
