"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteVariant, saveVariant } from "@/app/actions/admin-catalog";
import { DataTable, Panel, Td } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { METAL_LABELS } from "@/lib/product";
import { formatPaise } from "@/lib/utils";

export type EditorVariant = {
  id: string;
  sku: string;
  label: string;
  optionSize: string | null;
  optionMetal: string | null;
  optionLength: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  stockQty: number;
  reservedQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  sortOrder: number;
};

/**
 * Variants carry the price and the stock, so this is where most catalogue work
 * happens. Stock changes here write an InventoryMovement rather than overwriting
 * the count, which keeps the ledger the single source of truth.
 */
export function VariantEditor({
  productId,
  productSlug,
  variants,
}: {
  productId: string;
  productSlug: string;
  variants: EditorVariant[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(variantId: string) {
    if (
      !window.confirm(
        "Remove this variant? Stock history stays in the ledger, but the SKU will no longer be sellable.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteVariant(variantId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Variant removed.");
      router.refresh();
    });
  }

  return (
    <Panel
      title="Variants"
      padded={false}
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing(editing === "new" ? null : "new")}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Add variant
        </Button>
      }
    >
      <AnimatePresence initial={false}>
        {editing === "new" ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-hairline bg-cream"
          >
            <VariantForm
              productId={productId}
              productSlug={productSlug}
              nextSortOrder={variants.length}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DataTable
        head={["SKU", "Label", "Price", "Stock", ""]}
        empty="Add at least one variant so the piece can be bought."
        minWidth="34rem"
      >
        {variants.flatMap((variant) => {
          const rows = [
            <tr
              key={variant.id}
              className={variant.isActive ? undefined : "opacity-55"}
            >
              <Td>
                <span className="font-mono text-[0.6875rem] text-ink">{variant.sku}</span>
                {!variant.isActive ? (
                  <span className="ml-2 text-[0.625rem] uppercase tracking-[0.1em] text-muted-light">
                    hidden
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="text-xs text-ink">{variant.label}</span>
              </Td>
              <Td>
                <span className="text-xs tabular-nums text-ink">
                  {formatPaise(variant.pricePaise)}
                </span>
                {variant.compareAtPaise ? (
                  <span className="ml-1.5 text-[0.625rem] tabular-nums text-muted-light line-through">
                    {formatPaise(variant.compareAtPaise)}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span
                  className={
                    variant.stockQty - variant.reservedQty <= 0
                      ? "text-xs tabular-nums text-danger"
                      : variant.stockQty <= variant.lowStockThreshold
                        ? "text-xs tabular-nums text-warning"
                        : "text-xs tabular-nums text-muted"
                  }
                >
                  {variant.stockQty}
                  {variant.reservedQty > 0 ? ` (${variant.reservedQty} held)` : ""}
                </span>
              </Td>
              <Td align="right">
                <span className="inline-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(editing === variant.id ? null : variant.id)}
                    aria-label={`Edit ${variant.sku}`}
                    className="text-muted transition-colors hover:text-gold"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(variant.id)}
                    disabled={isPending}
                    aria-label={`Remove ${variant.sku}`}
                    className="text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </span>
              </Td>
            </tr>,
          ];

          if (editing === variant.id) {
            rows.push(
              <tr key={`${variant.id}-form`}>
                <td colSpan={5} className="bg-cream p-0">
                  <VariantForm
                    productId={productId}
                    productSlug={productSlug}
                    variant={variant}
                    nextSortOrder={variant.sortOrder}
                    onDone={() => {
                      setEditing(null);
                      router.refresh();
                    }}
                  />
                </td>
              </tr>,
            );
          }

          return rows;
        })}
      </DataTable>
    </Panel>
  );
}

function VariantForm({
  productId,
  variant,
  nextSortOrder,
  onDone,
}: {
  productId: string;
  productSlug: string;
  variant?: EditorVariant;
  nextSortOrder: number;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(variant?.isActive ?? true);
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const optional = (key: string) => text(key) || undefined;

    startTransition(async () => {
      const result = await saveVariant({
        id: variant?.id,
        productId,
        sku: text("sku").toUpperCase(),
        label: text("label"),
        optionSize: optional("optionSize"),
        optionMetal: optional("optionMetal"),
        optionLength: optional("optionLength"),
        priceRupees: Number(form.get("priceRupees") ?? 0),
        compareAtRupees: text("compareAtRupees")
          ? Number(form.get("compareAtRupees"))
          : undefined,
        stockQty: Number(form.get("stockQty") ?? 0),
        lowStockThreshold: Number(form.get("lowStockThreshold") ?? 2),
        isActive,
        sortOrder: nextSortOrder,
      });

      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success(variant ? "Variant saved." : "Variant added.");
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-l-2 border-gold p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SKU" htmlFor="sku" required error={fieldErrors.sku}>
          <Input
            id="sku"
            name="sku"
            defaultValue={variant?.sku}
            placeholder="AURELI-24MM-YG"
            required
            className="font-mono"
          />
        </Field>
        <Field
          label="Label"
          htmlFor="label"
          hint="Shown in cart lines"
          required
          error={fieldErrors.label}
        >
          <Input
            id="label"
            name="label"
            defaultValue={variant?.label}
            placeholder="Gold-plated · 24mm"
            required
          />
        </Field>
        <Field
          label="Price (₹)"
          htmlFor="priceRupees"
          required
          error={fieldErrors.priceRupees}
        >
          <Input
            id="priceRupees"
            name="priceRupees"
            type="number"
            min={1}
            defaultValue={variant ? variant.pricePaise / 100 : ""}
            required
          />
        </Field>
        <Field
          label="Compare at (₹)"
          htmlFor="compareAtRupees"
          error={fieldErrors.compareAtRupees}
        >
          <Input
            id="compareAtRupees"
            name="compareAtRupees"
            type="number"
            min={0}
            defaultValue={variant?.compareAtPaise ? variant.compareAtPaise / 100 : ""}
          />
        </Field>
        <Field label="Metal" htmlFor="optionMetal" error={fieldErrors.optionMetal}>
          <Select id="optionMetal" name="optionMetal" defaultValue={variant?.optionMetal ?? ""}>
            <option value="">Not applicable</option>
            {Object.entries(METAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Size"
          htmlFor="optionSize"
          hint="Ring size or similar"
          error={fieldErrors.optionSize}
        >
          <Input id="optionSize" name="optionSize" defaultValue={variant?.optionSize ?? ""} />
        </Field>
        <Field
          label="Length"
          htmlFor="optionLength"
          hint="Chain or bracelet length"
          error={fieldErrors.optionLength}
        >
          <Input
            id="optionLength"
            name="optionLength"
            defaultValue={variant?.optionLength ?? ""}
          />
        </Field>
        <Field
          label="Stock on hand"
          htmlFor="stockQty"
          hint="Changes are written to the ledger."
          required
          error={fieldErrors.stockQty}
        >
          <Input
            id="stockQty"
            name="stockQty"
            type="number"
            min={0}
            defaultValue={variant?.stockQty ?? 0}
            required
          />
        </Field>
        <Field
          label="Low stock alert at"
          htmlFor="lowStockThreshold"
          error={fieldErrors.lowStockThreshold}
        >
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={variant?.lowStockThreshold ?? 2}
          />
        </Field>
      </div>

      {formError ? (
        <p className="mt-4 text-xs text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Spinner className="size-3.5" /> : null}
          {variant ? "Save variant" : "Add variant"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Available to buy
        </label>
      </div>
    </form>
  );
}
