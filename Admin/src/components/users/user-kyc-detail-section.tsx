"use client";

import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Building2,
  Check,
  Circle,
  CircleDashed,
  ClipboardCheck,
  FileImage,
  FileText,
  Fingerprint,
  Landmark,
  MapPin,
  PenLine,
  ShieldCheck,
  UserRound,
  Users,
  X,
  Route,
  Wallet,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchAdminDocumentDownload,
  rejectAdminKycDocument,
  verifyAdminDocument,
  verifyAdminUserKycDocuments,
  type AdminUserKycDetail,
  type AdminUserKycPan,
  type AdminUserKycPersonal,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";
import {
  documentReviewStatusVariant,
  kycOverallStatusVariant,
  kycStepStatusVariant,
} from "@/components/users/user-status-badge";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";
import { cn } from "@/lib/utils";

const KYC_STEPS = [
  { key: "pan", label: "PAN verification", shortLabel: "PAN", icon: Fingerprint },
  { key: "digilocker", label: "DigiLocker", shortLabel: "DigiLocker", icon: ShieldCheck },
  { key: "address", label: "Address", shortLabel: "Address", icon: MapPin },
  { key: "personal", label: "Personal details", shortLabel: "Personal", icon: UserRound },
  { key: "nominee", label: "Nominee", shortLabel: "Nominee", icon: Users },
  { key: "bank", label: "Bank account", shortLabel: "Bank", icon: Landmark },
  { key: "signature", label: "Signature", shortLabel: "Signature", icon: PenLine },
  { key: "review", label: "Review & submit", shortLabel: "Review", icon: ClipboardCheck },
] as const;

const KYC_NAV_ITEMS = [
  { value: "journey", label: "Journey", icon: Route },
  { value: "identity", label: "Identity", icon: Fingerprint },
  { value: "banking", label: "Banking & nominees", icon: Wallet },
  { value: "documents", label: "Documents", icon: FileText },
] as const;

const COMPLETED_STEP_STATUSES = new Set(["verified", "completed", "skipped"]);

const OVERALL_STATUS_LABELS: Record<string, string> = {
  none: "Not started",
  in_progress: "In progress",
  phase1_complete: "Phase 1 complete",
  phase2_complete: "Phase 2 complete",
  submitted: "Submitted for review",
  completed: "Completed",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN card",
  profile_image: "Profile photo",
  bank_statement: "Bank statement",
  signature: "Signature",
  address_proof: "Address proof",
  nominee_id: "Nominee ID",
};


function formatOverallStatus(status: string) {
  return OVERALL_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function formatStepStatus(status: string) {
  return status.replaceAll("_", " ");
}

function stepTone(status: string) {
  if (COMPLETED_STEP_STATUSES.has(status)) {
    return {
      ring: "ring-success/30",
      bg: "bg-success/10",
      text: "text-success",
      icon: Check,
    };
  }
  if (status === "failed") {
    return {
      ring: "ring-destructive/30",
      bg: "bg-destructive/10",
      text: "text-destructive",
      icon: X,
    };
  }
  if (status === "saved") {
    return {
      ring: "ring-primary/30",
      bg: "bg-primary/10",
      text: "text-primary",
      icon: CircleDashed,
    };
  }
  return {
    ring: "ring-border",
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    icon: Circle,
  };
}

function hasPanData(pan: AdminUserKycPan | null | undefined) {
  return Boolean(pan?.pan_last4 || pan?.full_name || pan?.date_of_birth || pan?.pan_category);
}

function hasPersonalData(personal: AdminUserKycPersonal | null | undefined) {
  if (!personal) return false;
  return Object.values(personal).some((value) => value != null && value !== "");
}

function hasAddressData(kyc: AdminUserKycDetail) {
  return Boolean(
    kyc.address?.permanent?.line1 ||
      kyc.address?.correspondence?.line1 ||
      kyc.investor_addresses.length > 0,
  );
}

function hasBankData(kyc: AdminUserKycDetail) {
  return Boolean(
    kyc.bank_draft?.account_number_last4 ||
      kyc.bank_draft?.ifsc_code ||
      kyc.bank_accounts.length > 0,
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/20 bg-success/5"
      : tone === "warning"
        ? "border-warning/20 bg-warning/5"
        : tone === "muted"
          ? "border-border bg-muted/20"
          : "border-border bg-background";

  return (
    <div className={cn("rounded-[var(--radius-card)] border px-4 py-3", toneClass)}>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="mt-1 text-compact font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="shrink-0 text-caption text-muted-foreground">{label}</span>
      <span className="text-compact font-medium text-foreground sm:text-right">{value}</span>
    </div>
  );
}

function DetailPanel({
  title,
  description,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <div className="flex items-start gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className="rounded-[var(--radius-control)] bg-background p-2 text-primary ring-1 ring-border">
          <Icon className="size-4" />
        </div>
        <div>
          <h4 className={PROFILE_SECTION_TITLE_CLASS}>{title}</h4>
          <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="px-4 py-1">{empty ?? children}</div>
    </section>
  );
}

function SectionEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className={cn("mt-3", PROFILE_SECTION_TITLE_CLASS)}>{title}</p>
      <p className="mt-1 max-w-sm text-caption text-muted-foreground">{description}</p>
    </div>
  );
}

