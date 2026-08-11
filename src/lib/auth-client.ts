"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/**
 * Prefer the page origin so login works on both localhost and 127.0.0.1.
 * A hardcoded NEXT_PUBLIC_APP_URL that mismatches the address bar breaks cookies.
 */
function authBaseURL() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? undefined;
}

export const authClient = createAuthClient({
  baseURL: authBaseURL(),
  // Type-only import of the server instance, so `phone` and `marketingOptIn` are
  // typed on signUp/updateUser without pulling Prisma into the client bundle.
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  updateUser,
  changePassword,
} = authClient;
