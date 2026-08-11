import type { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";

export type FieldErrors = Record<string, string>;

export type ActionFailure = {
  ok: false;
  error: string;
  fieldErrors?: FieldErrors;
};

/** Map every Zod issue onto its first path segment for inline field display. */
export function failZod(error: ZodError): ActionFailure {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && fieldErrors[key] == null) {
      fieldErrors[key] = issue.message;
    }
  }
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Please fix the highlighted fields.",
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

export function failField(field: string, message: string): ActionFailure {
  return { ok: false, error: message, fieldErrors: { [field]: message } };
}

export function failMessage(message: string): ActionFailure {
  return { ok: false, error: message };
}

/**
 * Turn unexpected write failures (unique races, FK, etc.) into ActionResult
 * instead of letting the server action throw a generic "error saving" overlay.
 */
export function failWrite(
  err: unknown,
  uniqueMessages: Record<string, string> = {},
): ActionFailure {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = Array.isArray(err.meta?.target)
      ? String(err.meta.target[0] ?? "")
      : "";
    if (target && uniqueMessages[target]) {
      return failField(target, uniqueMessages[target]);
    }
    return failMessage("That value is already in use.");
  }

  console.error(err);
  return failMessage("Could not save the record. Please try again.");
}
