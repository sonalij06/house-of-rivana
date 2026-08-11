"use client";

import { useState } from "react";
import { toast } from "sonner";

type ActionFailure = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Shared admin-form error state: Zod/domain failures land on fields;
 * system failures stay as a banner + toast.
 */
export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function clearErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  function applyFailure(
    result: ActionFailure,
    /** Field names that are actually rendered with `error=` props. */
    wiredFields?: readonly string[],
  ) {
    const fields = result.fieldErrors ?? {};
    const keys = Object.keys(fields);
    const hasFields = keys.length > 0;
    const hasVisibleField =
      hasFields &&
      (wiredFields == null || keys.some((key) => wiredFields.includes(key)));

    setFieldErrors(fields);
    if (hasVisibleField) {
      setFormError(null);
      return;
    }
    // Unwired field keys (or form-level failures) still need a visible message.
    setFormError(result.error);
    toast.error(result.error);
  }

  return { fieldErrors, formError, clearErrors, applyFailure };
}
