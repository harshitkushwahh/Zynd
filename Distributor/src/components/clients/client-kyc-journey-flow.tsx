"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { AlertCircle, CheckCircle2, Circle, MinusCircle } from "lucide-react";

import "@xyflow/react/dist/style.css";

import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { kycStepIcon } from "@/lib/distributor-client-kyc-steps";
import { useTheme } from "@/contexts/theme-context";
import type { DistributorClientKycStep } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 168;
const NODE_HEIGHT = 118;
const MIN_GAP_X = 24;
const MIN_GAP_Y = 32;
const FRAME_PADDING_X = 28;
const FRAME_PADDING_Y = 24;
const COLS_PER_ROW = 3;

type GridLayout = {
  gapX: number;
  gapY: number;
  offsetX: number;
  offsetY: number;
};

function computeGridLayout(stepCount: number, frameWidth: number, frameHeight: number): GridLayout {
  const cols = Math.min(COLS_PER_ROW, stepCount);
  const rows = Math.ceil(stepCount / COLS_PER_ROW);

  const innerWidth = Math.max(0, frameWidth - FRAME_PADDING_X * 2);
  const gapX =
    cols > 1
      ? Math.max(MIN_GAP_X, (innerWidth - cols * NODE_WIDTH) / (cols - 1))
      : 0;
  const gridWidth = cols * NODE_WIDTH + Math.max(0, cols - 1) * gapX;
  const offsetX = FRAME_PADDING_X + Math.max(0, (innerWidth - gridWidth) / 2);

  const innerHeight = Math.max(0, frameHeight - FRAME_PADDING_Y * 2);
  const gapY =
    rows > 1
      ? Math.max(MIN_GAP_Y, (innerHeight - rows * NODE_HEIGHT) / (rows - 1))
      : 0;
  const gridHeight = rows * NODE_HEIGHT + Math.max(0, rows - 1) * gapY;
  const offsetY = FRAME_PADDING_Y + Math.max(0, (innerHeight - gridHeight) / 2);

  return { gapX, gapY, offsetX, offsetY };
}

type KycStepNodeData = {
  step: DistributorClientKycStep;
  stepNumber: number;
  kycCompliant: boolean;
  targetPosition: Position;
  sourcePosition: Position;
};

