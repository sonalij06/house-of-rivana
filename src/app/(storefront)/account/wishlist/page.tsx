import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getWishlistProducts } from "@/lib/wishlist";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  await requireUser("/account/wishlist");
  const items = await getWishlistProducts();
  const products = items.map((item) => item.product);
  const wishlisted = new Set(products.map((p) => p.id));

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-5" strokeWidth={1.5} />}
        title="Your wishlist is empty"
        description="Tap the heart on any piece to save it here."
        action={
          <Button asChild>
            <Link href="/shop">Browse the collection</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Wishlist</h2>
      <p className="mt-1 text-sm text-muted">
        {products.length} {products.length === 1 ? "piece" : "pieces"} saved for later.
      </p>
      <ProductGrid products={products} wishlisted={wishlisted} className="mt-8" />
    </div>
  );
}