function formatAddressLines(
  block: {
    line1?: string | null;
    line2?: string | null;
    line3?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null | undefined,
) {
  if (!block?.line1) return null;
  return [
    block.line1,
    block.line2,
    block.line3,
    [block.city, block.state, block.pincode ?? block.postal_code].filter(Boolean).join(", "),
    block.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function JourneyStepItem({
  step,
  status,
  showConnector,
}: {
  step: KycJourneyStep;
  status: string;
  showConnector: boolean;
}) {
  const tone = stepTone(status);
  const StepIcon = step.icon;

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {showConnector ? (
        <span
          className={cn(
            "absolute top-10 left-5 h-[calc(100%-2rem)] w-px -translate-x-1/2",
            COMPLETED_STEP_STATUSES.has(status) ? "bg-success/40" : "bg-border",
          )}
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ring-2",
          tone.ring,
          tone.bg,
        )}
      >
        <StepIcon className={cn("size-4", tone.text)} />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{step.label}</p>
          <StatusBadge variant={kycStepStatusVariant(status)} icon={tone.icon}>
            {formatStepStatus(status)}
          </StatusBadge>
        </div>
        <p className="mt-1 text-caption text-muted-foreground">
          {COMPLETED_STEP_STATUSES.has(status)
            ? "This step is complete."
            : status === "saved"
              ? "Customer saved a draft for this step."
              : status === "failed"
                ? "This step needs attention before KYC can continue."
                : "Waiting for the customer to complete this step."}
        </p>
      </div>
    </li>
  );
}

type KycJourneyStep = (typeof KYC_STEPS)[number];

function JourneyColumn({
  steps,
  kyc,
}: {
  steps: readonly KycJourneyStep[];
  kyc: AdminUserKycDetail;
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => (
        <JourneyStepItem
          key={step.key}
          step={step}
          status={kyc.step_statuses[step.key] ?? "pending"}
          showConnector={index < steps.length - 1}
        />
      ))}
    </ol>
  );
}

