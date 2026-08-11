import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  phone?: string | null;
  emailVerified: boolean;
};

/**
 * Cached per request so a page can call this in the layout, the page and three
 * components without three round trips.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as unknown as SessionUser & { banned?: boolean };
  if (user.banned) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: (user.role ?? "CUSTOMER") as SessionUser["role"],
    phone: user.phone ?? null,
    emailVerified: Boolean(user.emailVerified),
  };
});

export async function requireUser(redirectTo = "/account") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

export function isStaff(user: SessionUser | null) {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

/**
 * Every admin page and every admin server action calls this. Middleware alone is
 * not a security boundary — it can be bypassed by hitting an action directly.
 */
export async function requireStaff(redirectTo = "/admin") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/admin/login?next=${encodeURIComponent(redirectTo)}`);
  }
  if (!isStaff(user)) {
    redirect("/admin/login?error=forbidden");
  }
  return user;
}

/** For destructive operations that staff should not perform. */
export async function requireAdmin(redirectTo = "/admin") {
  const user = await requireStaff(redirectTo);
  if (user.role !== "ADMIN") {
    redirect("/admin?error=admin-only");
  }
  return user;
}

/** Server-action variant: throws instead of redirecting, so we can toast. */
export async function assertStaff() {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) {
    throw new Error("Not authorised");
  }
  return user;
}

export async function assertAdmin() {
  const user = await assertStaff();
  if (user.role !== "ADMIN") {
    throw new Error("This action requires an administrator");
  }
  return user;
}

export async function recordAudit(input: {
  actor: SessionUser;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  await prisma.adminAuditLog.create({
    data: {
      userId: input.actor.id,
      actorEmail: input.actor.email,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      ipAddress: ip,
    },
  });
}
