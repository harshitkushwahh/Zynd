export const AUDIT_EVENT_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failure: "Failed sign-in",
  new_device_login: "New device sign-in",
  session_created: "Session created",
  session_revoked: "Session ended",
  logout: "Signed out",
  password_reset_requested: "Password reset requested",
  mfa_enrolled: "MFA enabled",
  mfa_challenge_success: "MFA challenge passed",
  mfa_challenge_failure: "MFA challenge failed",
  backup_code_used: "Backup code used",
  oauth_link_requested: "OAuth link requested",
  oauth_link_confirmed: "OAuth link confirmed",
  oauth_connected: "OAuth connected",
  oauth_disconnected: "OAuth disconnected",
  login_velocity_flagged: "Login velocity flagged",
  sessions_revoked_all: "All sessions ended",
  email_change_requested: "Email change requested",
  email_changed: "Email changed",
  password_changed: "Password changed",
  fund_gate_blocked_mfa: "Fund gate blocked (MFA)",
  fund_gate_blocked_pin: "Fund gate blocked (PIN)",
  fund_gate_blocked_contact: "Fund gate blocked (contact)",
  login_sms_otp_sent: "Login SMS OTP sent",
  login_sms_otp_verified: "Login SMS OTP verified",
  step_up_sms_sent: "Step-up SMS OTP sent",
  step_up_sms_used: "Step-up SMS OTP used",
  refresh_token_reuse_detected: "Refresh token reuse detected",
  account_deletion_requested: "Account deletion requested",
  account_deletion_cancelled: "Account deletion cancelled",
  account_deletion_executed: "Account deletion executed",
  mfa_disabled: "MFA disabled",
  account_suspended: "Account suspended",
  account_unsuspended: "Account reactivated",
  admin_account_removed: "Admin account removed",
  transfer_requested: "Transfer requested",
  admin_action_requested: "Admin action requested",
  admin_action_approved: "Admin action approved",
  admin_action_rejected: "Admin action rejected",
  login_ip_blocked: "Login IP blocked",
  adaptive_auth_blocked: "Adaptive auth blocked",
  pin_set: "PIN set",
  pin_verify_success: "PIN verified",
  pin_verify_failed: "PIN verification failed",
  pin_reset_requested: "PIN reset requested",
  pin_reset: "PIN reset",
  pin_biometric_enrolled: "Biometric enrolled",
  pin_biometric_unlock_success: "Biometric unlock success",
  pin_biometric_unlock_failed: "Biometric unlock failed",
  document_uploaded: "Document uploaded",
  document_scan_passed: "Document scan passed",
  document_scan_failed: "Document scan failed",
  document_quarantined: "Document quarantined",
  document_download_requested: "Document download requested",
  document_viewed_by_admin: "Document viewed by admin",
  document_verified: "Document verified",
  document_legal_hold_updated: "Document legal hold updated",
  document_deleted: "Document deleted",
  document_kyc_rejected: "Document KYC rejected",
  notification_dispatched: "Notification sent",
  notification_push_failed: "Notification push failed",
  mf_fund_catalog_updated: "MF fund catalog updated",
  mf_amc_catalog_updated: "MF AMC catalog updated",
  mf_category_catalog_updated: "MF category catalog updated",
  mf_product_content_updated: "MF product content updated",
  mf_amc_content_updated: "MF AMC content updated",
  mf_compliance_settings_updated: "MF compliance settings updated",
  mf_catalog_rule_created: "MF catalog rule created",
  mf_catalog_rule_updated: "MF catalog rule updated",
  mf_catalog_rules_applied: "MF catalog rules applied",
  risk_template_created: "Risk template created",
  risk_template_updated: "Risk template updated",
  risk_category_created: "Risk category created",
  risk_category_updated: "Risk category updated",
  risk_question_created: "Risk question created",
  risk_question_updated: "Risk question updated",
  risk_question_deleted: "Risk question deleted",
  risk_question_bulk_imported: "Risk questions bulk imported",
  risk_tier_config_updated: "Risk tier config updated",
  risk_profile_completed: "Risk profile completed",
  risk_profile_message_sent: "Risk profile message sent",
  risk_profile_locked: "Risk profile locked",
  risk_profile_unlock_granted: "Risk profile unlock granted",
  mf_catalog_bulk_submitted: "MF catalog bulk submitted",
  mf_catalog_bulk_executed: "MF catalog bulk executed",
  family_group_created: "Family group created",
  family_group_updated: "Family group updated",
  family_group_archived: "Family group archived",
  family_group_invite_sent: "Family group invite sent",
  family_group_invite_accepted: "Family group invite accepted",
  family_group_invite_declined: "Family group invite declined",
  family_group_invite_revoked: "Family group invite revoked",
  family_group_member_role_changed: "Family group member role changed",
  family_group_member_removed: "Family group member removed",
  family_group_member_left: "Family group member left",
  family_group_head_transferred: "Family group head transferred",
  family_group_nominee_kyc_invited: "KYC nominee invited to family group",
  family_group_nominee_kyc_skipped: "KYC nominee family group prompt skipped",
};

