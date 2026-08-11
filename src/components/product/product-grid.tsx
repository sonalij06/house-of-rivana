import { ProductCard } from "@/components/product/product-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import type { ProductCardData } from "@/lib/product";
import { cn } from "@/lib/utils";

export function ProductGrid({
  products,
  wishlisted,
  columns = 4,
  priorityCount = 0,
  className,
}: {
  products: ProductCardData[];
  wishlisted?: Set<string>;
  columns?: 3 | 4;
  priorityCount?: number;
  className?: string;
}) {
  return (
    <StaggerGroup
      className={cn(
        "grid grid-cols-2 gap-x-5 gap-y-11 md:gap-x-6",
        columns === 4 ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-3",
        className,
      )}
      stagger={0.06}
      amount={0.05}
    >
      {products.map((product, i) => (
        <StaggerItem key={product.id}>
          <ProductCard
            product={product}
            priority={i < priorityCount}
            isWishlisted={wishlisted?.has(product.id)}
          />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
