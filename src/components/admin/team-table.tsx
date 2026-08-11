"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserBanned, setUserRole } from "@/app/actions/admin-content";
import { DataTable, StatusPill, Td } from "@/components/admin/primitives";
import { Select } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  banned: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

const ROLES = [
  { value: "ADMIN", label: "Administrator" },
  { value: "STAFF", label: "Staff" },
  { value: "CUSTOMER", label: "Customer" },
] as const;

export function TeamTable({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  return (
    <DataTable
      head={["Person", "Access", "Last signed in", "Joined", ""]}
      empty="No accounts yet."
      minWidth="48rem"
    >
      {members.map((member) => (
        <TeamRow
          key={member.id}
          member={member}
          isSelf={member.id === currentUserId}
        />
      ))}
    </DataTable>
  );
}

function TeamRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const [role, setRole] = useState(member.role);
  const [banned, setBanned] = useState(member.banned);
  const [isPending, startTransition] = useTransition();

  function changeRole(next: TeamMember["role"]) {
    const previous = role;
    setRole(next);
    startTransition(async () => {
      const result = await setUserRole({ userId: member.id, role: next });
      if (!result.ok) {
        setRole(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`${member.email} is now ${next.toLowerCase()}.`);
    });
  }

  function toggleBan() {
    const next = !banned;
    setBanned(next);
    startTransition(async () => {
      const result = await setUserBanned({ userId: member.id, banned: next });
      if (!result.ok) {
        setBanned(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Access suspended." : "Access restored.");
    });
  }

  return (
    <tr className={banned ? "opacity-55" : undefined}>
      <Td>
        <span className="block text-ink">
          {member.name || member.email}
          {isSelf ? (
            <span className="ml-2 text-[0.625rem] uppercase tracking-[0.14em] text-gold">
              you
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[0.625rem] text-muted-light">{member.email}</span>
      </Td>
      <Td>
        {isSelf ? (
          <StatusPill status="CONFIRMED" label={role.toLowerCase()} />
        ) : (
          <Select
            value={role}
            disabled={isPending}
            onChange={(event) => changeRole(event.target.value as TeamMember["role"])}
            aria-label={`Role for ${member.email}`}
            className="h-9 w-40 text-sm"
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </Td>
      <Td>
        <span className="text-xs text-muted">
          {member.lastLoginAt ? formatDate(member.lastLoginAt, true) : "never"}
        </span>
      </Td>
      <Td>
        <span className="text-xs text-muted">{formatDate(member.createdAt)}</span>
      </Td>
      <Td align="right">
        {isSelf ? (
          <span className="text-xs text-muted-light">—</span>
        ) : (
          <button
            type="button"
            onClick={toggleBan}
            disabled={isPending}
            className={
              banned
                ? "text-[0.625rem] uppercase tracking-[0.14em] text-gold transition-colors hover:text-ink"
                : "text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-danger"
            }
          >
            {banned ? "Restore" : "Suspend"}
          </button>
        )}
      </Td>
    </tr>
  );
}
