"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { retryNotification } from "@/app/actions/admin-notifications";
import { markContactHandled } from "@/app/actions/admin-content";
import { Spinner } from "@/components/ui/spinner";

export function RetryButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await retryNotification(notificationId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sent again.");
    });
  }

  return (
    <button
      type="button"
      onClick={retry}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
    >
      {isPending ? (
        <Spinner className="size-3" />
      ) : (
        <RotateCcw className="size-3" strokeWidth={1.8} />
      )}
      Retry
    </button>
  );
}

export function HandledToggle({
  messageId,
  isHandled,
}: {
  messageId: string;
  isHandled: boolean;
}) {
  const [handled, setHandled] = useState(isHandled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !handled;
    setHandled(next);
    startTransition(async () => {
      const result = await markContactHandled(messageId);
      if (!result.ok) {
        setHandled(!next);
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={
        handled
          ? "text-[0.625rem] uppercase tracking-[0.14em] text-success transition-colors hover:text-muted"
          : "text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
      }
    >
      {handled ? "Handled" : "Mark handled"}
    </button>
  );
}
