"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTicketsForUser } from "@/lib/dummy/tickets";
import { DUMMY_USERS, type SupportEndUser } from "@/lib/dummy/users";
import { formatSupportDate, formatSupportDateTime } from "@/lib/format";
import { kycStatusVariant, labelize, ticketStatusVariant } from "@/lib/status-meta";

export function SupportUsersPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DUMMY_USERS;
    return DUMMY_USERS.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phone.includes(q) ||
        user.city.toLowerCase().includes(q),
    );
  }, [query]);

  const selected =
    filtered.find((user) => user.id === selectedId) ??
    DUMMY_USERS.find((user) => user.id === selectedId) ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-semibold text-foreground">Users</h1>
        <p className="mt-1 text-caption text-muted-foreground">
          End-user directory for support lookup (dummy data).
        </p>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, email, phone, or city…"
        className="sm:max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-compact">
              <thead className="border-b border-border bg-muted/30 text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">KYC</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Open tickets</th>
                  <th className="px-4 py-3 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30"
                    onClick={() => setSelectedId(user.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-caption text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={kycStatusVariant(user.kycStatus)} showIcon={false}>
                        {labelize(user.kycStatus)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.city}</td>
                    <td className="px-4 py-3 tabular-nums">{user.openTickets}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatSupportDateTime(user.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <UserDetailSheet
        user={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}

function UserDetailSheet({
  user,
  open,
  onOpenChange,
}: {
  user: SupportEndUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tickets = user ? getTicketsForUser(user.id) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {user ? (
          <div className="flex h-full flex-col gap-4 overflow-y-auto p-1">
            <SheetHeader className="px-0">
              <SheetTitle className="pr-8 text-left">{user.name}</SheetTitle>
              <SheetDescription className="text-left">{user.email}</SheetDescription>
            </SheetHeader>

            <div className="grid gap-2 text-compact">
              <DetailRow label="Phone" value={user.phone} />
              <DetailRow label="City" value={user.city} />
              <DetailRow label="Joined" value={formatSupportDate(user.joinedAt)} />
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border px-3 py-2">
                <span className="text-muted-foreground">KYC</span>
                <StatusBadge variant={kycStatusVariant(user.kycStatus)} showIcon={false}>
                  {labelize(user.kycStatus)}
                </StatusBadge>
              </div>
            </div>

            <div>
              <p className="mb-2 text-caption font-medium text-foreground">Recent tickets</p>
              <div className="space-y-2">
                {tickets.length === 0 ? (
                  <p className="text-caption text-muted-foreground">No tickets for this user.</p>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-[var(--radius-card)] border border-border px-3 py-2"
                    >
                      <p className="text-compact font-medium">{ticket.subject}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-caption text-muted-foreground">{ticket.id}</span>
                        <StatusBadge variant={ticketStatusVariant(ticket.status)} showIcon={false}>
                          {labelize(ticket.status)}
                        </StatusBadge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