export function UserKycDetailSection({
  kyc,
  userId,
  hasDownload,
  hasVerify,
  onChanged,
}: {
  kyc: AdminUserKycDetail;
  userId: string;
  hasDownload: boolean;
  hasVerify: boolean;
  onChanged?: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const completedSteps = useMemo(
    () =>
      KYC_STEPS.filter((step) =>
        COMPLETED_STEP_STATUSES.has(kyc.step_statuses[step.key] ?? "pending"),
      ).length,
    [kyc.step_statuses],
  );

  const progressPercent = Math.round((completedSteps / KYC_STEPS.length) * 100);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedProgress(progressPercent));
    return () => cancelAnimationFrame(frame);
  }, [progressPercent]);

  const isNotStarted = kyc.overall_status === "none" && completedSteps === 0;
  const currentStep = useMemo(() => {
    const firstIncomplete = KYC_STEPS.find(
      (step) => !COMPLETED_STEP_STATUSES.has(kyc.step_statuses[step.key] ?? "pending"),
    );
    return firstIncomplete ?? KYC_STEPS[KYC_STEPS.length - 1];
  }, [kyc.step_statuses]);

  const signatureDocumentId =
    kyc.signature_document_id ??
    kyc.documents.find((document) => document.doc_type === "signature")?.id ??
    null;

  const journeyLeftSteps = KYC_STEPS.slice(0, 4);
  const journeyRightSteps = KYC_STEPS.slice(4);

  const handlePreview = async (documentId: string) => {
    if (!hasDownload) return;
    setActionLoading(`preview-${documentId}`);
    setError("");
    try {
      const payload = await fetchAdminDocumentDownload(documentId);
      window.open(payload.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(getErrorMessage(err, "Could not open document."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async (documentId: string) => {
    if (!hasVerify) return;
    setActionLoading(`verify-${documentId}`);
    setError("");
    try {
      await verifyAdminDocument(documentId);
      setMessage("Document verified.");
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not verify document."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (documentId: string) => {
    if (!hasVerify) return;
    setActionLoading(`reject-${documentId}`);
    setError("");
    try {
      await rejectAdminKycDocument(documentId, "Rejected during user profile review");
      setMessage("Document rejected.");
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reject document."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!hasVerify) return;
    setActionLoading("verify-all");
    setError("");
    try {
      const result = await verifyAdminUserKycDocuments(userId);
      setMessage(`Verified ${result.verified_count} documents.`);
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not verify KYC documents."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted/20">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={PROFILE_SECTION_TITLE_CLASS}>KYC verification</h3>
              <StatusBadge variant={kycOverallStatusVariant(kyc.overall_status)}>
                {formatOverallStatus(kyc.overall_status)}
              </StatusBadge>
            </div>
            <p className="mt-1 text-compact text-muted-foreground">
              {isNotStarted
                ? "This customer has not started their KYC journey yet."
                : `Currently on ${currentStep.label.toLowerCase()}.`}
              {kyc.last_completed_step
                ? ` Last completed step: ${kyc.last_completed_step.replaceAll("_", " ")}.`
                : ""}
            </p>
          </div>
          <div className="w-full min-w-kyc-progress lg:max-w-xs">
            <div className="flex items-center justify-between text-caption text-muted-foreground">
              <span>Progress</span>
              <span>
                {completedSteps}/{KYC_STEPS.length} steps
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-progress ease-out"
                style={{ width: `${animatedProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          <StatCard
            label="Documents uploaded"
            value={String(kyc.documents.length)}
            hint={kyc.documents.length > 0 ? "Ready for review" : undefined}
            tone={kyc.documents.length > 0 ? "success" : "muted"}
          />
          <StatCard
            label="PAN verification"
            value={kyc.pan_verification_status?.replaceAll("_", " ") ?? "Not started"}
            tone={
              kyc.pan_verification_status === "verified"
                ? "success"
                : kyc.pan_verification_status === "failed"
                  ? "warning"
                  : "muted"
            }
          />
          <StatCard
            label="Bank verification"
            value={kyc.bank_verification_status?.replaceAll("_", " ") ?? "Not started"}
            tone={
              kyc.bank_verification_status === "verified"
                ? "success"
                : kyc.bank_verification_status === "failed"
                  ? "warning"
                  : "muted"
            }
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
        <Tabs defaultValue="journey" orientation="vertical" className="flex flex-col lg:flex-row lg:items-stretch">
          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 flex-col items-stretch gap-1 border-b border-border bg-muted/15 p-3 lg:w-56 lg:border-r lg:border-b-0"
          >
            {KYC_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="w-full justify-start gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-compact data-active:bg-background data-active:shadow-sm"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.value === "documents" && kyc.documents.length > 0 ? (
                    <StatusBadge variant="neutral" showIcon={false} className="ml-auto">
                      {kyc.documents.length}
                    </StatusBadge>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="min-w-0 flex-1 p-5">
        <TabsContent value="journey" className="mt-0 space-y-4">
          <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
            <h4 className={PROFILE_SECTION_TITLE_CLASS}>Verification journey</h4>
            <p className="mt-1 text-caption text-muted-foreground">
              Track each step from PAN verification through final review.
            </p>

            <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-8">
              <JourneyColumn steps={journeyLeftSteps} kyc={kyc} />
              <JourneyColumn steps={journeyRightSteps} kyc={kyc} />
            </div>
          </section>

          {(kyc.investor_profile_status ||
            kyc.external_kyc_status ||
            kyc.kyc_form_status) && (
            <section className="grid gap-3 sm:grid-cols-3">
              {kyc.investor_profile_status ? (
                <StatCard
                  label="Investor profile"
                  value={kyc.investor_profile_status.replaceAll("_", " ")}
                />
              ) : null}
              {kyc.external_kyc_status ? (
                <StatCard label="External KYC" value={kyc.external_kyc_status} />
              ) : null}
              {kyc.kyc_form_status ? (
                <StatCard label="KYC form" value={kyc.kyc_form_status.replaceAll("_", " ")} />
              ) : null}
            </section>
          )}
        </TabsContent>

        <TabsContent value="identity" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailPanel
              title="PAN details"
              description="Masked identity information from the PAN step."
              icon={Fingerprint}
              empty={
                !hasPanData(kyc.pan) ? (
                  <SectionEmpty
                    icon={Fingerprint}
                    title="PAN not captured yet"
                    description="Identity details will appear here once the customer completes PAN verification."
                  />
                ) : undefined
              }
            >
              <InfoRow
                label="PAN (last 4)"
                value={kyc.pan?.pan_last4 ? `•••• ${kyc.pan.pan_last4}` : null}
              />
              <InfoRow label="Full name" value={kyc.pan?.full_name} />
              <InfoRow label="Date of birth" value={kyc.pan?.date_of_birth} />
              <InfoRow label="Category" value={kyc.pan?.pan_category} />
              <InfoRow
                label="Verification"
                value={kyc.pan_verification_status?.replaceAll("_", " ")}
              />
            </DetailPanel>

            <DetailPanel
              title="Personal information"
              description="Additional profile details collected during KYC."
              icon={UserRound}
              empty={
                !hasPersonalData(kyc.personal) ? (
                  <SectionEmpty
                    icon={UserRound}
                    title="Personal details not added"
                    description="Occupation, income, and family details will show up after the personal step is saved."
                  />
                ) : undefined
              }
            >
              <InfoRow label="Father's name" value={kyc.personal?.fathers_name} />
              <InfoRow label="Gender" value={kyc.personal?.gender} />
              <InfoRow label="Marital status" value={kyc.personal?.marital_status} />
              <InfoRow label="Occupation" value={kyc.personal?.occupation} />
              <InfoRow label="Income slab" value={kyc.personal?.income_slab} />
              <InfoRow label="Place of birth" value={kyc.personal?.place_of_birth} />
              <InfoRow label="Nationality" value={kyc.personal?.nationality} />
              <InfoRow
                label="Politically exposed"
                value={
                  kyc.personal?.pep_exposed == null
                    ? null
                    : kyc.personal.pep_exposed
                      ? "Yes"
                      : "No"
                }
              />
            </DetailPanel>
          </div>

          <DetailPanel
            title="Address"
            description="Permanent, correspondence, and verified investor addresses."
            icon={MapPin}
            empty={
              !hasAddressData(kyc) ? (
                <SectionEmpty
                  icon={MapPin}
                  title="No address on file"
                  description="Address information will appear once the customer completes the address step."
                />
              ) : undefined
            }
          >
            <div className="grid gap-4 py-2 md:grid-cols-2">
              {formatAddressLines(kyc.address?.permanent) ? (
                <div className="rounded-[var(--radius-control)] border border-border bg-muted/10 p-3">
                  <p className="text-caption font-medium text-muted-foreground">Permanent address</p>
                  <p className="mt-2 whitespace-pre-line text-compact text-foreground">
                    {formatAddressLines(kyc.address?.permanent)}
                  </p>
                </div>
              ) : null}
              {formatAddressLines(kyc.address?.correspondence) ? (
                <div className="rounded-[var(--radius-control)] border border-border bg-muted/10 p-3">
                  <p className="text-caption font-medium text-muted-foreground">
                    Correspondence address
                  </p>
                  <p className="mt-2 whitespace-pre-line text-compact text-foreground">
                    {formatAddressLines(kyc.address?.correspondence)}
                  </p>
                </div>
              ) : null}
            </div>
            {kyc.investor_addresses.length > 0 ? (
              <div className="space-y-3 border-t border-border py-3">
                <p className="text-caption font-medium text-muted-foreground">
                  Verified investor addresses
                </p>
                {kyc.investor_addresses.map((address) => (
                  <div
                    key={address.id}
                    className="rounded-[var(--radius-control)] border border-border bg-muted/10 p-3"
                  >
                    <p className="text-caption font-medium text-muted-foreground">
                      {address.is_primary ? "Primary" : "Address"} · {address.nature}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-compact text-foreground">
                      {formatAddressLines(address)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </DetailPanel>
        </TabsContent>

        <TabsContent value="banking" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailPanel
              title="Bank account"
              description="Masked payout account details for investments."
              icon={Building2}
              empty={
                !hasBankData(kyc) ? (
                  <SectionEmpty
                    icon={Building2}
                    title="Bank details not added"
                    description="Account information will appear after the customer completes bank verification."
                  />
                ) : undefined
              }
            >
              <InfoRow
                label="Account (last 4)"
                value={
                  kyc.bank_draft?.account_number_last4
                    ? `•••• ${kyc.bank_draft.account_number_last4}`
                    : null
                }
              />
              <InfoRow label="IFSC" value={kyc.bank_draft?.ifsc_code} />
              <InfoRow label="Account type" value={kyc.bank_draft?.account_type} />
              <InfoRow label="Account holder" value={kyc.bank_draft?.account_holder_name} />
              <InfoRow label="Bank" value={kyc.bank_draft?.bank_name} />
              <InfoRow label="Branch" value={kyc.bank_draft?.branch} />
              <InfoRow
                label="Verification"
                value={kyc.bank_verification_status?.replaceAll("_", " ")}
              />
              {kyc.bank_accounts.map((account) => (
                <div
                  key={String(account.id)}
                  className="my-3 rounded-[var(--radius-control)] border border-border bg-muted/10 p-3"
                >
                  <p className="font-medium text-foreground">
                    {String(
                      account.account_number_masked ??
                        `•••• ${account.account_number_last4 ?? "----"}`,
                    )}
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {String(account.bank_name ?? "Bank")} · {String(account.ifsc_code ?? "")} ·{" "}
                    {String(account.verification_status ?? "pending")}
                  </p>
                </div>
              ))}
            </DetailPanel>

            <DetailPanel
              title="Signature"
              description="Customer signature used for KYC submission."
              icon={PenLine}
              empty={
                !kyc.signature?.has_upload && !signatureDocumentId ? (
                  <SectionEmpty
                    icon={PenLine}
                    title="Signature not uploaded"
                    description="A drawn or uploaded signature will appear here once the customer completes that step."
                  />
                ) : undefined
              }
            >
              <InfoRow label="Mode" value={kyc.signature?.mode} />
              <InfoRow
                label="Status"
                value={kyc.signature?.has_upload || signatureDocumentId ? "Uploaded" : "Not uploaded"}
              />
              {signatureDocumentId && hasDownload ? (
                <div className="py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === `preview-${signatureDocumentId}`}
                    onClick={() => void handlePreview(signatureDocumentId)}
                  >
                    <FileImage className="size-3.5" />
                    View signature
                  </Button>
                </div>
              ) : null}
            </DetailPanel>
          </div>

          <DetailPanel
            title="Nominees"
            description="Beneficiary details linked to the customer's investments."
            icon={Users}
            empty={
              kyc.nominees.length === 0 ? (
                <SectionEmpty
                  icon={Users}
                  title="No nominees added"
                  description="Nominee information will appear once the customer completes the nominee step."
                />
              ) : undefined
            }
          >
            <div className="overflow-x-auto py-2">
              <table className="w-full min-w-table-sm text-left text-compact">
                <thead className="border-b border-border text-caption text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Relationship</th>
                    <th className="px-2 py-2 font-medium">Share</th>
                    <th className="px-2 py-2 font-medium">ID last 4</th>
                  </tr>
                </thead>
                <tbody>
                  {kyc.nominees.map((nominee, index) => (
                    <tr key={`${nominee.full_name ?? nominee.name ?? index}`} className="border-b border-border">
                      <td className="px-2 py-3 font-medium">{nominee.full_name ?? nominee.name ?? "—"}</td>
                      <td className="px-2 py-3 text-muted-foreground">{nominee.relationship ?? "—"}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {nominee.share_percent != null ? `${nominee.share_percent}%` : "—"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {nominee.document_number_last4 || nominee.pan_last4
                          ? `•••• ${nominee.document_number_last4 ?? nominee.pan_last4}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailPanel>
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="rounded-[var(--radius-control)] bg-background p-2 text-primary ring-1 ring-border">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h4 className={PROFILE_SECTION_TITLE_CLASS}>Uploaded documents</h4>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    Review identity, address, and bank proofs submitted by the customer.
                  </p>
                </div>
              </div>
              {hasVerify && kyc.documents.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading === "verify-all"}
                  onClick={() => void handleVerifyAll()}
                >
                  Verify all
                </Button>
              ) : null}
            </div>

            {kyc.documents.length === 0 ? (
              <SectionEmpty
                icon={FileText}
                title="No documents uploaded"
                description="Uploaded KYC files will appear here for preview, verification, or rejection."
              />
            ) : (
              <div className="grid gap-3 p-4">
                {kyc.documents.map((document) => (
                  <article
                    key={document.id}
                    className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-muted/10 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-[var(--radius-control)] bg-muted/30 p-2 text-primary">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {DOCUMENT_TYPE_LABELS[document.doc_type] ??
                            document.doc_type.replaceAll("_", " ")}
                        </p>
                        <StatusBadge variant="neutral" showIcon={false}>
                          v{document.version}
                        </StatusBadge>
                        <StatusBadge
                          variant={documentReviewStatusVariant(
                            document.kyc_review_status ?? document.status ?? "",
                          )}
                        >
                          {document.kyc_review_status ?? document.status}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 truncate text-caption text-muted-foreground">
                        {document.original_filename}
                      </p>
                      <p className="mt-1 text-caption text-muted-foreground">
                        Uploaded {new Date(document.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasDownload ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === `preview-${document.id}`}
                        onClick={() => void handlePreview(document.id)}
                      >
                        View
                      </Button>
                    ) : null}
                    {hasVerify ? (
                      <>
                        <Button
                          size="sm"
                          disabled={actionLoading === `verify-${document.id}`}
                          onClick={() => void handleVerify(document.id)}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === `reject-${document.id}`}
                          onClick={() => void handleReject(document.id)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
              </div>
            )}
          </section>
        </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  );
}
