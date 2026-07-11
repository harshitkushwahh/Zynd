export function downloadBackupCodesJson(codes: string[], email?: string | null) {
  const payload = {
    type: "zynd_mfa_backup_codes",
    email: email ?? undefined,
    generated_at: new Date().toISOString(),
    backup_codes: codes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "zynd-mfa-backup-codes.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
