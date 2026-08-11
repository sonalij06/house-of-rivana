import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, DataTable, Panel, StatCard, StatusPill, Td } from "@/components/admin/primitives";
import { HandledToggle, RetryButton } from "@/components/admin/notification-actions";
import { prisma } from "@/lib/db";
import { features } from "@/lib/env";
import { requireStaff } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

const TEMPLATE_COPY: Record<string, string> = {
  "order-received": "Order received",
  "payment-verified": "Payment verified",
  "payment-rejected": "Payment declined",
  "order-shipped": "Shipped",
  "order-delivered": "Delivered",
  "order-cancelled": "Cancelled",
  "refund-issued": "Refund issued",
  "review-request": "Review request",
  "password-reset": "Password reset",
  "verify-email": "Email verification",
  "contact-receipt": "Contact receipt",
};

export default async function AdminNotificationsPage() {
  await requireStaff("/admin/notifications");

  const [logs, counts, messages] = await Promise.all([
    prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        channel: true,
        template: true,
        recipient: true,
        subject: true,
        status: true,
        error: true,
        attempts: true,
        sentAt: true,
        createdAt: true,
        order: { select: { id: true, orderNumber: true } },
      },
    }),
    prisma.notificationLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.contactMessage.findMany({
      orderBy: [{ isHandled: "asc" }, { createdAt: "desc" }],
      take: 30,
    }),
  ]);

  const countByStatus = new Map(counts.map((row) => [row.status as string, row._count._all]));
  const openMessages = messages.filter((message) => !message.isHandled).length;

  return (
    <>
      <AdminHeader
        title="Messages"
        description="Everything the shop has tried to send, plus enquiries from the contact form."
      />

      {!features.email || !features.whatsapp ? (
        <div className="mb-5 border border-warning/30 bg-warning-soft px-5 py-3.5 text-sm text-warning">
          {!features.email && !features.whatsapp
            ? "Neither email nor WhatsApp is configured, so messages are logged as skipped."
            : !features.email
              ? "Email is not configured (RESEND_API_KEY), so email is logged as skipped."
              : "WhatsApp is not configured, so those messages fall back to a click-to-chat link on the order."}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sent" value={String(countByStatus.get("SENT") ?? 0)} />
        <StatCard
          label="Failed"
          value={String(countByStatus.get("FAILED") ?? 0)}
          tone={(countByStatus.get("FAILED") ?? 0) > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Skipped"
          value={String(countByStatus.get("SKIPPED") ?? 0)}
          hint="Channel not configured"
        />
        <StatCard
          label="Enquiries open"
          value={String(openMessages)}
          tone={openMessages > 0 ? "gold" : "neutral"}
        />
      </div>

      <Panel title="Outbound" padded={false} className="mb-5">
        <DataTable
          head={["When", "To", "Message", "Order", "Status"]}
          empty="Nothing has been sent yet."
          minWidth="56rem"
        >
          {logs.map((log) => (
            <tr key={log.id}>
              <Td>
                <span className="whitespace-nowrap text-xs text-muted">
                  {formatDate(log.createdAt, true)}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-ink">{log.recipient}</span>
                <span className="mt-0.5 block text-[0.5625rem] uppercase tracking-[0.14em] text-muted-light">
                  {log.channel === "EMAIL" ? "email" : "whatsapp"}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-ink">
                  {TEMPLATE_COPY[log.template] ?? log.template}
                </span>
                {log.error ? (
                  <span className="mt-0.5 block text-[0.625rem] text-danger">{log.error}</span>
                ) : log.subject ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {log.subject}
                  </span>
                ) : null}
              </Td>
              <Td>
                {log.order ? (
                  <Link
                    href={`/admin/orders/${log.order.id}`}
                    className="font-mono text-[0.6875rem] text-muted underline-offset-4 hover:text-gold hover:underline"
                  >
                    {log.order.orderNumber}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-light">—</span>
                )}
              </Td>
              <Td align="right">
                <span className="inline-flex items-center gap-2.5">
                  <StatusPill status={log.status} />
                  {log.status !== "SENT" && log.channel === "EMAIL" && log.order ? (
                    <RetryButton notificationId={log.id} />
                  ) : null}
                </span>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title="Contact form" padded={false}>
        <DataTable
          head={["When", "From", "Message", ""]}
          empty="No enquiries yet."
          minWidth="46rem"
        >
          {messages.map((message) => (
            <tr key={message.id} className={message.isHandled ? "opacity-55" : undefined}>
              <Td>
                <span className="whitespace-nowrap text-xs text-muted">
                  {formatDate(message.createdAt, true)}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-ink">{message.name}</span>
                <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                  <a
                    href={`mailto:${message.email}`}
                    className="underline-offset-4 hover:text-gold hover:underline"
                  >
                    {message.email}
                  </a>
                  {message.phone ? ` · ${message.phone}` : ""}
                </span>
              </Td>
              <Td>
                {message.subject ? (
                  <span className="block text-xs text-ink">{message.subject}</span>
                ) : null}
                <span className="mt-0.5 block max-w-lg text-[0.6875rem] leading-relaxed text-muted">
                  {message.message}
                </span>
              </Td>
              <Td align="right">
                <HandledToggle messageId={message.id} isHandled={message.isHandled} />
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
