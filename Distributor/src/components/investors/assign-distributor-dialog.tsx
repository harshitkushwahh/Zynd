"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResidentDistributorAssignment } from "@/contexts/resident-distributor-assignment-context";
import { delay } from "@/lib/add-investor/add-investor-demo";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_OVERLAY_BODY_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
  DISTRIBUTOR_STACK_MD_CLASS,
} from "@/lib/distributor-layout";
import type { DistributorInvestor } from "@/lib/dummy/types";
import {
  buildDemoMagicLink,
  getBranchDistributorsForAssignment,
} from "@/lib/resident-distributor-assignment";
import { cn } from "@/lib/utils";

type AssignDistributorDialogProps = {
  investor: DistributorInvestor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DialogPhase = "form" | "sent" | "assigned";

const FLOW_STEPS: { id: DialogPhase; label: string }[] = [
  { id: "form", label: "Choose" },
  { id: "sent", label: "Confirm" },
  { id: "assigned", label: "Linked" },
];

function phaseIndex(phase: DialogPhase): number {
  if (phase === "form") return 0;
  if (phase === "sent") return 1;
  return 2;
}

function AssignFlowSteps({ phase }: { phase: DialogPhase }) {
  const active = phaseIndex(phase);

  return (
    <ol className="flex items-center gap-1" aria-label="Assignment progress">
      {FLOW_STEPS.map((step, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-2 text-center",
                current && "bg-primary/8 ring-1 ring-primary/20",
                done && !current && "opacity-80",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold tabular-nums",
                  done && "bg-primary text-primary-foreground",
                  current && !done && "bg-primary/15 text-primary",
                  !done && !current && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "w-full truncate text-[0.65rem] font-medium leading-tight",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < FLOW_STEPS.length - 1 ? (
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function InvestorSummaryCard({ investor }: { investor: DistributorInvestor }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
          <Users className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-compact font-semibold text-foreground">{investor.clientCode}</p>
          <p className="mt-0.5 truncate text-caption text-muted-foreground">{investor.emailMasked}</p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            {investor.investorType} · {investor.serviceModel?.toUpperCase() ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AssignDistributorDialog({ investor, open, onOpenChange }: AssignDistributorDialogProps) {
  const { requestAssignment, confirmAssignment, getAssignment } = useResidentDistributorAssignment();
  const distributors = useMemo(() => getBranchDistributorsForAssignment(), []);
  const [distributorId, setDistributorId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const assignment = investor ? getAssignment(investor.id) : undefined;

  const phase: DialogPhase = (() => {
    if (!investor) return "form";
    if (assignment?.status === "assigned") return "assigned";
    if (assignment?.status === "pending_confirmation") return "sent";
    return "form";
  })();

  useEffect(() => {
    if (!open || !investor) return;
    if (assignment?.status === "pending_confirmation") {
      setDistributorId(assignment.distributorId);
    } else if (phase === "form") {
      setDistributorId("");
    }
  }, [open, investor?.id, assignment?.distributorId, assignment?.status, phase]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDistributorId("");
      setSending(false);
      setConfirming(false);
    }
    onOpenChange(next);
  };

  const handleSend = async () => {
    if (!investor || !distributorId) return;
    setSending(true);
    await delay(700);
    requestAssignment(investor.id, distributorId);
    setSending(false);
  };

  const handleSimulateMagicLink = async () => {
    if (!investor) return;
    setConfirming(true);
    await delay(500);
    confirmAssignment(investor.id);
    setConfirming(false);
  };

  const selectedDistributor = distributors.find((row) => row.id === distributorId);
  const magicLink = investor ? buildDemoMagicLink(investor.id) : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Assign distributor</DialogTitle>
        <DialogDescription>
          Send the investor a confirmation email. The distributor is linked only after they approve via
          the magic link.
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="assign-distributor-dialog max-w-md gap-0 p-0">
        <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
          <div className="flex items-start gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="text-compact font-semibold text-foreground">Assign distributor</h2>
              <p className="distributor-panel-card__description leading-relaxed">
                We email the investor a secure link. Their distributor is linked only after they confirm.
              </p>
            </div>
          </div>
        </div>

        <div className={cn(DISTRIBUTOR_OVERLAY_BODY_CLASS, DISTRIBUTOR_STACK_MD_CLASS, "pb-5")}>
          <AssignFlowSteps phase={phase} />

          {investor ? <InvestorSummaryCard investor={investor} /> : null}

          {phase === "form" ? (
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>Branch distributor</FieldLabel>
                <Select value={distributorId} onValueChange={(v) => setDistributorId(v ?? "")}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select who will serve this investor" />
                  </SelectTrigger>
                  <SelectContent>
                    {distributors.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        <span className="font-medium">{row.name}</span>
                        <span className="text-muted-foreground"> · {row.arn}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {selectedDistributor ? (
                <div className={cn(DISTRIBUTOR_INSET_SECTION_BODY_CLASS, "space-y-2 text-caption")}>
                  <div className="flex gap-2 text-muted-foreground">
                    <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <p>
                      Confirmation goes to{" "}
                      <span className="font-medium text-foreground">{investor?.emailMasked}</span>. Branch
                      copy:{" "}
                      <span className="font-medium text-foreground">{selectedDistributor.email}</span>.
                    </p>
                  </div>
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full gap-2"
                size="lg"
                disabled={!distributorId || sending}
                onClick={handleSend}
              >
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Sending confirmation…
                  </>
                ) : (
                  <>
                    <Mail className="size-4" aria-hidden />
                    Send confirmation email
                  </>
                )}
              </Button>
            </FieldGroup>
          ) : null}

          {phase === "sent" && assignment ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-4">
                <div className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
                    <Clock3 className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-2 text-caption">
                    <p className="font-semibold text-foreground">Waiting on the investor</p>
                    <p className="text-muted-foreground leading-relaxed">
                      A magic link was sent to{" "}
                      <span className="font-medium text-foreground">{investor?.emailMasked}</span>. When
                      they open it,{" "}
                      <span className="font-medium text-foreground">{assignment.distributorName}</span>{" "}
                      ({assignment.distributorArn}) will be linked to their profile.
                    </p>
                  </div>
                </div>
              </div>

              <dl className="divide-y divide-border rounded-lg border border-border text-caption">
                <div className="flex justify-between gap-3 px-3 py-2.5">
                  <dt className="text-muted-foreground">Proposed distributor</dt>
                  <dd className="text-right font-medium text-foreground">{assignment.distributorName}</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2.5">
                  <dt className="text-muted-foreground">ARN</dt>
                  <dd className="font-mono text-foreground">{assignment.distributorArn}</dd>
                </div>
                <div className="flex flex-col gap-1 px-3 py-2.5">
                  <dt className="text-muted-foreground">Demo magic link</dt>
                  <dd className="break-all font-mono text-[0.65rem] text-foreground/80">{magicLink}</dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                size="lg"
                disabled={confirming}
                onClick={handleSimulateMagicLink}
              >
                {confirming ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Linking distributor…
                  </>
                ) : (
                  "Demo: investor opens magic link"
                )}
              </Button>
            </div>
          ) : null}

          {phase === "assigned" && assignment ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-7" strokeWidth={2.25} aria-hidden />
                </span>
                <p className="mt-3 text-compact font-semibold text-foreground">Distributor linked</p>
                <p className="mt-1 max-w-xs text-caption text-muted-foreground leading-relaxed">
                  {assignment.distributorName} is now on this investor&apos;s book. They can reach out for
                  advice and transactions through the app.
                </p>
              </div>

              <dl className="divide-y divide-border rounded-lg border border-border text-caption">
                <div className="flex justify-between gap-3 px-3 py-2.5">
                  <dt className="text-muted-foreground">Distributor</dt>
                  <dd className="text-right font-medium text-foreground">{assignment.distributorName}</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2.5">
                  <dt className="text-muted-foreground">ARN</dt>
                  <dd className="font-mono text-foreground">{assignment.distributorArn}</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2.5">
                  <dt className="text-muted-foreground">Investor</dt>
                  <dd className="font-mono text-foreground">{investor?.clientCode}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type AssignDistributorCellProps = {
  investor: DistributorInvestor;
  onAssign: () => void;
};

export function AssignDistributorCell({ investor, onAssign }: AssignDistributorCellProps) {
  const { getAssignment } = useResidentDistributorAssignment();
  const assignment = getAssignment(investor.id);

  if (assignment?.status === "assigned") {
    return (
      <div className="flex flex-col gap-0.5 text-caption" onClick={(e) => e.stopPropagation()}>
        <span className="font-medium text-foreground">{assignment.distributorName}</span>
        <span className="text-emerald-600 dark:text-emerald-400">Assigned</span>
      </div>
    );
  }

  if (assignment?.status === "pending_confirmation") {
    return (
      <div className="flex flex-col gap-1 text-caption" onClick={(e) => e.stopPropagation()}>
        <span className="text-muted-foreground">Pending · {assignment.distributorName}</span>
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start p-0 text-caption"
          onClick={(e) => {
            e.stopPropagation();
            onAssign();
          }}
        >
          View invite
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-caption"
      onClick={(e) => {
        e.stopPropagation();
        onAssign();
      }}
    >
      <UserPlus className="size-3.5" aria-hidden />
      Assign
    </Button>
  );
}
