import type { Metadata } from "next";
import { AdminHeader, Panel } from "@/components/admin/primitives";
import { TeamTable } from "@/components/admin/team-table";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Team" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requireAdmin("/admin/users");
  const { q = "" } = await searchParams;
  const query = q.trim();

  // The list is about access, so customers only appear once promoted — or when
  // searched for by email, which is how you promote someone in the first place.
  const members = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : { OR: [{ role: { in: ["ADMIN", "STAFF"] } }, { banned: true }] },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <>
      <AdminHeader
        title="Team"
        description="Administrators can change settings, payment providers and roles. Staff can run the shop but not reconfigure it."
      />

      <div className="mb-4 flex justify-end">
        <form action="/admin/users">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Find an account by email…"
            aria-label="Search accounts"
            className="h-9 w-64 rounded-xs border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted-light focus:border-gold focus:outline-none"
          />
        </form>
      </div>

      <Panel padded={false}>
        <TeamTable members={members} currentUserId={actor.id} />
      </Panel>

      <Panel title="How to add someone" className="mt-5">
        <ol className="space-y-2.5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-ink">1.</strong> Ask them to register at{" "}
            <span className="font-mono text-[0.8125rem] text-ink">/register</span> with the
            email they will use.
          </li>
          <li>
            <strong className="text-ink">2.</strong> Search for them on the customers screen
            to confirm the account exists.
          </li>
          <li>
            <strong className="text-ink">3.</strong> Promote them here once the account shows
            up — a promoted account appears in this list immediately.
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-light">
          Suspending an account also ends every live session, so access is revoked at once.
        </p>
      </Panel>
    </>
  );
}
