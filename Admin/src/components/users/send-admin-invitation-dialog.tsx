"use client";

import { useEffect, useState } from "react";
import { Mail, UserPlus } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AdminRole } from "@/lib/admin-api";

export function SendAdminInvitationDialog({
  open,
  roles,
  saving,
  error,
  onClose,
  onSend,
}: {
  open: boolean;
  roles: AdminRole[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSend: (payload: {
    email: string;
    first_name?: string;
    last_name?: string;
    role_key: string;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleKey, setRoleKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setFirstName("");
    setLastName("");
    setRoleKey(roles[0]?.key ?? "");
  }, [open, roles]);

  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="Send admin invitation"
      description="We'll email a secure link to set up their password, MFA, and console PIN."
      icon={UserPlus}
      iconTone="info"
      size="md"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel="Send invitation"
          confirmIcon={Mail}
          loading={saving}
          loadingLabel="Sending…"
          confirmDisabled={!email.trim() || !roleKey}
          onCancel={onClose}
          onConfirm={() =>
            onSend({
              email: email.trim(),
              first_name: firstName.trim() || undefined,
              last_name: lastName.trim() || undefined,
              role_key: roleKey,
            })
          }
        />
      }
    >
      <div className="space-y-4">
        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

        <div className="space-y-2">
          <Label htmlFor="invite-email">Work email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="ops@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invite-first-name">First name (optional)</Label>
            <Input
              id="invite-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-last-name">Last name (optional)</Label>
            <Input
              id="invite-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-role">Team role</Label>
          <Select value={roleKey} onValueChange={(value) => setRoleKey(value ?? "")}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue placeholder="Choose team role">
                {roles.find((role) => role.key === roleKey)?.name ?? "Choose team role"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </AdminFormDialog>
  );
}
