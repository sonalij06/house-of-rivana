"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProduct, saveProduct } from "@/app/actions/admin-catalog";
import { Panel } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { METAL_LABELS } from "@/lib/product";
import { cn } from "@/lib/utils";

export type ProductFormValues = {
  id?: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  story: string;
  metal: string;
  purity: string;
  gemstone: string;
  weightGrams: number | null;
  dimensions: string;
  careInstructions: string;
  basePriceRupees: number;
  compareAtRupees: number | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
  madeToOrderDays: number | null;
  metaTitle: string;
  metaDescription: string;
  collectionIds: string[];
};

export function ProductForm({
  initial,
  collections,
  hasOrders,
}: {
  initial: ProductFormValues;
  collections: { id: string; name: string }[];
  hasOrders: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initial.status);
  const [flags, setFlags] = useState({
    isFeatured: initial.isFeatured,
    isBestseller: initial.isBestseller,
    isNewArrival: initial.isNewArrival,
  });
  const [collectionIds, setCollectionIds] = useState(initial.collectionIds);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [slug, setSlug] = useState(initial.slug);
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const optionalNumber = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      return raw === "" ? undefined : Number(raw);
    };

    startTransition(async () => {
      const result = await saveProduct({
        id: initial.id,
        slug,
        name: text("name"),
        shortDescription: text("shortDescription") || undefined,
        description: text("description"),
        story: text("story") || undefined,
        metal: text("metal"),
        purity: text("purity") || undefined,
        gemstone: text("gemstone") || undefined,
        weightGrams: optionalNumber("weightGrams"),
        dimensions: text("dimensions") || undefined,
        careInstructions: text("careInstructions") || undefined,
        basePriceRupees: Number(form.get("basePriceRupees") ?? 0),
        compareAtRupees: optionalNumber("compareAtRupees"),
        status,
        ...flags,
        madeToOrderDays: optionalNumber("madeToOrderDays"),
        metaTitle: text("metaTitle") || undefined,
        metaDescription: text("metaDescription") || undefined,
        collectionIds,
      });

      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success(initial.id ? "Product saved." : "Product created.");
      if (!initial.id) router.push(`/admin/products/${result.data.id}`);
      else router.refresh();
    });
  }

  function remove() {
    const message = hasOrders
      ? "This piece has order history, so it will be archived (hidden from the shop) rather than permanently deleted. Continue?"
      : "Permanently delete this product? This cannot be undone.";
    if (!window.confirm(message)) return;

    startTransition(async () => {
      const result = await deleteProduct(initial.id!);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(hasOrders ? "Product archived." : "Product deleted.");
      router.push("/admin/products");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Panel title="The piece">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={initial.name}
              required
              onChange={(event) => {
                if (slugTouched) return;
                setSlug(slugify(event.target.value));
              }}
            />
          </Field>
          <Field
            label="URL slug"
            htmlFor="slug"
            hint={`/product/${slug || "…"}`}
            required
            error={fieldErrors.slug}
          >
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              required
            />
          </Field>
          <Field
            label="One-line description"
            htmlFor="shortDescription"
            className="sm:col-span-2"
            hint="Shown under the name on product cards."
            error={fieldErrors.shortDescription}
          >
            <Input
              id="shortDescription"
              name="shortDescription"
              defaultValue={initial.shortDescription}
              maxLength={200}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
            required
            error={fieldErrors.description}
          >
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={initial.description}
              required
            />
          </Field>
          <Field
            label="The story behind it"
            htmlFor="story"
            className="sm:col-span-2"
            hint="Optional editorial paragraph on the product page."
            error={fieldErrors.story}
          >
            <Textarea id="story" name="story" rows={3} defaultValue={initial.story} />
          </Field>
        </div>
      </Panel>

      <Panel title="Materials">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Metal" htmlFor="metal" required error={fieldErrors.metal}>
            <Select id="metal" name="metal" defaultValue={initial.metal} required>
              {Object.entries(METAL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Plating / finish"
            htmlFor="purity"
            hint="e.g. 18K gold plated"
            error={fieldErrors.purity}
          >
            <Input id="purity" name="purity" defaultValue={initial.purity} />
          </Field>
          <Field
            label="Stones"
            htmlFor="gemstone"
            hint="Comma-separated; these become shop filters."
            error={fieldErrors.gemstone}
          >
            <Input
              id="gemstone"
              name="gemstone"
              defaultValue={initial.gemstone}
              placeholder="Cubic zirconia, AD"
            />
          </Field>
          <Field
            label="Weight (grams)"
            htmlFor="weightGrams"
            error={fieldErrors.weightGrams}
          >
            <Input
              id="weightGrams"
              name="weightGrams"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial.weightGrams ?? ""}
            />
          </Field>
          <Field label="Dimensions" htmlFor="dimensions" error={fieldErrors.dimensions}>
            <Input
              id="dimensions"
              name="dimensions"
              defaultValue={initial.dimensions}
              placeholder="24 mm drop"
            />
          </Field>
          <Field
            label="Made to order (days)"
            htmlFor="madeToOrderDays"
            hint="Leave blank if it ships from stock."
            error={fieldErrors.madeToOrderDays}
          >
            <Input
              id="madeToOrderDays"
              name="madeToOrderDays"
              type="number"
              min={0}
              defaultValue={initial.madeToOrderDays ?? ""}
            />
          </Field>
          <Field
            label="Care instructions"
            htmlFor="careInstructions"
            className="sm:col-span-2 lg:col-span-3"
            error={fieldErrors.careInstructions}
          >
            <Textarea
              id="careInstructions"
              name="careInstructions"
              rows={2}
              defaultValue={initial.careInstructions}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Price and placement">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="From price (₹)"
            htmlFor="basePriceRupees"
            hint="Shown on cards. Variants carry their own prices."
            required
            error={fieldErrors.basePriceRupees}
          >
            <Input
              id="basePriceRupees"
              name="basePriceRupees"
              type="number"
              min={1}
              defaultValue={initial.basePriceRupees}
              required
            />
          </Field>
          <Field
            label="Compare at (₹)"
            htmlFor="compareAtRupees"
            hint="Optional. Shows a struck-through price."
            error={fieldErrors.compareAtRupees}
          >
            <Input
              id="compareAtRupees"
              name="compareAtRupees"
              type="number"
              min={0}
              defaultValue={initial.compareAtRupees ?? ""}
            />
          </Field>
        </div>

        <fieldset className="mt-5 border-t border-hairline pt-5">
          <legend className="sr-only">Collections</legend>
          <p className="mb-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted">
            Collections
          </p>
          <div className="flex flex-wrap gap-2">
            {collections.map((collection) => {
              const on = collectionIds.includes(collection.id);
              return (
                <button
                  key={collection.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setCollectionIds((current) =>
                      on
                        ? current.filter((id) => id !== collection.id)
                        : [...current, collection.id],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    on
                      ? "border-gold bg-gold text-cream"
                      : "border-hairline text-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {collection.name}
                </button>
              );
            })}
          </div>
          {fieldErrors.collectionIds ? (
            <p className="mt-2 text-xs text-danger" role="alert">
              {fieldErrors.collectionIds}
            </p>
          ) : null}
        </fieldset>

        <div className="mt-5 grid gap-3 border-t border-hairline pt-5 sm:grid-cols-3">
          {(
            [
              ["isFeatured", "Feature on the homepage"],
              ["isNewArrival", "Show in new arrivals"],
              ["isBestseller", "Mark as a bestseller"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
              <Checkbox
                checked={flags[key]}
                onChange={(event) =>
                  setFlags((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Search appearance">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Meta title"
            htmlFor="metaTitle"
            hint="Up to 70 characters. Falls back to the name."
            error={fieldErrors.metaTitle}
          >
            <Input
              id="metaTitle"
              name="metaTitle"
              maxLength={70}
              defaultValue={initial.metaTitle}
            />
          </Field>
          <Field
            label="Meta description"
            htmlFor="metaDescription"
            hint="Up to 180 characters."
            error={fieldErrors.metaDescription}
          >
            <Textarea
              id="metaDescription"
              name="metaDescription"
              rows={2}
              maxLength={180}
              defaultValue={initial.metaDescription}
            />
          </Field>
        </div>
      </Panel>

      {formError ? (
        <p className="text-xs text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap items-center gap-3 border-t border-hairline bg-cream/95 px-5 py-4 shadow-[0_-8px_24px_rgb(26_26_26/0.04)] backdrop-blur md:-mx-8 md:px-8">
        <Field
          label="Status"
          htmlFor="product-status"
          className="mb-0 w-auto"
          error={fieldErrors.status}
        >
          <Select
            id="product-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            aria-label="Publication status"
            className="h-10 w-36"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Live</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-3 pt-5">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner className="size-4" /> : null}
            {initial.id ? "Save product" : "Create product"}
          </Button>
          {initial.id ? (
            <Button type="button" variant="danger" onClick={remove} disabled={isPending}>
              {hasOrders ? "Archive product" : "Delete product"}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
