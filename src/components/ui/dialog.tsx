"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  hideClose,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}) {
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" }[size];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="overlay-anim fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "panel-anim fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-sm border border-hairline bg-surface shadow-panel",
          width,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-hairline px-6 py-4">
          <div>
            <DialogPrimitive.Title className="font-display text-xl leading-tight text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {!hideClose ? (
            <DialogPrimitive.Close
              className="-mr-1 -mt-1 rounded-xs p-1.5 text-muted transition-colors hover:bg-cream-dark hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          ) : null}
        </div>
        <div className="px-6 py-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Slide-in panel used for the cart and the mobile navigation. */
export function Sheet({
  children,
  title,
  description,
  side = "right",
  className,
  footer,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  side?: "left" | "right";
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="overlay-anim fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-panel",
          side === "right"
            ? "sheet-right right-0 border-l border-hairline"
            : "sheet-left left-0 border-r border-hairline",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-hairline px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-[0.8125rem] font-medium uppercase tracking-[0.16em] text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="-mr-1 rounded-xs p-1.5 text-muted transition-colors hover:bg-cream-dark hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="border-t border-hairline px-5 py-4">{footer}</div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("mt-6 flex flex-wrap justify-end gap-3", className)}
      {...props}
    />
  );
}
