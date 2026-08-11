"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertStaff, recordAudit } from "@/lib/session";
import { resendOrderNotification } from "@/lib/order-service";
import type { ActionResult } from "@/app/actions/cart";

/**
 * Rebuilds the template from the order rather than replaying a stored body, so a
 * retry always reflects the order as it is now.
 */
export async function retryNotification(
  notificationId: string,
): Promise<ActionResult<{ template: string }>> {
  const actor = await assertStaff();

  const record = await prisma.notificationLog.findUnique({
    where: { id: notificationId },
    select: { template: true, orderId: true, recipient: true, channel: true },
  });
  if (!record) return { ok: false, error: "That message no longer exists." };
  if (!record.orderId) {
    return { ok: false, error: "This message is not tied to an order, so it cannot be rebuilt." };
  }

  const result = await resendOrderNotification(record.orderId, record.template);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    actor,
    action: "notification.retry",
    entity: "NotificationLog",
    entityId: notificationId,
    after: { template: record.template, recipient: record.recipient },
  });

  revalidatePath("/admin/notifications");
  return { ok: true, data: { template: record.template } };
}
