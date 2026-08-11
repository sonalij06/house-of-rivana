"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  addOrderNote,
  addShipmentEvent,
  cancelOrderAsStaff,
  changeOrderStatus,
  createShipment,
  refundOrder,
} from "@/app/actions/admin-orders";
import {
  refreshShipmentTracking,
  shipOrderViaShiprocket,
} from "@/app/actions/shipping";
import { Panel } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { SHIPMENT_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { formatPaise } from "@/lib/utils";

const CARRIERS = [
  "Blue Dart",
  "Delhivery",
  "DTDC",
  "India Post (Speed Post)",
  "Shiprocket",
  "Sequel Logistics",
  "XpressBees",
];

/**
 * Everything an operator can do to one order, grouped by what it changes. The
 * server decides what is legal — these controls only offer the plausible next
 * steps so nobody has to memorise the state machine.
 */
export function OrderActions({
  orderId,
  status,
  nextStatuses,
  grandTotalPaise,
  refundedPaise,
  hasGatewayPayment,
  shiprocketReady,
  shipment,
}: {
  orderId: string;
  status: OrderStatus;
  nextStatuses: OrderStatus[];
  grandTotalPaise: number;
  refundedPaise: number;
  hasGatewayPayment: boolean;
  shiprocketReady: boolean;
  shipment: { id: string; status: string; carrier: string; awb: string | null } | null;
}) {
  return (
    <div className="space-y-5">
      <StatusPanel orderId={orderId} status={status} nextStatuses={nextStatuses} />
      {shipment ? (
        <ShipmentEventPanel shipment={shipment} shiprocketReady={shiprocketReady} />
      ) : (
        <ShipmentPanel
          orderId={orderId}
          enabled={canShip(status)}
          shiprocketReady={shiprocketReady}
        />
      )}
      <RefundPanel
        orderId={orderId}
        grandTotalPaise={grandTotalPaise}
        refundedPaise={refundedPaise}
        hasGatewayPayment={hasGatewayPayment}
      />
      <NotePanel orderId={orderId} />
      {status !== "CANCELLED" && status !== "REFUNDED" ? (
        <CancelPanel orderId={orderId} />
      ) : null}
    </div>
  );
}

function canShip(status: OrderStatus) {
  return status === "CONFIRMED" || status === "PROCESSING" || status === "PACKED";
}

function StatusPanel({
  orderId,
  status,
  nextStatuses,
}: {
  orderId: string;
  status: OrderStatus;
  nextStatuses: OrderStatus[];
}) {
  const [isPending, startTransition] = useTransition();

  // SHIPPED needs an AWB, so it is offered through the shipment panel instead.
  const options = nextStatuses.filter((s) => s !== "SHIPPED" && s !== "CANCELLED");

  if (options.length === 0) {
    return (
      <Panel title="Status">
        <p className="text-sm text-muted">
          {status === "DELIVERED"
            ? "Delivered — nothing further to do."
            : "There is no next step available from here."}
        </p>
      </Panel>
    );
  }

  function move(next: OrderStatus) {
    startTransition(async () => {
      const result = await changeOrderStatus({ orderId, status: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
    });
  }

  return (
    <Panel title="Move this order on">
      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <Button
            key={next}
            size="sm"
            variant={next === "DELIVERED" ? "primary" : "outline"}
            onClick={() => move(next)}
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-3.5" /> : null}
            Mark {next.toLowerCase().replace(/_/g, " ")}
          </Button>
        ))}
      </div>
    </Panel>
  );
}

