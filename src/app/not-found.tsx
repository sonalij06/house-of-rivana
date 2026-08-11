import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-gold">404</p>
      <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
        This page has been put away
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        The link may be old, or the piece may have sold out and been retired. The
        collection is still here.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/shop">Shop the collection</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
