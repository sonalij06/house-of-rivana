"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Heart, Menu, Search, Shield, ShoppingBag, User, X } from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand/logo";
import { SearchOverlay } from "@/components/layout/search-overlay";

type NavCollection = {
  slug: string;
  name: string;
  subtitle: string | null;
  count: number;
};

const PRIMARY_LINKS = [
  { href: "/shop", label: "Shop All" },
  { href: "/collections", label: "Collections" },
  { href: "/about", label: "The House" },
  { href: "/contact", label: "Contact" },
];

const iconBtn =
  "inline-flex size-10 items-center justify-center text-ink transition-[color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30";

export function HeaderShell({
  collections,
  cartCount,
  user,
}: {
  collections: NavCollection[];
  cartCount: number;
  user: { name: string; role: string; email: string } | null;
}) {
  const pathname = usePathname() ?? "/";
  const [condensed, setCondensed] = useState(false);
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const menuOpen = menu.open && menu.path === pathname;
  const { openCart, bumpToken, searchOpen, setSearchOpen } = useUIStore();
  const { scrollY } = useScroll();
  const isStaff = user?.role === "ADMIN" || user?.role === "STAFF";

  useMotionValueEvent(scrollY, "change", (value) => {
    setCondensed((prev) => (prev ? value > 40 : value > 90));
  });

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);

  const logoSize = condensed ? 56 : 72;

  return (
    <>
      <motion.header
        className={cn(
          "sticky top-0 z-40 border-b bg-cream/90 backdrop-blur-md transition-[border-color,box-shadow] duration-500",
          condensed
            ? "border-hairline shadow-[0_1px_20px_rgb(26_26_26/0.05)]"
            : "border-transparent",
        )}
      >
        <div className="container-site relative">
          <motion.div
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 lg:grid-cols-[1fr_auto_1fr]"
            animate={{
              paddingTop: condensed ? 12 : 18,
              paddingBottom: condensed ? 12 : 18,
            }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Left: menu + brand lockup */}
            <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
              <button
                type="button"
                onClick={() => setMenu({ open: true, path: pathname })}
                className={cn(iconBtn, "-ml-1 lg:hidden")}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>

              <motion.div
                className="min-w-0"
                animate={{ scale: condensed ? 0.94 : 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <BrandLockup
                  size={logoSize}
                  priority
                  className="max-[380px]:[&>span:last-child]:hidden"
                />
              </motion.div>
            </div>

            {/* Center: primary nav */}
            <nav
              className="hidden items-center justify-center gap-7 justify-self-center xl:gap-9 lg:flex"
              aria-label="Primary"
            >
              {PRIMARY_LINKS.map((link) => {
                const active =
                  link.href === "/shop"
                    ? pathname === "/shop" || pathname.startsWith("/product/")
                    : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                const isCollections = link.href === "/collections";

                const linkClass = cn(
                  "group/nav relative whitespace-nowrap pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-[color,letter-spacing] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:tracking-[0.2em]",
                  active ? "text-gold" : "text-ink hover:text-gold",
                );

                if (isCollections) {
                  return (
                    <div key={link.href} className="group relative">
                      <Link href={link.href} data-active={active} className={linkClass}>
                        {link.label}
                        <NavHoverLine active={active} />
                      </Link>
                      <CollectionsMegaMenu collections={collections} />
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-active={active}
                    className={linkClass}
                  >
                    {link.label}
                    <NavHoverLine active={active} />
                  </Link>
                );
              })}
            </nav>

            {/* Right: utilities */}
            <div className="flex items-center justify-end justify-self-end gap-0.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={iconBtn}
                aria-label="Search"
              >
                <Search className="size-[1.15rem]" strokeWidth={1.6} />
              </button>

              <Link
                href="/account/wishlist"
                className={cn(iconBtn, "hidden sm:inline-flex")}
                aria-label="Wishlist"
              >
                <Heart className="size-[1.15rem]" strokeWidth={1.6} />
              </Link>

              <Link
                href={user ? "/account" : "/login"}
                className={cn(iconBtn, "hidden sm:inline-flex")}
                aria-label={user ? "Your account" : "Sign in"}
              >
                <User className="size-[1.15rem]" strokeWidth={1.6} />
              </Link>

              {/* Staff only — never compete with bag/account for shoppers */}
              {isStaff ? (
                <Link
                  href="/admin"
                  className={cn(iconBtn, "hidden text-muted hover:text-gold sm:inline-flex")}
                  aria-label="Open operations"
                  title="Operations"
                >
                  <Shield className="size-[1.1rem]" strokeWidth={1.6} />
                </Link>
              ) : null}

              <button
                type="button"
                onClick={openCart}
                className={cn(iconBtn, "relative")}
                aria-label={`Shopping bag, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              >
                <ShoppingBag className="size-[1.15rem]" strokeWidth={1.6} />
                <AnimatePresence>
                  {cartCount > 0 ? (
                    <motion.span
                      key={`${cartCount}-${bumpToken}`}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-gold text-[0.5625rem] font-semibold text-cream"
                    >
                      {cartCount > 9 ? "9+" : cartCount}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen ? (
          <MobileNav
            collections={collections}
            user={user}
            onClose={() => setMenu({ open: false, path: pathname })}
          />
        ) : null}
      </AnimatePresence>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavHoverLine({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "absolute inset-x-0 -bottom-0.5 h-px origin-left bg-gold transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        active
          ? "scale-x-100"
          : "scale-x-0 group-hover/nav:scale-x-100 group-focus-visible/nav:scale-x-100",
      )}
      aria-hidden
    />
  );
}

function CollectionsMegaMenu({ collections }: { collections: NavCollection[] }) {
  return (
    <div className="pointer-events-none absolute left-0 top-full z-50 w-[34rem] pt-5 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      <div className="border border-hairline bg-cream/97 p-6 shadow-panel backdrop-blur-md">
        <div className="flex items-end justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <p className="text-[0.625rem] uppercase tracking-[0.18em] text-gold">
              Explore
            </p>
            <p className="mt-1 font-display text-xl text-ink">Collections</p>
          </div>
          <Link
            href="/collections"
            className="text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
          >
            View all
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
          {collections.map((collection) => (
            <li key={collection.slug}>
              <Link
                href={`/collections/${collection.slug}`}
                className="group/item block py-1.5"
              >
                <span className="block text-sm text-ink transition-colors group-hover/item:text-gold">
                  {collection.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-light">
                  {collection.subtitle ?? `${collection.count} pieces`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/shop"
          className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-[0.6875rem] uppercase tracking-[0.14em] text-ink transition-colors hover:text-gold"
        >
          Shop the full catalogue
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

function MobileNav({
  collections,
  user,
  onClose,
}: {
  collections: NavCollection[];
  user: { name: string; role?: string } | null;
  onClose: () => void;
}) {
  const isStaff = user?.role === "ADMIN" || user?.role === "STAFF";

  return (
    <motion.div
      className="fixed inset-0 z-50 lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close menu"
      />
      <motion.nav
        className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col border-r border-hairline bg-cream"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <BrandLockup size={56} href="/" onClick={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted transition-colors hover:text-ink"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <ul className="space-y-1">
            {PRIMARY_LINKS.map((link, i) => (
              <motion.li
                key={link.href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.4 }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block py-2.5 font-display text-2xl text-ink transition-[color,transform] duration-300 hover:translate-x-1 hover:text-gold"
                >
                  {link.label}
                </Link>
              </motion.li>
            ))}
          </ul>

          <p className="eyebrow mt-8 mb-3">Collections</p>
          <ul className="space-y-2 border-t border-hairline pt-4">
            {collections.map((c, i) => (
              <motion.li
                key={c.slug}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.24 + i * 0.04, duration: 0.4 }}
              >
                <Link
                  href={`/collections/${c.slug}`}
                  onClick={onClose}
                  className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-gold"
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-light">{c.count}</span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 border-t border-hairline px-5 py-4">
          <Link
            href={user ? "/account" : "/login"}
            onClick={onClose}
            className="flex items-center gap-2.5 py-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink"
          >
            <User className="size-4" />
            {user ? user.name : "Sign in"}
          </Link>
          {isStaff ? (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-2.5 py-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
            >
              <Shield className="size-4" />
              Operations
            </Link>
          ) : (
            <Link
              href="/admin/login"
              onClick={onClose}
              className="block py-2 text-[0.6875rem] uppercase tracking-[0.12em] text-muted-light transition-colors hover:text-muted"
            >
              Staff login
            </Link>
          )}
        </div>
      </motion.nav>
    </motion.div>
  );
}