function ShipmentPanel({
  orderId,
  enabled,
  shiprocketReady,
}: {
  orderId: string;
  enabled: boolean;
  shiprocketReady: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const weight = Number(form.get("weightGrams") ?? 0);

    startTransition(async () => {
      const result = await createShipment({
        orderId,
        carrier: String(form.get("carrier") ?? ""),
        awb: String(form.get("awb") ?? ""),
        trackingUrl: String(form.get("trackingUrl") ?? "").trim(),
        estimatedDelivery: String(form.get("estimatedDelivery") ?? "") || undefined,
        weightGrams: weight > 0 ? weight : undefined,
      });
      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success(result.data.message);
    });
  }

  function shipWithShiprocket() {
    startTransition(async () => {
      const result = await shipOrderViaShiprocket(orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
    });
  }

  return (
    <Panel title="Dispatch">
      {!enabled ? (
        <p className="text-sm text-muted">
          Confirm the payment first — a shipment cannot be created for an unpaid order.
        </p>
      ) : (
        <div className="space-y-6">
          {shiprocketReady ? (
            <div className="space-y-3 border-b border-hairline pb-5">
              <p className="text-sm text-muted">
                Create the AWB on Shiprocket, schedule pickup, and notify the customer with the
                live ETA in one step.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={shipWithShiprocket}
                disabled={isPending}
              >
                {isPending ? <Spinner className="size-3.5" /> : null}
                Ship with Shiprocket
              </Button>
            </div>
          ) : (
            <p className="text-xs text-warning">
              Shiprocket is not configured. Add{" "}
              <code className="text-[0.7rem]">SHIPROCKET_EMAIL</code> and{" "}
              <code className="text-[0.7rem]">SHIPROCKET_PASSWORD</code> to{" "}
              <code className="text-[0.7rem]">.env</code>, then restart the server.
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <p className="text-[0.625rem] font-medium uppercase tracking-[0.16em] text-muted-light">
              Or enter a courier manually
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Carrier" htmlFor="carrier" required error={fieldErrors.carrier}>
                <Select id="carrier" name="carrier" defaultValue={CARRIERS[0]} required>
                  {CARRIERS.map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {carrier}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Tracking number (AWB)"
                htmlFor="awb"
                required
                error={fieldErrors.awb}
              >
                <Input id="awb" name="awb" required autoComplete="off" />
              </Field>
              <Field label="Tracking link" htmlFor="trackingUrl" error={fieldErrors.trackingUrl}>
                <Input
                  id="trackingUrl"
                  name="trackingUrl"
                  type="url"
                  placeholder="https://…"
                />
              </Field>
              <Field
                label="Estimated delivery"
                htmlFor="estimatedDelivery"
                error={fieldErrors.estimatedDelivery}
              >
                <Input id="estimatedDelivery" name="estimatedDelivery" type="date" />
              </Field>
              <Field label="Weight (grams)" htmlFor="weightGrams" error={fieldErrors.weightGrams}>
                <Input id="weightGrams" name="weightGrams" type="number" min={0} />
              </Field>
            </div>
            {formError ? (
              <p className="text-xs text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            <Button type="submit" size="sm" variant="outline" disabled={isPending}>
              {isPending ? <Spinner className="size-3.5" /> : null}
              Mark shipped and notify
            </Button>
          </form>
        </div>
      )}
    </Panel>
  );
}

function ShipmentEventPanel({
  shipment,
  shiprocketReady,
}: {
  shipment: { id: string; status: string; carrier: string; awb: string | null };
  shiprocketReady: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(shipment.status);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addShipmentEvent({
        shipmentId: shipment.id,
        status,
        description: String(form.get("description") ?? ""),
        location: String(form.get("location") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tracking updated.");
      (event.target as HTMLFormElement).reset();
    });
  }

  function refreshFromShiprocket() {
    startTransition(async () => {
      const result = await refreshShipmentTracking(shipment.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
    });
  }

  return (
    <Panel title="Tracking update">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {shipment.carrier} · <span className="font-mono">{shipment.awb}</span>
        </p>
        {shiprocketReady && shipment.awb ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refreshFromShiprocket}
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-3.5" /> : null}
            Sync from Shiprocket
          </Button>
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="shipmentStatus">
            <Select
              id="shipmentStatus"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location" htmlFor="location">
            <Input id="location" name="location" placeholder="Mumbai hub" />
          </Field>
        </div>
        <Field label="What happened" htmlFor="description" required>
          <Input
            id="description"
            name="description"
            required
            placeholder="Arrived at the destination hub"
          />
        </Field>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? <Spinner className="size-3.5" /> : null}
          Add tracking event
        </Button>
      </form>
    </Panel>
  );
}

function RefundPanel({
  orderId,
  grandTotalPaise,
  refundedPaise,
  hasGatewayPayment,
}: {
  orderId: string;
  grandTotalPaise: number;
  refundedPaise: number;
  hasGatewayPayment: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [viaGateway, setViaGateway] = useState(hasGatewayPayment);
  const remaining = grandTotalPaise - refundedPaise;

  if (remaining <= 0) {
    return (
      <Panel title="Refunds">
        <p className="text-sm text-muted">
          Fully refunded ({formatPaise(refundedPaise)}).
        </p>
      </Panel>
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await refundOrder({
        orderId,
        amountRupees: Number(form.get("amountRupees") ?? 0),
        viaGateway,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
      setOpen(false);
    });
  }

  return (
    <Panel title="Refunds">
      {refundedPaise > 0 ? (
        <p className="mb-3 text-xs text-muted">
          {formatPaise(refundedPaise)} already refunded ·{" "}
          {formatPaise(remaining)} remaining.
        </p>
      ) : null}

      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.form
            key="form"
            onSubmit={onSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <Field label="Amount (₹)" htmlFor="amountRupees" required>
              <Input
                id="amountRupees"
                name="amountRupees"
                type="number"
                step="0.01"
                min={1}
                max={remaining / 100}
                defaultValue={remaining / 100}
                required
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
              <Checkbox
                checked={viaGateway}
                disabled={!hasGatewayPayment}
                onChange={(event) => setViaGateway(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Push the refund through Razorpay
                <span className="mt-0.5 block text-xs text-muted-light">
                  {hasGatewayPayment
                    ? "Unchecked, this only records a refund you send by UPI yourself."
                    : "No gateway payment on this order — refund by UPI and record it here."}
                </span>
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="danger" disabled={isPending}>
                {isPending ? <Spinner className="size-3.5" /> : null}
                Refund and notify
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </motion.form>
        ) : (
          <Button key="open" size="sm" variant="outline" onClick={() => setOpen(true)}>
            Issue a refund
          </Button>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function NotePanel({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [customerVisible, setCustomerVisible] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = String(new FormData(form).get("note") ?? "");

    startTransition(async () => {
      const result = await addOrderNote({ orderId, note, customerVisible });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note added to the timeline.");
      form.reset();
    });
  }

  return (
    <Panel title="Add a note">
      <form onSubmit={onSubmit} className="space-y-3">
        <Textarea name="note" rows={3} placeholder="What should the next person know?" />
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={customerVisible}
            onChange={(event) => setCustomerVisible(event.target.checked)}
          />
          Show this to the customer on their order page
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? <Spinner className="size-3.5" /> : null}
          Add note
        </Button>
      </form>
    </Panel>
  );
}

function CancelPanel({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function cancel(reason: string) {
    startTransition(async () => {
      const result = await cancelOrderAsStaff({ orderId, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
      setConfirming(false);
    });
  }

  return (
    <Panel title="Cancel">
      {confirming ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            cancel(String(new FormData(event.currentTarget).get("reason") ?? ""));
          }}
          className="space-y-3"
        >
          <p className="text-xs leading-relaxed text-muted">
            Cancelling returns every piece to stock and emails the customer. If money was
            taken, refund it separately.
          </p>
          <Input name="reason" placeholder="Reason (shown to the customer)" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={isPending}>
              {isPending ? <Spinner className="size-3.5" /> : null}
              Cancel this order
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Cancel this order
        </Button>
      )}
    </Panel>
  );
}
