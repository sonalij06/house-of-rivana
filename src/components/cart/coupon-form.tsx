"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Tag, X } from "lucide-react";
import { toast } from "sonner";
import { applyCoupon, removeCoupon } from "@/app/actions/cart";
import { Spinner } from "@/components/ui/spinner";

export function CouponForm({
  appliedCode,
  couponError,
}: {
  appliedCode: string | null;
  /** A stored code that has stopped qualifying, e.g. after the cart shrank. */
  couponError: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(Boolean(appliedCode || couponError));
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await applyCoupon(code);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
      setCode("");
      router.refresh();
    });
  }

  function clear() {
    startTransition(async () => {
      await removeCoupon();
      router.refresh();
    });
  }

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between gap-3 border border-success/25 bg-success-soft px-3.5 py-3">
        <p className="flex items-center gap-2 text-xs text-success">
          <Tag className="size-3.5" strokeWidth={1.7} />
          <span className="font-medium tracking-[0.08em]">{appliedCode}</span> applied
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={isPending}
          className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-[0.12em] text-success/80 transition-colors hover:text-success"
        >
          {isPending ? <Spinner className="size-3" /> : <X className="size-3" />}
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs text-muted transition-colors hover:text-gold"
        >
          <Tag className="size-3.5" strokeWidth={1.7} />
          Have a promotion code?
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <form onSubmit={submit} className="flex gap-2 pt-1">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="PROMOTION CODE"
                aria-label="Promotion code"
                autoComplete="off"
                maxLength={32}
                className="h-10 min-w-0 flex-1 border border-hairline bg-surface px-3 text-xs uppercase tracking-[0.12em] text-ink outline-none transition-colors placeholder:text-muted-light focus:border-gold"
              />
              <button
                type="submit"
                disabled={isPending || !code.trim()}
                className="flex h-10 shrink-0 items-center gap-2 border border-ink px-4 text-[0.6875rem] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                {isPending ? <Spinner className="size-3.5" /> : null}
                Apply
              </button>
            </form>
            {couponError ? (
              <p className="mt-2 text-xs text-danger" role="alert">
                {couponError}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
