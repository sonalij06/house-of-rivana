"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCoupon, saveCoupon, toggleCoupon } from "@/app/actions/admin-marketing";
import { DataTable, Panel, StatusPill, Td } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatPaise } from "@/lib/utils";

export type CouponType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

export type EditorCoupon = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minSubtotalPaise: number;
  maxDiscountPaise: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  isActive: boolean;
  discountedPaise: number;
};

const TYPE_LABEL: Record<CouponType, string> = {
  PERCENT: "Percentage off",
  FIXED: "Flat amount off",
  FREE_SHIPPING: "Free shipping",
};

export function describeCoupon(coupon: Pick<EditorCoupon, "type" | "value">) {
  if (coupon.type === "FREE_SHIPPING") return "Free shipping";
  if (coupon.type === "PERCENT") return `${coupon.value}% off`;
  return `${formatPaise(coupon.value)} off`;
}

function toDateInput(date: Date | null) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export function CouponManager({ coupons }: { coupons: EditorCoupon[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(coupon: EditorCoupon) {
    startTransition(async () => {
      const result = await toggleCoupon(coupon.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${coupon.code} ${coupon.isActive ? "paused" : "live"}.`);
    });
  }

  function remove(coupon: EditorCoupon) {
    startTransition(async () => {
      const result = await deleteCoupon(coupon.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${coupon.code} deleted.`);
    });
  }

  return (
    <Panel
      title="Coupons"
      padded={false}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(editing === "new" ? null : "new")}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          New coupon
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
            <CouponForm onDone={() => setEditing(null)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DataTable
        head={["Code", "Discount", "Conditions", "Window", "Used", ""]}
        empty="No coupons yet."
        minWidth="56rem"
      >
        {coupons.flatMap((coupon) => {
          const expired = coupon.endsAt ? new Date(coupon.endsAt) < new Date() : false;
          const exhausted = coupon.usageLimit
            ? coupon.usedCount >= coupon.usageLimit
            : false;

          const rows = [
            <tr key={coupon.id} className={coupon.isActive ? undefined : "opacity-55"}>
              <Td>
                <span className="font-mono text-[0.8125rem] tracking-[0.06em] text-ink">
                  {coupon.code}
                </span>
                {coupon.description ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {coupon.description}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="text-xs text-ink">{describeCoupon(coupon)}</span>
                {coupon.maxDiscountPaise ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    max {formatPaise(coupon.maxDiscountPaise)}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="text-xs text-muted">
                  {coupon.minSubtotalPaise > 0
                    ? `Over ${formatPaise(coupon.minSubtotalPaise)}`
                    : "No minimum"}
                </span>
                {coupon.usageLimitPerUser ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {coupon.usageLimitPerUser} per customer
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="text-xs text-muted">
                  {coupon.startsAt ? formatDate(coupon.startsAt) : "Now"} →{" "}
                  {coupon.endsAt ? formatDate(coupon.endsAt) : "open"}
                </span>
              </Td>
              <Td>
                <span className="text-xs tabular-nums text-muted">
                  {coupon.usedCount}
                  {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                </span>
                {coupon.discountedPaise > 0 ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {formatPaise(coupon.discountedPaise)} given
                  </span>
                ) : null}
              </Td>
              <Td align="right">
                <span className="inline-flex items-center gap-2.5">
                  {!coupon.isActive ? (
                    <StatusPill status="EXPIRED" label="paused" />
                  ) : exhausted ? (
                    <StatusPill status="EXPIRED" label="used up" />
                  ) : expired ? (
                    <StatusPill status="EXPIRED" label="expired" />
                  ) : (
                    <StatusPill status="CONFIRMED" label="live" />
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(coupon)}
                    disabled={isPending}
                    className="text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
                  >
                    {coupon.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(editing === coupon.id ? null : coupon.id)}
                    aria-label={`Edit ${coupon.code}`}
                    className="text-muted transition-colors hover:text-gold"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(coupon)}
                    disabled={isPending}
                    aria-label={`Delete ${coupon.code}`}
                    className="text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </span>
              </Td>
            </tr>,
          ];

          if (editing === coupon.id) {
            rows.push(
              <tr key={`${coupon.id}-form`}>
                <td colSpan={6} className="bg-cream p-0">
                  <CouponForm coupon={coupon} onDone={() => setEditing(null)} />
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

function CouponForm({
  coupon,
  onDone,
}: {
  coupon?: EditorCoupon;
  onDone: () => void;
}) {
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENT");
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
  const [isPending, startTransition] = useTransition();
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  const valueDefault =
    coupon == null
      ? ""
      : coupon.type === "PERCENT"
        ? String(coupon.value)
        : coupon.type === "FIXED"
          ? String(coupon.value / 100)
          : "";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const num = (key: string) => Number(form.get(key) ?? 0) || 0;

    startTransition(async () => {
      const result = await saveCoupon({
        id: coupon?.id,
        code: text("code").toUpperCase(),
        description: text("description") || undefined,
        type,
        value: type === "FREE_SHIPPING" ? 0 : num("value"),
        minSubtotalRupees: num("minSubtotal"),
        maxDiscountRupees: num("maxDiscount") || undefined,
        startsAt: text("startsAt") || undefined,
        endsAt: text("endsAt") || undefined,
        usageLimit: num("usageLimit") || undefined,
        usageLimitPerUser: num("usageLimitPerUser") || undefined,
        isActive,
      });

      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success(coupon ? "Coupon saved." : "Coupon created.");
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-l-2 border-gold p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Code"
          htmlFor="code"
          required
          hint="Shown to customers exactly as typed."
          error={fieldErrors.code}
        >
          <Input
            id="code"
            name="code"
            defaultValue={coupon?.code}
            placeholder="RIVANA10"
            required
            className="font-mono uppercase tracking-[0.08em]"
          />
        </Field>
        <Field label="Type" htmlFor="type" error={fieldErrors.type}>
          <Select
            id="type"
            value={type}
            onChange={(event) => setType(event.target.value as CouponType)}
          >
            {(Object.keys(TYPE_LABEL) as CouponType[]).map((key) => (
              <option key={key} value={key}>
                {TYPE_LABEL[key]}
              </option>
            ))}
          </Select>
        </Field>
        {type === "FREE_SHIPPING" ? (
          <div className="hidden xl:block" />
        ) : (
          <Field
            label={type === "PERCENT" ? "Percent off" : "Amount off (₹)"}
            htmlFor="value"
            required
            error={fieldErrors.value}
          >
            <Input
              id="value"
              name="value"
              type="number"
              min={1}
              max={type === "PERCENT" ? 90 : undefined}
              step={type === "PERCENT" ? 1 : 0.01}
              defaultValue={valueDefault}
              required
            />
          </Field>
        )}
        <Field
          label="Minimum subtotal (₹)"
          htmlFor="minSubtotal"
          error={fieldErrors.minSubtotalRupees}
        >
          <Input
            id="minSubtotal"
            name="minSubtotal"
            type="number"
            min={0}
            defaultValue={coupon ? coupon.minSubtotalPaise / 100 : 0}
          />
        </Field>
        {type === "PERCENT" ? (
          <Field
            label="Cap the discount at (₹)"
            htmlFor="maxDiscount"
            hint="Leave blank for no cap."
            error={fieldErrors.maxDiscountRupees}
          >
            <Input
              id="maxDiscount"
              name="maxDiscount"
              type="number"
              min={0}
              defaultValue={coupon?.maxDiscountPaise ? coupon.maxDiscountPaise / 100 : ""}
            />
          </Field>
        ) : null}
        <Field
          label="Description"
          htmlFor="description"
          className="sm:col-span-2"
          error={fieldErrors.description}
        >
          <Input
            id="description"
            name="description"
            defaultValue={coupon?.description ?? ""}
            placeholder="Festive launch offer"
          />
        </Field>
        <Field label="Starts" htmlFor="startsAt" error={fieldErrors.startsAt}>
          <Input
            id="startsAt"
            name="startsAt"
            type="date"
            defaultValue={toDateInput(coupon?.startsAt ?? null)}
          />
        </Field>
        <Field label="Ends" htmlFor="endsAt" error={fieldErrors.endsAt}>
          <Input
            id="endsAt"
            name="endsAt"
            type="date"
            defaultValue={toDateInput(coupon?.endsAt ?? null)}
          />
        </Field>
        <Field
          label="Total uses"
          htmlFor="usageLimit"
          hint="Blank means unlimited."
          error={fieldErrors.usageLimit}
        >
          <Input
            id="usageLimit"
            name="usageLimit"
            type="number"
            min={0}
            defaultValue={coupon?.usageLimit ?? ""}
          />
        </Field>
        <Field
          label="Uses per customer"
          htmlFor="usageLimitPerUser"
          error={fieldErrors.usageLimitPerUser}
        >
          <Input
            id="usageLimitPerUser"
            name="usageLimitPerUser"
            type="number"
            min={0}
            defaultValue={coupon?.usageLimitPerUser ?? ""}
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
          {coupon ? "Save coupon" : "Create coupon"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Live
        </label>
      </div>
    </form>
  );
}
