import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { getAllCollections } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

const HELP_LINKS = [
  { href: "/policies/shipping", label: "Shipping" },
  { href: "/policies/returns", label: "Returns & Exchanges" },
  { href: "/size-guide", label: "Size Guide" },
  { href: "/care-guide", label: "Jewellery Care" },
  { href: "/contact", label: "Contact Us" },
];

const HOUSE_LINKS = [
  { href: "/about", label: "Our Story" },
  { href: "/shop", label: "Shop All" },
  { href: "/collections", label: "Collections" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
];

export async function SiteFooter() {
  const [settings, collections] = await Promise.all([
    getSettings(),
    getAllCollections(),
  ]);

  return (
    <footer className="mt-24 border-t border-hairline bg-surface">
      <div className="container-site py-14">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo size={64} />
            <p className="mt-5 font-display text-lg tracking-[0.12em] text-ink">
              HOUSE OF RIVANA
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              {settings.tagline}. Artificial fashion jewellery from Jaipur —
              plated finishes, CZ and AD stones, shipped insured across India.
            </p>

            <div className="mt-6 space-y-2.5 text-sm text-muted">
              {settings.supportEmail ? (
                <a
                  href={`mailto:${settings.supportEmail}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-gold"
                >
                  <Mail className="size-3.5 shrink-0" />
                  {settings.supportEmail}
                </a>
              ) : null}
              {settings.supportPhone ? (
                <a
                  href={`tel:${settings.supportPhone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-gold"
                >
                  <Phone className="size-3.5 shrink-0" />
                  {settings.supportPhone}
                </a>
              ) : null}
              {settings.addressText ? (
                <p className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span>{settings.addressText}</span>
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex items-center gap-3">
              {settings.instagramUrl ? (
                <SocialLink href={settings.instagramUrl} label="Instagram">
                  <Instagram className="size-4" />
                </SocialLink>
              ) : null}
              {settings.facebookUrl ? (
                <SocialLink href={settings.facebookUrl} label="Facebook">
                  <Facebook className="size-4" />
                </SocialLink>
              ) : null}
            </div>
          </div>

          <FooterColumn title="Collections">
            {collections.slice(0, 6).map((c) => (
              <FooterLink key={c.slug} href={`/collections/${c.slug}`}>
                {c.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Help">
            {HELP_LINKS.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="The House">
            {HOUSE_LINKS.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>
        </div>

        <div className="mt-14 grid gap-8 border-t border-hairline pt-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-md">
            <p className="eyebrow">Join the list</p>
            <p className="mt-2 text-sm text-muted">
              First look at new pieces and restocks. Two emails a month, never more.
            </p>
            <NewsletterForm className="mt-4" />
          </div>

          <div className="text-sm text-muted lg:text-right">
            <p className="eyebrow mb-2">Payment</p>
            <p>UPI · Google Pay · PhonePe · Paytm · BHIM</p>
            <p className="mt-1 text-xs text-muted-light">
              All prices in INR, inclusive of GST.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-6 text-xs text-muted-light">
          <p>
            &copy; {new Date().getFullYear()} {settings.brandName}. All rights
            reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <p>Ships from Jaipur, India.</p>
            <Link
              href="/admin/login"
              className="text-[0.625rem] uppercase tracking-[0.16em] text-muted-light/80 transition-colors hover:text-muted"
            >
              Staff
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted transition-colors hover:text-gold"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-xs border border-hairline text-muted transition-colors hover:border-champagne hover:text-gold"
    >
      {children}
    </a>
  );
}
