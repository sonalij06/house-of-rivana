import Link from "next/link";
import { getCartCount, getCartSnapshot } from "@/lib/cart";
import { getAllCollections } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { HeaderShell } from "@/components/layout/header-shell";
import { CartDrawer } from "@/components/cart/cart-drawer";

export async function SiteHeader() {
  const [settings, collections, user, cartCount, snapshot] = await Promise.all([
    getSettings(),
    getAllCollections(),
    getCurrentUser(),
    getCartCount(),
    getCartSnapshot(),
  ]);

  const navCollections = collections.slice(0, 6).map((c) => ({
    slug: c.slug,
    name: c.name,
    subtitle: c.subtitle,
    count: c._count.products,
  }));

  return (
    <>
      {settings.announcementEnabled && settings.announcementText ? (
        <AnnouncementBar text={settings.announcementText} />
      ) : null}

      <HeaderShell
        collections={navCollections}
        cartCount={cartCount}
        user={
          user
            ? { name: user.name, role: user.role, email: user.email }
            : null
        }
      />

      <CartDrawer snapshot={snapshot} />

      {/* Skip link target for keyboard users. */}
      <Link
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-xs focus:bg-ink focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </Link>
    </>
  );
}
