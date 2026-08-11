"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAddress,
  saveAddress,
  setDefaultAddress,
} from "@/app/actions/account";
import { INDIAN_STATES } from "@/components/checkout/india";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export type AddressRow = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
};

export function AddressManager({ addresses }: { addresses: AddressRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [creating, setCreating] = useState(addresses.length === 0);
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <ul className="divide-y divide-hairline border border-hairline">
        {addresses.map((address) => (
          <li key={address.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{address.fullName}</p>
                {address.isDefault ? (
                  <span className="text-[0.625rem] uppercase tracking-[0.14em] text-gold">
                    Default
                  </span>
                ) : null}
                {address.label ? (
                  <span className="text-xs text-muted">· {address.label}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.phone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!address.isDefault ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await setDefaultAddress(address.id);
                      if (!result.ok) toast.error(result.error);
                      else {
                        toast.success("Default address updated.");
                        refresh();
                      }
                    })
                  }
                >
                  Make default
                </Button>
              ) : null}
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => {
                  setEditing(address);
                  setCreating(false);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteAddress(address.id);
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success("Address removed.");
                      refresh();
                    }
                  })
                }
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {!creating && !editing ? (
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          Add an address
        </Button>
      ) : null}

      {(creating || editing) && (
        <AddressForm
          key={editing?.id ?? "new"}
          initial={editing}
          pending={pending}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            startTransition(async () => {
              const result = await saveAddress(payload);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(editing ? "Address updated." : "Address saved.");
              setCreating(false);
              setEditing(null);
              refresh();
            });
          }}
        />
      )}
    </div>
  );
}

function AddressForm({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: AddressRow | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    id?: string;
    label?: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    postalCode: string;
    isDefault?: boolean;
  }) => void;
}) {
  return (
    <form
      className="space-y-4 border border-hairline bg-surface p-5 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          id: initial?.id,
          label: String(form.get("label") ?? "").trim() || undefined,
          fullName: String(form.get("fullName") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim(),
          line1: String(form.get("line1") ?? "").trim(),
          line2: String(form.get("line2") ?? "").trim() || undefined,
          landmark: String(form.get("landmark") ?? "").trim() || undefined,
          city: String(form.get("city") ?? "").trim(),
          state: String(form.get("state") ?? "").trim(),
          postalCode: String(form.get("postalCode") ?? "").trim(),
          isDefault: form.get("isDefault") === "on",
        });
      }}
    >
      <p className="font-display text-xl text-ink">
        {initial ? "Edit address" : "New address"}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" required>
          <Input
            id="fullName"
            name="fullName"
            required
            defaultValue={initial?.fullName ?? ""}
            autoComplete="name"
          />
        </Field>
        <Field label="Phone" htmlFor="phone" required>
          <Input
            id="phone"
            name="phone"
            required
            defaultValue={initial?.phone ?? ""}
            autoComplete="tel"
            placeholder="9876543210"
          />
        </Field>
        <Field label="Label" htmlFor="label" hint="Home, office…">
          <Input
            id="label"
            name="label"
            defaultValue={initial?.label ?? ""}
          />
        </Field>
        <Field label="PIN code" htmlFor="postalCode" required>
          <Input
            id="postalCode"
            name="postalCode"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            defaultValue={initial?.postalCode ?? ""}
            autoComplete="postal-code"
          />
        </Field>
        <Field label="Address line 1" htmlFor="line1" required className="md:col-span-2">
          <Input
            id="line1"
            name="line1"
            required
            defaultValue={initial?.line1 ?? ""}
            autoComplete="address-line1"
          />
        </Field>
        <Field label="Address line 2" htmlFor="line2" className="md:col-span-2">
          <Input
            id="line2"
            name="line2"
            defaultValue={initial?.line2 ?? ""}
            autoComplete="address-line2"
          />
        </Field>
        <Field label="Landmark" htmlFor="landmark">
          <Input
            id="landmark"
            name="landmark"
            defaultValue={initial?.landmark ?? ""}
          />
        </Field>
        <Field label="City" htmlFor="city" required>
          <Input
            id="city"
            name="city"
            required
            defaultValue={initial?.city ?? ""}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="State" htmlFor="state" required className="md:col-span-2">
          <Select
            id="state"
            name="state"
            required
            defaultValue={initial?.state ?? ""}
          >
            <option value="" disabled>
              Select state
            </option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initial?.isDefault ?? true}
          className="size-4 accent-[var(--color-gold)]"
        />
        Use as default shipping address
      </label>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          Save address
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
