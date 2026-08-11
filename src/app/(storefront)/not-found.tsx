import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Storefront-scoped so a missing product still shows the header, footer and
 * navigation rather than dumping the visitor onto a bare page.
 */
export default function StorefrontNotFound() {
  return (
    <div className="container-site py-24">
      <EmptyState
        title="This page has been put away"
        description="The link may be old, or the piece may have sold out and been retired. The collection is still here."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/shop">Shop the collection</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collections">Browse collections</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