function StepStatusIcon({ status }: { status: DistributorClientKycStep["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (status === "failed") {
    return <AlertCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />;
  }
  if (status === "not_applicable") {
    return <MinusCircle className="size-3.5 shrink-0 text-muted-foreground/55" aria-hidden />;
  }
  return <Circle className="size-3.5 shrink-0 text-muted-foreground/45" aria-hidden />;
}

function stepStatusLabel(
  step: DistributorClientKycStep,
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"],
) {
  if (step.status === "not_applicable") return copy.stepNotRequired;
  if (step.status === "completed") return copy.stepCompleted;
  if (step.status === "failed") return copy.stepNeedsAttention;
  return copy.stepPending;
}

type KycInvestorPathBadge = "kra" | "new";

const KYC_PATH_BADGE_STEP_IDS = new Set(["digilocker", "signature", "esign"]);

function stepInvestorPathBadge(
  step: DistributorClientKycStep,
  kycCompliant: boolean,
): KycInvestorPathBadge | null {
  if (!KYC_PATH_BADGE_STEP_IDS.has(step.id)) return null;
  if (step.id === "digilocker") return kycCompliant ? "kra" : "new";
  if (kycCompliant) return "kra";
  return null;
}

function stepRequirementHint(
  step: DistributorClientKycStep,
  kycCompliant: boolean,
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"],
): string | null {
  if (kycCompliant) return null;
  if (step.id === "signature") return copy.pathSignatureRequired;
  if (step.id === "esign") return copy.pathEsignRequired;
  return null;
}

function KycInvestorPathBadgePill({
  variant,
  copy,
}: {
  variant: KycInvestorPathBadge;
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"];
}) {
  const label = variant === "kra" ? copy.badgeKraCompliant : copy.badgeNewToKyc;
  return (
    <StatusBadge variant={variant === "kra" ? "success" : "info"}>
      {label}
    </StatusBadge>
  );
}

function KycStepNodeComponent(props: NodeProps) {
  const data = props.data as KycStepNodeData;
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const { step, stepNumber, kycCompliant, targetPosition, sourcePosition } = data;
  const StepIcon = kycStepIcon(step.id);
  const completedStep = step.status === "completed";
  const failed = step.status === "failed";
  const skipped = step.status === "not_applicable";
  const investorPathBadge = stepInvestorPathBadge(step, kycCompliant);
  const requirementHint = stepRequirementHint(step, kycCompliant, copy);

  return (
    <>
      <Handle type="target" position={targetPosition} className="distributor-client-kyc-flow__handle" />
      <article
        className={cn(
          "distributor-client-kyc-flow__node",
          completedStep && "distributor-client-kyc-flow__node--complete",
          failed && "distributor-client-kyc-flow__node--failed",
          skipped && "distributor-client-kyc-flow__node--skipped",
        )}
      >
        <div className="distributor-client-kyc-flow__node-top">
          <span className="distributor-client-kyc-flow__node-icon" aria-hidden>
            <StepIcon strokeWidth={2.25} className="size-3.5" />
          </span>
          <span className="distributor-client-kyc-flow__node-index tabular-nums">Step {stepNumber}</span>
          <StepStatusIcon status={step.status} />
        </div>
        <p className="distributor-client-kyc-flow__node-label">{step.label}</p>
        <p
          className={cn(
            "distributor-client-kyc-flow__node-status",
            completedStep && "distributor-client-kyc-flow__node-status--complete",
            failed && "distributor-client-kyc-flow__node-status--failed",
            skipped && "distributor-client-kyc-flow__node-status--skipped",
          )}
        >
          {stepStatusLabel(step, copy)}
        </p>
        {investorPathBadge ? (
          <KycInvestorPathBadgePill variant={investorPathBadge} copy={copy} />
        ) : requirementHint ? (
          <StatusBadge variant="neutral">{requirementHint}</StatusBadge>
        ) : null}
      </article>
      <Handle type="source" position={sourcePosition} className="distributor-client-kyc-flow__handle" />
    </>
  );
}

const KycStepNode = memo(KycStepNodeComponent);

const nodeTypes = { kycStep: KycStepNode };

function nodeConnectionPositions(index: number, total: number): {
  targetPosition: Position;
  sourcePosition: Position;
} {
  const col = index % COLS_PER_ROW;
  const row = Math.floor(index / COLS_PER_ROW);
  const isLast = index === total - 1;
  const isLastInRow = col === COLS_PER_ROW - 1 || isLast;

  const targetPosition =
    col === 0 && row > 0 ? Position.Top : Position.Left;

  let sourcePosition = Position.Right;
  if (isLastInRow && !isLast) {
    sourcePosition = Position.Bottom;
  }

  return { targetPosition, sourcePosition };
}

function buildKycFlowGraph(
  steps: DistributorClientKycStep[],
  kycCompliant: boolean,
  grid: GridLayout,
): { nodes: Node<KycStepNodeData>[]; edges: Edge[] } {
  const { gapX, gapY, offsetX, offsetY } = grid;

  const nodes: Node<KycStepNodeData>[] = steps.map((step, index) => {
    const col = index % COLS_PER_ROW;
    const row = Math.floor(index / COLS_PER_ROW);
    const { targetPosition, sourcePosition } = nodeConnectionPositions(index, steps.length);

    return {
      id: step.id,
      type: "kycStep",
      position: {
        x: offsetX + col * (NODE_WIDTH + gapX),
        y: offsetY + row * (NODE_HEIGHT + gapY),
      },
      data: {
        step,
        stepNumber: index + 1,
        kycCompliant,
        targetPosition,
        sourcePosition,
      },
      draggable: false,
      selectable: false,
    };
  });

  const edges: Edge[] = steps.slice(0, -1).map((step, index) => {
    const next = steps[index + 1];
    const muted = skippedEdge(step, next);
    const active =
      step.status === "completed" &&
      next.status !== "pending" &&
      next.status !== "failed";
    return {
      id: `${step.id}-${next.id}`,
      source: step.id,
      target: next.id,
      type: "smoothstep",
      animated: active && !muted,
      style: {
        stroke: muted
          ? "color-mix(in srgb, var(--foreground) 22%, transparent)"
          : "color-mix(in srgb, var(--foreground) 38%, transparent)",
        strokeWidth: 1.5,
        strokeDasharray: muted ? "5 5" : undefined,
      },
    };
  });

  return { nodes, edges };
}

function skippedEdge(a: DistributorClientKycStep, b: DistributorClientKycStep) {
  return a.status === "not_applicable" || b.status === "not_applicable";
}

type ClientKycJourneyFlowProps = {
  steps: DistributorClientKycStep[];
  kycCompliant?: boolean;
  className?: string;
};

export function ClientKycJourneyFlow({
  steps,
  kycCompliant = false,
  className,
}: ClientKycJourneyFlowProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setFrameSize({ width, height });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { nodes, edges } = useMemo(() => {
    const width = frameSize.width || 960;
    const height = frameSize.height || 512;
    const grid = computeGridLayout(steps.length, width, height);
    return buildKycFlowGraph(steps, kycCompliant, grid);
  }, [steps, kycCompliant, frameSize.width, frameSize.height]);

  return (
    <div ref={containerRef} className={cn("distributor-client-kyc-flow", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={false}
        minZoom={1}
        maxZoom={1}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
      </ReactFlow>
    </div>
  );
}
