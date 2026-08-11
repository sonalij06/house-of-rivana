"use client";

import { useState, useTransition } from "react";
import { Truck } from "lucide-react";
import { estimateDelivery } from "@/app/actions/shipping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DeliveryEstimate({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onCheck(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await estimateDelivery({ postalCode: pincode });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const parts = [
        result.data.etdLabel ? `Expected by ${result.data.etdLabel}` : null,
        result.data.courierName ? `via ${result.data.courierName}` : null,
      ].filter(Boolean);
      setMessage(parts.join(" · ") || "Deliverable to this PIN code.");
    });
  }

  return (
    <div className={cn(className)}>
      <form onSubmit={onCheck} className="flex flex-wrap items-end gap-2">
        <div className={cn("min-w-0", compact ? "w-28" : "w-36")}>
          <label
            htmlFor="delivery-pincode"
            className="mb-1.5 block text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light"
          >
            Check delivery
          </label>
          <Input
            id="delivery-pincode"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="PIN code"
            value={pincode}
            onChange={(event) =>
              setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? <Spinner className="size-3.5" /> : <Truck className="size-3.5" strokeWidth={1.6} />}
          Check
        </Button>
      </form>
      {message ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-success">
          <Truck className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.6} />
          {message}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