export const ADMIN_ACTION_KIND_LABELS: Record<string, string> = {
  admin_invitation_sent: "Admin invitation sent",
  distributor_partner_onboarded: "Zynd Mitra onboarded",
  distributor_partner_approved: "Zynd Mitra approved",
  distributor_partner_rejected: "Zynd Mitra rejected",
  distributor_branch_created: "Branch created",
  distributor_branch_approved: "Branch approved",
  distributor_branch_rejected: "Branch rejected",
  distributor_branch_manager_assigned: "Branch manager assigned",
  mitra_state_head_assigned: "Mitra State Head assigned",
  mitra_state_head_paused: "Mitra State Head paused",
  mitra_state_head_resumed: "Mitra State Head resumed",
  mitra_state_head_unassigned: "Mitra State Head unassigned",
  mitra_state_head_replaced: "Mitra State Head replaced",
  mf_order_synced: "MF order synced",
  mf_sip_plan_synced: "SIP plan synced",
  mf_mandate_synced: "Mandate synced",
  mf_webhook_replayed: "MF webhook replayed",
  mf_stale_checkouts_expired: "Stale checkouts expired",
  mf_pipeline_started: "MF pipeline started",
  mf_pipeline_resumed: "MF pipeline resumed",
  mf_pipeline_paused: "MF pipeline paused",
  mf_pipeline_completed: "MF pipeline completed",
  mf_pipeline_failed: "MF pipeline failed",
  mf_pipeline_cancelled: "MF pipeline cancelled",
};

export const ADMIN_ACTION_TYPE_LABELS: Record<string, string> = {
  account_suspend: "Account suspend requested",
  account_unsuspend: "Account unsuspend requested",
  encryption_rotate_mfa: "MFA encryption rotation requested",
  deletion_executor_run: "Deletion executor run requested",
  security_config_update: "Security config update requested",
  mf_catalog_bulk_apply: "MF catalog bulk apply requested",
  mf_catalog_rules_apply: "MF catalog rules apply requested",
};

