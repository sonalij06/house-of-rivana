"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteReview, moderateReview } from "@/app/actions/admin-marketing";
import { StatusPill } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatDate } from "@/lib/utils";

export type ModerationReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  imageUrls: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  isVerifiedPurchase: boolean;
  moderationNote: string | null;
  createdAt: Date;
  product: { name: string; slug: string };
  orderNumber: string | null;
  userEmail: string | null;
};

export function ReviewCard({ review }: { review: ModerationReview }) {
  const [note, setNote] = useState(review.moderationNote ?? "");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function moderate(action: "APPROVE" | "REJECT") {
    setPendingAction(action);
    startTransition(async () => {
      const result = await moderateReview({ reviewId: review.id, action, note });
      setPendingAction(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(action === "APPROVE" ? "Published." : "Rejected.");
    });
  }

  function remove() {
    setPendingAction("DELETE");
    startTransition(async () => {
      const result = await deleteReview(review.id);
      setPendingAction(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Review deleted.");
    });
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-hairline bg-surface p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Stars rating={review.rating} />
            {review.isVerifiedPurchase ? (
              <StatusPill status="CONFIRMED" label="verified buyer" />
            ) : null}
            {review.status !== "PENDING" ? <StatusPill status={review.status} /> : null}
          </div>
          <p className="mt-2 text-sm text-ink">
            {review.title ? <strong className="font-normal">{review.title}</strong> : null}
          </p>
        </div>
        <div className="text-right text-[0.625rem] text-muted-light">
          <Link
            href={`/product/${review.product.slug}`}
            target="_blank"
            className="block text-xs text-muted underline-offset-4 hover:text-gold hover:underline"
          >
            {review.product.name}
          </Link>
          {formatDate(review.createdAt, true)}
        </div>
      </header>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
        {review.body}
      </p>

      {review.imageUrls.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {review.imageUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="relative size-20 overflow-hidden border border-hairline bg-cream-dark"
            >
              <SafeImage
                src={url}
                alt="Customer photograph"
                fill
                sizes="80px"
                className="object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      <footer className="mt-4 border-t border-hairline pt-4">
        <p className="mb-3 text-[0.625rem] uppercase tracking-[0.14em] text-muted-light">
          {review.authorName}
          {review.userEmail ? ` · ${review.userEmail}` : " · guest"}
          {review.orderNumber ? ` · ${review.orderNumber}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Internal note (optional)"
            aria-label="Moderation note"
            className="h-9 flex-1 min-w-48 text-sm"
          />
          {review.status !== "APPROVED" ? (
            <Button
              size="sm"
              onClick={() => moderate("APPROVE")}
              disabled={pendingAction !== null}
            >
              {pendingAction === "APPROVE" ? (
                <Spinner className="size-3.5" />
              ) : (
                <Check className="size-3.5" strokeWidth={2} />
              )}
              Publish
            </Button>
          ) : null}
          {review.status !== "REJECTED" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => moderate("REJECT")}
              disabled={pendingAction !== null}
            >
              <X className="size-3.5" strokeWidth={2} />
              Reject
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={pendingAction !== null}
            aria-label="Delete review"
          >
            <Trash2 className="size-3.5" strokeWidth={1.6} />
          </Button>
        </div>
      </footer>
    </motion.article>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            "size-3.5",
            value <= rating ? "fill-gold text-gold" : "text-hairline",
          )}
          strokeWidth={1.4}
        />
      ))}
    </span>
  );
}
