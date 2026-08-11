import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { SafeImage } from "@/components/ui/safe-image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-ui grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo size={44} />
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3" />
            Keep shopping
          </Link>
        </header>

        <main
          id="main"
          className="flex flex-1 items-center justify-center py-12"
        >
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="text-xs text-muted-light">
          <p>
            By continuing you agree to our{" "}
            <Link href="/policies/terms" className="underline hover:text-ink">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/policies/privacy" className="underline hover:text-ink">
              privacy policy
            </Link>
            .
          </p>
        </footer>
      </div>

      {/* Decorative panel; hidden on small screens where it would only push the form down. */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <SafeImage
          src="/placeholders/hero-2.svg"
          alt=""
          fill
          sizes="55vw"
          className="scale-105 object-cover"
          aria-hidden
        />
        <div className="scrim-strong absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-14">
          <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-champagne">
            Members
          </p>
          <p className="mt-4 max-w-md font-display text-4xl leading-tight text-cream">
            Track every order, save what you love, and skip the address form next
            time.
          </p>
        </div>
      </div>
    </div>
  );
}
