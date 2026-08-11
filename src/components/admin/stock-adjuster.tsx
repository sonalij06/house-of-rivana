"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { adjustInventory } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type FieldKey = "delta" | "note";

const REASONS = [
  { value: "RESTOCK", label: "Restock" },
  { value: "ADJUSTMENT", label: "Stock count correction" },
  { value: "DAMAGE", label: "Damaged / written off" },
] as const;

/**
 * Inline +/- control for one variant. Every change becomes an InventoryMovement,
 * so the number on screen is only ever the tail of the ledger.
 */
export function StockAdjuster({
  variantId,
  sku,
  stockQty,
  lowStockThreshold,
}: {
  variantId: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
}) {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState(stockQty);
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("RESTOCK");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [isPending, startTransition] = useTransition();

  const isOut = balance === 0;
  const isLow = !isOut && balance <= lowStockThreshold;

  function submit(direction: 1 | -1) {
    const units = Math.abs(Number(delta));
    if (!Number.isInteger(units) || units < 1) {
      setFieldErrors({ delta: "Enter a whole number of units." });
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const result = await adjustInventory({
        variantId,
        delta: units * direction,
        reason,
        note: note.trim() || `${direction > 0 ? "Added" : "Removed"} ${units} × ${sku}`,
      });

      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        if (Object.keys(fields).length > 0) {
          setFieldErrors({
            delta: fields.delta,
            note: fields.note,
          });
          return;
        }
        toast.error(result.error);
        return;
      }
      setBalance(result.data.balance);
      setNote("");
      setFieldErrors({});
      toast.success(`${sku} is now at ${result.data.balance}.`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "min-w-8 text-right text-sm tabular-nums",
            isOut ? "text-danger" : isLow ? "text-warning" : "text-ink",
          )}
        >
          {balance}
        </span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
          aria-expanded={open}
        >
          {open ? "Close" : "Adjust"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col items-end gap-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Input
                  value={delta}
                  onChange={(event) => setDelta(event.target.value)}
                  inputMode="numeric"
                  aria-label={`Units for ${sku}`}
                  aria-invalid={fieldErrors.delta ? true : undefined}
                  className="h-9 w-16 text-center text-sm"
                />
                <Select
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value as (typeof REASONS)[number]["value"])
                  }
                  aria-label={`Reason for ${sku}`}
                  className="h-9 w-44 text-sm"
                >
                  {REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note (optional)"
                  aria-label={`Note for ${sku}`}
                  aria-invalid={fieldErrors.note ? true : undefined}
                  className="h-9 w-40 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => submit(1)}
                >
                  {isPending ? <Spinner className="size-3" /> : null}
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending || balance === 0}
                  onClick={() => submit(-1)}
                >
                  Remove
                </Button>
              </div>
              {fieldErrors.delta || fieldErrors.note ? (
                <p className="max-w-sm text-right text-xs text-danger" role="alert">
                  {fieldErrors.delta ?? fieldErrors.note}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
