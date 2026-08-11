"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import { placeOrder } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { INDIAN_STATES } from "@/components/checkout/india";
import { DeliveryEstimate } from "@/components/shipping/delivery-estimate";
import { cn } from "@/lib/utils";

export type SavedAddress = {
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
  country: string;
  isDefault: boolean;
};

export function CheckoutForm({
  defaultEmail,
  isSignedIn,
  savedAddresses,
  providerLabel,
}: {
  defaultEmail: string;
  isSignedIn: boolean;
  savedAddresses: SavedAddress[];
  providerLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? null,
  );
  const [giftWrap, setGiftWrap] = useState(false);

  const usingSaved = Boolean(selectedId);
  const selected = savedAddresses.find((a) => a.id === selectedId) ?? null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    const address = selected
      ? {
          fullName: selected.fullName,
          phone: selected.phone,
          line1: selected.line1,
          line2: selected.line2 ?? undefined,
          landmark: selected.landmark ?? undefined,
          city: selected.city,
          state: selected.state,
          postalCode: selected.postalCode,
          country: selected.country,
        }
      : {
          fullName: String(form.get("fullName") ?? ""),
          phone: String(form.get("phone") ?? ""),
          line1: String(form.get("line1") ?? ""),
          line2: String(form.get("line2") ?? "") || undefined,
          landmark: String(form.get("landmark") ?? "") || undefined,
          city: String(form.get("city") ?? ""),
          state: String(form.get("state") ?? ""),
          postalCode: String(form.get("postalCode") ?? ""),
          country: "India",
        };

    startTransition(async () => {
      const result = await placeOrder({
        email: String(form.get("email") ?? ""),
        address,
        saveAddress: isSignedIn && !usingSaved && form.get("saveAddress") === "on",
        customerNote: String(form.get("customerNote") ?? "") || undefined,
        giftWrap,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      router.push(
        `/checkout/payment/${result.data.orderNumber}?t=${result.data.accessToken}`,
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <section>
        <SectionTitle step={1} title="Contact" />
        <div className="mt-5 max-w-md">
          <Field
            label="Email"
            htmlFor="email"
            hint="Your receipt and tracking go here."
            required
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={defaultEmail}
              required
            />
          </Field>
          {!isSignedIn ? (
            <p className="mt-3 text-xs text-muted">
              Checking out as a guest.{" "}
              <Link
                href="/login?next=/checkout"
                className="text-gold underline-offset-4 hover:underline"
              >
                Sign in
              </Link>{" "}
              to use a saved address and see this order in your account.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle step={2} title="Delivery address" />

        {savedAddresses.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {savedAddresses.map((address) => (
              <button
                key={address.id}
                type="button"
                onClick={() => setSelectedId(address.id)}
                aria-pressed={selectedId === address.id}
                className={cn(
                  "relative border p-4 text-left transition-colors",
                  selectedId === address.id
                    ? "border-gold bg-cream"
                    : "border-hairline hover:border-ink",
                )}
              >
                {selectedId === address.id ? (
                  <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-gold text-cream">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                ) : null}
                {address.label ? (
                  <p className="text-[0.625rem] uppercase tracking-[0.14em] text-gold">
                    {address.label}
                  </p>
                ) : null}
                <p className="mt-1 text-sm font-medium text-ink">{address.fullName}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  <br />
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  {address.phone}
                </p>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-pressed={!selectedId}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-2 border border-dashed p-4 text-center transition-colors",
                !selectedId
                  ? "border-gold bg-cream text-gold"
                  : "border-hairline text-muted hover:border-ink hover:text-ink",
              )}
            >
              <Plus className="size-4" strokeWidth={1.6} />
              <span className="text-[0.6875rem] uppercase tracking-[0.14em]">
                New address
              </span>
            </button>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {!usingSaved ? (
            <motion.div
              initial={savedAddresses.length ? { height: 0, opacity: 0 } : false}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className={cn("grid gap-5 sm:grid-cols-2", savedAddresses.length && "pt-6")}>
                <Field label="Full name" htmlFor="fullName" required>
                  <Input id="fullName" name="fullName" autoComplete="name" required />
                </Field>
                <Field label="Mobile number" htmlFor="phone" required>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="9876543210"
                    required
                  />
                </Field>
                <Field
                  label="Flat, house, building"
                  htmlFor="line1"
                  className="sm:col-span-2"
                  required
                >
                  <Input id="line1" name="line1" autoComplete="address-line1" required />
                </Field>
                <Field label="Area, street, sector" htmlFor="line2">
                  <Input id="line2" name="line2" autoComplete="address-line2" />
                </Field>
                <Field label="Landmark" htmlFor="landmark">
                  <Input id="landmark" name="landmark" />
                </Field>
                <Field label="City" htmlFor="city" required>
                  <Input id="city" name="city" autoComplete="address-level2" required />
                </Field>
                <Field label="State" htmlFor="state" required>
                  <Select id="state" name="state" defaultValue="" required>
                    <option value="" disabled>
                      Select a state
                    </option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="PIN code" htmlFor="postalCode" required>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="postal-code"
                    required
                  />
                </Field>
              </div>

              {isSignedIn ? (
                <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-sm text-muted">
                  <Checkbox name="saveAddress" defaultChecked />
                  Save this address to my account
                </label>
              ) : null}

              <DeliveryEstimate className="mt-5 border-t border-hairline pt-5" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {usingSaved ? (
          <DeliveryEstimate className="mt-5 border-t border-hairline pt-5" />
        ) : null}
      </section>

      <section>
        <SectionTitle step={3} title="Anything else?" />
        <div className="mt-5 space-y-5">
          <button
            type="button"
            onClick={() => setGiftWrap((value) => !value)}
            aria-pressed={giftWrap}
            className={cn(
              "flex w-full items-center gap-3.5 border p-4 text-left transition-colors",
              giftWrap ? "border-gold bg-cream" : "border-hairline hover:border-ink",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                giftWrap ? "bg-gold text-cream" : "bg-cream-dark text-muted",
              )}
            >
              <Gift className="size-4" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-ink">Wrap it as a gift</span>
              <span className="mt-0.5 block text-xs text-muted">
                Ribboned box with a handwritten card, and no prices on the invoice. Free.
              </span>
            </span>
          </button>

          <Field
            label="Order note"
            htmlFor="customerNote"
            hint="Engraving requests, delivery instructions, a date to hit."
          >
            <Textarea id="customerNote" name="customerNote" rows={3} maxLength={500} />
          </Field>
        </div>
      </section>

      {error ? (
        <p className="border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="lg" disabled={isPending} block>
          {isPending ? <Spinner className="size-4" /> : null}
          Continue to {providerLabel.toLowerCase()}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-light">
          Nothing is charged yet. You will see the amount and pay on the next screen.
        </p>
      </div>
    </form>
  );
}

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 border-b border-hairline pb-3">
      <span className="flex size-6 items-center justify-center rounded-full border border-hairline text-[0.625rem] tabular-nums text-muted">
        {step}
      </span>
      <span className="font-sans text-[0.75rem] font-medium uppercase tracking-[0.16em] text-ink">
        {title}
      </span>
    </h2>
  );
}
