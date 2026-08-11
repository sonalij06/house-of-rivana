"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCollection, toggleProductFlag } from "@/app/actions/admin-catalog";
import { Checkbox } from "@/components/ui/field";
import { SafeImage } from "@/components/ui/safe-image";

export type FeatureProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
};

export function ProductFeatureList({ products }: { products: FeatureProduct[] }) {
  return (
    <div className="divide-y divide-hairline">
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 pb-2.5">
        <span className="text-[0.5625rem] uppercase tracking-[0.18em] text-muted-light">
          Piece
        </span>
        <span className="grid w-52 grid-cols-3 gap-2 text-center text-[0.5625rem] uppercase tracking-[0.12em] text-muted-light">
          <span>Featured</span>
          <span>Bestseller</span>
          <span>New in</span>
        </span>
      </div>
      {products.map((product) => (
        <ProductRow key={product.id} product={product} />
      ))}
      {products.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No live products yet.</p>
      ) : null}
    </div>
  );
}

function ProductRow({ product }: { product: FeatureProduct }) {
  const [flags, setFlags] = useState({
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    isNewArrival: product.isNewArrival,
  });
  const [isPending, startTransition] = useTransition();

  function set(flag: keyof typeof flags, value: boolean) {
    setFlags((current) => ({ ...current, [flag]: value }));
    startTransition(async () => {
      const result = await toggleProductFlag({ productId: product.id, flag, value });
      if (!result.ok) {
        setFlags((current) => ({ ...current, [flag]: !value }));
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
      <Link href={`/admin/products/${product.id}`} className="flex min-w-0 items-center gap-3">
        <span className="relative size-9 shrink-0 overflow-hidden bg-cream-dark">
          <SafeImage
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="36px"
            className="object-cover"
          />
        </span>
        <span className="truncate text-sm text-ink underline-offset-4 hover:underline">
          {product.name}
        </span>
      </Link>
      <span className="grid w-52 grid-cols-3 place-items-center gap-2">
        {(["isFeatured", "isBestseller", "isNewArrival"] as const).map((flag) => (
          <Checkbox
            key={flag}
            checked={flags[flag]}
            disabled={isPending}
            onChange={(event) => set(flag, event.target.checked)}
            aria-label={`${flag} for ${product.name}`}
          />
        ))}
      </span>
    </div>
  );
}

export type FeatureCollection = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  heroImage: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
};

export function CollectionFeatureList({
  collections,
}: {
  collections: FeatureCollection[];
}) {
  return (
    <div className="divide-y divide-hairline">
      {collections.map((collection) => (
        <CollectionRow key={collection.id} collection={collection} />
      ))}
      {collections.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No collections yet.</p>
      ) : null}
    </div>
  );
}

function CollectionRow({ collection }: { collection: FeatureCollection }) {
  const [isFeatured, setIsFeatured] = useState(collection.isFeatured);
  const [isPending, startTransition] = useTransition();

  function set(value: boolean) {
    setIsFeatured(value);
    startTransition(async () => {
      const result = await saveCollection({
        id: collection.id,
        slug: collection.slug,
        name: collection.name,
        subtitle: collection.subtitle || undefined,
        description: collection.description || undefined,
        heroImage: collection.heroImage || undefined,
        sortOrder: collection.sortOrder,
        isActive: collection.isActive,
        isFeatured: value,
        metaTitle: collection.metaTitle || undefined,
        metaDescription: collection.metaDescription || undefined,
      });
      if (!result.ok) {
        setIsFeatured(!value);
        toast.error(result.error);
      }
    });
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 py-2.5">
      <span className="relative size-9 shrink-0 overflow-hidden bg-cream-dark">
        <SafeImage
          src={collection.heroImage}
          alt={collection.name}
          fill
          sizes="36px"
          className="object-cover"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{collection.name}</span>
        {collection.subtitle ? (
          <span className="block truncate text-[0.625rem] text-muted-light">
            {collection.subtitle}
          </span>
        ) : null}
      </span>
      <Checkbox
        checked={isFeatured}
        disabled={isPending}
        onChange={(event) => set(event.target.checked)}
        aria-label={`Feature ${collection.name}`}
      />
    </label>
  );
}
