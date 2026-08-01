"use client";

import { useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export function DistributorChangePasswordSettingsPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      if (env.useBackendClients) {
        setError(ZYND_MITRA_COPY.passwordNotWired);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated in demo mode (no server call).");
    }, 400);
  };

  return (
    <form className="w-full max-w-md space-y-5" onSubmit={handleSubmit}>
      {error ? <p className="text-compact text-destructive">{error}</p> : null}
      {message ? <p className="text-compact text-primary">{message}</p> : null}

      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>
      <DistributorActionButton type="submit" variant="primary" disabled={loading}>
        {loading ? "Updating…" : "Update password"}
      </DistributorActionButton>
    </form>
  );
}
