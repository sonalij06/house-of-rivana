"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitReview } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export type ReviewablePiece = {
  productId: string;
  productName: string;
  productSlug: string;
  orderId: string;
  orderNumber: string;
  alreadyReviewed: boolean;
};

export function ReviewForm({
  pieces,
  initialProductSlug,
}: {
  pieces: ReviewablePiece[];
  initialProductSlug?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const eligible = pieces.filter((p) => !p.alreadyReviewed);
  const defaultPiece =
    eligible.find((p) => p.productSlug === initialProductSlug) ?? eligible[0];
  const [productId, setProductId] = useState(defaultPiece?.productId ?? "");
  const [rating, setRating] = useState(5);

  if (eligible.length === 0) {
    return (
      <p className="text-sm text-muted">
        You have already reviewed every delivered piece, or none are eligible yet.
        Reviews open once an order is marked delivered.
      </p>
    );
  }

  const selected = eligible.find((p) => p.productId === productId) ?? eligible[0];

  return (
    <form
      className="space-y-4 border border-hairline bg-surface p-5 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          const result = await submitReview(data);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Thank you — your review is awaiting a quick check.");
          form.reset();
          setRating(5);
          router.refresh();
        });
      }}
    >
      <p className="font-display text-xl text-ink">Write a review</p>
      <p className="text-sm text-muted">
        Only verified purchases can be reviewed. Photos are optional and help
        the next person.
      </p>

      <Field label="Piece" htmlFor="productId" required>
        <select
          id="productId"
          name="productId"
          required
          value={productId || selected.productId}
          onChange={(event) => setProductId(event.target.value)}
          className="h-11 w-full rounded-xs border border-hairline bg-surface px-3.5 text-[0.9375rem] text-ink outline-none focus:border-gold"
        >
          {eligible.map((piece) => (
            <option key={`${piece.orderId}-${piece.productId}`} value={piece.productId}>
              {piece.productName} · {piece.orderNumber}
            </option>
          ))}
        </select>
      </Field>

      <input type="hidden" name="orderId" value={selected.orderId} />

      <fieldset>
        <legend className="mb-1.5 block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted">
          Rating <span className="text-danger">*</span>
        </legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`size-10 border text-sm tabular-nums transition-colors ${
                value <= rating
                  ? "border-gold bg-gold text-cream"
                  : "border-hairline text-muted hover:border-champagne"
              }`}
              aria-label={`${value} stars`}
              aria-pressed={value <= rating}
            >
              {value}
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </fieldset>

      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" maxLength={80} placeholder="Light, lovely, daily wear" />
      </Field>

      <Field label="Your review" htmlFor="body" required>
        <Textarea
          id="body"
          name="body"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          placeholder="How does it feel day to day? Colour, weight, finish…"
        />
      </Field>

      <Field
        label="Photo"
        htmlFor="photo"
        hint="Optional JPEG, PNG or WebP under 5 MB."
      >
        <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </Field>

      <Button type="submit" disabled={pending}>
        Submit review
      </Button>
    </form>
  );
}
