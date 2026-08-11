"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/reviews", label: "Reviews" },
];

export function AccountNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Account" className="border-b border-hairline">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "relative inline-block py-3 text-[0.6875rem] uppercase tracking-[0.16em] transition-colors",
                  active ? "text-ink" : "text-muted hover:text-gold",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-gold" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