export const AUDIT_EVENT_GROUPS = [
  {
    label: "Sign-in & sessions",
    types: [
      "login_success",
      "login_failure",
      "new_device_login",
      "session_created",
      "session_revoked",
      "logout",
      "sessions_revoked_all",
      "oauth_connected",
      "oauth_disconnected",
      "oauth_link_requested",
      "oauth_link_confirmed",
      "login_velocity_flagged",
      "login_ip_blocked",
      "adaptive_auth_blocked",
      "refresh_token_reuse_detected",
    ],
  },
  {
    label: "MFA & PIN",
    types: [
      "mfa_enrolled",
      "mfa_disabled",
      "mfa_challenge_success",
      "mfa_challenge_failure",
      "backup_code_used",
      "fund_gate_blocked_mfa",
      "fund_gate_blocked_pin",
      "fund_gate_blocked_contact",
      "login_sms_otp_sent",
      "login_sms_otp_verified",
      "step_up_sms_sent",
      "step_up_sms_used",
      "pin_set",
      "pin_verify_success",
      "pin_verify_failed",
      "pin_reset_requested",
      "pin_reset",
      "pin_biometric_enrolled",
      "pin_biometric_unlock_success",
      "pin_biometric_unlock_failed",
    ],
  },
  {
    label: "Account",
    types: [
      "account_suspended",
      "account_unsuspended",
      "email_change_requested",
      "email_changed",
      "password_changed",
      "password_reset_requested",
      "account_deletion_requested",
      "account_deletion_cancelled",
      "account_deletion_executed",
      "admin_account_removed",
      "transfer_requested",
    ],
  },
  {
    label: "Documents",
    types: [
      "document_uploaded",
      "document_scan_passed",
      "document_scan_failed",
      "document_quarantined",
      "document_download_requested",
      "document_viewed_by_admin",
      "document_verified",
      "document_legal_hold_updated",
      "document_deleted",
      "document_kyc_rejected",
    ],
  },
  {
    label: "Mutual funds",
    types: [
      "mf_fund_catalog_updated",
      "mf_amc_catalog_updated",
      "mf_category_catalog_updated",
      "mf_product_content_updated",
      "mf_amc_content_updated",
      "mf_compliance_settings_updated",
      "mf_catalog_rule_created",
      "mf_catalog_rule_updated",
      "mf_catalog_rules_applied",
      "mf_catalog_bulk_submitted",
      "mf_catalog_bulk_executed",
    ],
  },
  {
    label: "Transaction requests",
    types: ["transfer_requested"],
  },
  {
    label: "Admin & security",
    types: [
      "admin_action_requested",
      "admin_action_approved",
      "admin_action_rejected",
      "admin_account_removed",
      "account_suspended",
      "account_unsuspended",
    ],
  },
  {
    label: "Notifications",
    types: ["notification_dispatched", "notification_push_failed"],
  },
  {
    label: "Risk profile",
    types: [
      "risk_category_created",
      "risk_category_updated",
      "risk_question_created",
      "risk_question_updated",
      "risk_question_deleted",
      "risk_question_bulk_imported",
      "risk_template_created",
      "risk_template_updated",
      "risk_tier_config_updated",
      "risk_profile_completed",
      "risk_profile_message_sent",
      "risk_profile_locked",
      "risk_profile_unlock_granted",
    ],
  },
  {
    label: "Family groups",
    types: [
      "family_group_created",
      "family_group_updated",
      "family_group_archived",
      "family_group_invite_sent",
      "family_group_invite_accepted",
      "family_group_invite_declined",
      "family_group_invite_revoked",
      "family_group_member_role_changed",
      "family_group_member_removed",
      "family_group_member_left",
      "family_group_head_transferred",
      "family_group_nominee_kyc_invited",
      "family_group_nominee_kyc_skipped",
    ],
  },
] as const;

export const AUDIT_EVENT_TYPES = Array.from(
  new Set(AUDIT_EVENT_GROUPS.flatMap((group) => group.types)),
);

const CUSTOMER_APP_AUDIT_EVENT_PREFIXES = ["document_", "family_group_", "fund_gate_blocked_"] as const;

const CUSTOMER_APP_AUDIT_EVENTS = new Set([
  "risk_profile_completed",
  "risk_profile_message_sent",
  "risk_profile_locked",
  "transfer_requested",
  "notification_dispatched",
  "notification_push_failed",
]);

/** Events relevant to platform admin console journeys (excludes customer-app activity). */
export function isAdminAccountJourneyEvent(eventType: string) {
  if (CUSTOMER_APP_AUDIT_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix))) {
    return false;
  }
  return !CUSTOMER_APP_AUDIT_EVENTS.has(eventType);
}

export const ADMIN_ACCOUNT_JOURNEY_EVENT_GROUPS = AUDIT_EVENT_GROUPS.map((group) => ({
  label: group.label,
  types: group.types.filter((eventType) => isAdminAccountJourneyEvent(eventType)),
})).filter((group) => group.types.length > 0);

export const ADMIN_ACCOUNT_JOURNEY_EVENT_TYPES = Array.from(
  new Set(ADMIN_ACCOUNT_JOURNEY_EVENT_GROUPS.flatMap((group) => group.types)),
);

export function formatAuditEvent(
  eventType: string,
  metadata?: Record<string, unknown> | null,
) {
  if (eventType === "admin_action_requested" && metadata) {
    const kind = metadata.kind;
    if (typeof kind === "string" && ADMIN_ACTION_KIND_LABELS[kind]) {
      return ADMIN_ACTION_KIND_LABELS[kind];
    }
    const actionType = metadata.action_type;
    if (typeof actionType === "string" && ADMIN_ACTION_TYPE_LABELS[actionType]) {
      return ADMIN_ACTION_TYPE_LABELS[actionType];
    }
  }

  return (
    AUDIT_EVENT_LABELS[eventType] ??
    eventType.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}
