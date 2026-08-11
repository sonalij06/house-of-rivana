"use client";

import { Children, cloneElement, isValidElement } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-xs border bg-surface px-3.5 py-2.5 text-[0.9375rem] text-ink transition-colors duration-200 placeholder:text-muted-light focus:outline-none focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30 disabled:cursor-not-allowed disabled:bg-cream-dark disabled:text-muted aria-invalid:border-danger";

export function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
  required?: boolean;
}) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "mb-1.5 block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted",
        className,
      )}
      {...props}
    >
      {children}
      {required ? <span className="ml-1 text-danger">*</span> : null}
    </LabelPrimitive.Root>
  );
}

export function Input({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cn(controlBase, "border-hairline h-11 py-0", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "border-hairline min-h-24 resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        controlBase,
        "border-hairline h-11 cursor-pointer appearance-none bg-[length:14px] bg-[position:right_0.9rem_center] bg-no-repeat py-0 pr-10",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

/** Label + control + error message, so forms stay consistent and accessible. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {Children.map(children, (child) => {
        if (!isValidElement<{ "aria-invalid"?: boolean | "true" | "false" }>(child)) {
          return child;
        }
        return cloneElement(child, {
          "aria-invalid": error ? true : child.props["aria-invalid"],
        });
      })}
      {hint && !error ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer appearance-none rounded-[2px] border border-hairline bg-surface transition-colors checked:border-gold checked:bg-gold",
        "checked:bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22%3E%3Cpath d=%22M20 6 9 17l-5-5%22/%3E%3C/svg%3E')] checked:bg-[length:12px] checked:bg-center checked:bg-no-repeat",
        className,
      )}
      {...props}
    />
  );
}
