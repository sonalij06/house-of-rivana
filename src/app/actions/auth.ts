"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "@/app/actions/cart";

/**
 * Called from the client immediately after a successful sign-in or sign-up.
 * Better Auth owns the credential flow; this handles the commerce side effects it
 * cannot know about — folding the guest cart in and stamping the login time.
 */
export async function completeSignIn(): Promise<ActionResult<{ role: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Session not found." };

  await mergeGuestCartIntoUser(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { role: user.role } };
}
