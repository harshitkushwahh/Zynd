"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  getNodesBounds,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type CoordinateExtent,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Loader2 } from "lucide-react";

import "@xyflow/react/dist/style.css";

import { DistributorHeadStepBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { useTheme } from "@/contexts/theme-context";
import type {
  AdminHierarchyManager,
  AdminHierarchyOverview,
  AdminHierarchyPartner,
  AdminHierarchyStateHead,
} from "@/lib/admin-distributor-hierarchy-api";
import type { MitraHierarchyPersona } from "@/lib/admin-mitra-roles";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 188;
const NODE_HEIGHT = 88;
const ROOT_NODE_HEIGHT = 108;
const NODE_GAP_X = 28;
const TIER_GAP_Y = 56;
const FRAME_PADDING_Y = 24;
const VIEWPORT_PADDING = 28;

type DistributorHeadHierarchyChartProps = {
  className?: string;
  overview: AdminHierarchyOverview | null;
  managers: AdminHierarchyManager[];
  partners: AdminHierarchyPartner[];
  stateHeads?: AdminHierarchyStateHead[];
  loading?: boolean;
  error?: string;
  superHeadName?: string;
  superHeadEmail?: string;
  stateHeadName?: string;
  stateHeadEmail?: string;
  persona?: MitraHierarchyPersona | null;
};

type HierarchyFlowNodeData = {
  step?: number;
  title: string;
  primary: string;
  secondary?: string;
  variant?: "root" | "manager" | "mitras" | "empty";
  nodeRole: "root" | "branch" | "leaf";
};

function rowPositions(count: number, frameWidth: number, y: number) {
  const safeCount = Math.max(count, 1);
  const rowWidth = safeCount * NODE_WIDTH + Math.max(0, safeCount - 1) * NODE_GAP_X;
  const startX = Math.max(16, (frameWidth - rowWidth) / 2);

  return Array.from({ length: safeCount }, (_, index) => ({
    x: startX + index * (NODE_WIDTH + NODE_GAP_X),
    y,
  }));
}

function partnersForManager(managerId: string, partners: AdminHierarchyPartner[]) {
  return partners.filter((row) => row.manager_id === managerId);
}

function partnerSummary(partners: AdminHierarchyPartner[]) {
  if (partners.length === 0) {
    return {
      primary: `No ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}`,
      secondary: undefined,
    };
  }

  const activeCount = partners.filter((row) => row.status === "Active").length;
  const primary = `${partners.length} ${partners.length === 1 ? MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase() : MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}`;
  const secondary =
    partners
      .slice(0, 2)
      .map((row) => row.name)
      .join(" · ") + (partners.length > 2 ? ` · +${partners.length - 2} more` : "");

  return {
    primary: `${primary} · ${activeCount} active`,
    secondary,
  };
}

function createFlowNode(
  id: string,
  position: { x: number; y: number },
  data: HierarchyFlowNodeData,
): Node<HierarchyFlowNodeData> {
  const height = data.nodeRole === "root" ? ROOT_NODE_HEIGHT : NODE_HEIGHT;

  return {
    id,
    type: "hierarchyStep",
    position,
    data,
    width: NODE_WIDTH,
    height,
    draggable: false,
    selectable: false,
  };
}

function createEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style: { strokeWidth: 2 },
    className: "distributor-head-hierarchy-flow__edge",
  };
}

function HierarchyFlowNodeComponent(props: NodeProps) {
  const data = props.data as HierarchyFlowNodeData;
  const showTarget = data.nodeRole !== "root";
  const showSource = data.nodeRole !== "leaf";

  return (
    <>
      {showTarget ? (
        <Handle type="target" position={Position.Top} className="distributor-head-hierarchy-flow__handle" />
      ) : null}
      <article
        className={cn(
          "distributor-head-hierarchy-flow__node",
          data.variant === "root" && "distributor-head-hierarchy-flow__node--root",
          data.variant === "empty" && "distributor-head-hierarchy-flow__node--empty",
        )}
      >
        <div className="distributor-head-hierarchy-flow__node-header">
          {data.step ? <DistributorHeadStepBadge step={data.step} /> : null}
          <p className="distributor-head-hierarchy-flow__node-title">{data.title}</p>
        </div>
        <p className="distributor-head-hierarchy-flow__node-primary">{data.primary}</p>
        {data.secondary ? (
          <p className="distributor-head-hierarchy-flow__node-secondary">{data.secondary}</p>
        ) : null}
      </article>
      {showSource ? (
        <Handle type="source" position={Position.Bottom} className="distributor-head-hierarchy-flow__handle" />
      ) : null}
    </>
  );
}

const HierarchyFlowNode = memo(HierarchyFlowNodeComponent);

const nodeTypes = { hierarchyStep: HierarchyFlowNode };

function buildEmptyStateHeadHierarchyGraph(
  width: number,
  rootTitle: string,
  rootPrimary: string,
  rootSecondary: string,
): { nodes: Node<HierarchyFlowNodeData>[]; edges: Edge[] } {
  const centerX = (width - NODE_WIDTH) / 2;
  const stateHeadY = FRAME_PADDING_Y;
  const managerTierY = stateHeadY + ROOT_NODE_HEIGHT + TIER_GAP_Y;
  const mitraTierY = managerTierY + NODE_HEIGHT + TIER_GAP_Y;

  const nodes = [
    createFlowNode(
      "state-head",
      { x: centerX, y: stateHeadY },
      {
        step: 1,
        title: rootTitle,
        primary: rootPrimary,
        secondary: rootSecondary,
        variant: "root",
        nodeRole: "root",
      },
    ),
    createFlowNode(
      "managers-empty",
      { x: centerX, y: managerTierY },
      {
        step: 2,
        title: MITRA_HIERARCHY_COPY.branchManagers,
        primary: `No ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} yet`,
        variant: "empty",
        nodeRole: "branch",
      },
    ),
    createFlowNode(
      "mitras-empty",
      { x: centerX, y: mitraTierY },
      {
        step: 3,
        title: MITRA_HIERARCHY_COPY.zyndMitras,
        primary: `No ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} yet`,
        variant: "empty",
        nodeRole: "leaf",
      },
    ),
  ];

  const edges = [
    createEdge("state-head-managers-empty", "state-head", "managers-empty"),
    createEdge("managers-empty-mitras-empty", "managers-empty", "mitras-empty"),
  ];

  return { nodes, edges };
}

function appendManagerMitraTiers({
  nodes,
  edges,
  managers,
  partners,
  width,
  managerTierY,
  parentNodeIds,
}: {
  nodes: Node<HierarchyFlowNodeData>[];
  edges: Edge[];
  managers: AdminHierarchyManager[];
  partners: AdminHierarchyPartner[];
  width: number;
  managerTierY: number;
  parentNodeIds: string[];
}) {
  const mitraTierY = managerTierY + NODE_HEIGHT + TIER_GAP_Y;
  const fallbackParentId = parentNodeIds[0] ?? "state-head";

  if (managers.length === 0) {
    const centerX = (width - NODE_WIDTH) / 2;
    nodes.push(
      createFlowNode(
        "managers-empty",
        { x: centerX, y: managerTierY },
        {
          step: 3,
          title: MITRA_HIERARCHY_COPY.branchManagers,
          primary: `No ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} yet`,
          variant: "empty",
          nodeRole: "branch",
        },
      ),
      createFlowNode(
        "mitras-empty",
        { x: centerX, y: mitraTierY },
        {
          step: 4,
          title: MITRA_HIERARCHY_COPY.zyndMitras,
          primary: `No ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} yet`,
          variant: "empty",
          nodeRole: "leaf",
        },
      ),
    );
    for (const parentId of parentNodeIds) {
      edges.push(createEdge(`${parentId}-managers-empty`, parentId, "managers-empty"));
    }
    edges.push(createEdge("managers-empty-mitras-empty", "managers-empty", "mitras-empty"));
    return;
  }

  const managerPositions = rowPositions(managers.length, width, managerTierY);
  const stateHeadByCode = new Map(
    parentNodeIds
      .filter((id) => id.startsWith("state-head-"))
      .map((id) => [id.replace("state-head-", ""), id] as const),
  );

  managers.forEach((manager, index) => {
    const managerNodeId = `manager-${manager.id}`;
    const position = managerPositions[index];
    if (!position) return;

    nodes.push(
      createFlowNode(
        managerNodeId,
        position,
        {
          title: MITRA_HIERARCHY_COPY.branchManager,
          primary: manager.name,
          secondary: manager.city || manager.state_name,
          variant: "manager",
          nodeRole: "branch",
        },
      ),
    );

    const parentId =
      stateHeadByCode.get(manager.state_code) ??
      parentNodeIds.find((id) => id.startsWith("state-head-")) ??
      fallbackParentId;
    edges.push(createEdge(`${parentId}-${managerNodeId}`, parentId, managerNodeId));

    const managerPartners = partnersForManager(manager.id, partners);
    const summary = partnerSummary(managerPartners);
    const mitraNodeId = `mitras-${manager.id}`;

    nodes.push(
      createFlowNode(
        mitraNodeId,
        { x: position.x, y: mitraTierY },
        {
          title: MITRA_HIERARCHY_COPY.zyndMitras,
          primary: summary.primary,
          secondary: summary.secondary,
          variant: managerPartners.length === 0 ? "empty" : "mitras",
          nodeRole: "leaf",
        },
      ),
    );

    edges.push(createEdge(`${managerNodeId}-${mitraNodeId}`, managerNodeId, mitraNodeId));
  });
}

function buildSuperHeadHierarchyGraph({
  overview,
  managers,
  partners,
  stateHeads,
  superHeadName,
  superHeadEmail,
  frameWidth,
}: {
  overview: AdminHierarchyOverview;
  managers: AdminHierarchyManager[];
  partners: AdminHierarchyPartner[];
  stateHeads: AdminHierarchyStateHead[];
  superHeadName?: string;
  superHeadEmail?: string;
  frameWidth: number;
}): { nodes: Node<HierarchyFlowNodeData>[]; edges: Edge[] } {
  const width = Math.max(frameWidth, NODE_WIDTH * 2 + NODE_GAP_X + 32);
  const nodes: Node<HierarchyFlowNodeData>[] = [];
  const edges: Edge[] = [];

  const superHeadY = FRAME_PADDING_Y;
  const stateHeadTierY = superHeadY + ROOT_NODE_HEIGHT + TIER_GAP_Y;
  const managerTierY = stateHeadTierY + NODE_HEIGHT + TIER_GAP_Y;
  const superHeadX = (width - NODE_WIDTH) / 2;

  nodes.push(
    createFlowNode(
      "super-head",
      { x: superHeadX, y: superHeadY },
      {
        step: 1,
        title: MITRA_HIERARCHY_COPY.superHead,
        primary: superHeadName || "Pan India",
        secondary: superHeadEmail || "Company-wide oversight",
        variant: "root",
        nodeRole: "root",
      },
    ),
  );

  const visibleStateHeads = stateHeads;

  let parentNodeIds: string[] = [];

  if (visibleStateHeads.length === 0) {
    nodes.push(
      createFlowNode(
        "state-head-empty",
        { x: superHeadX, y: stateHeadTierY },
        {
          step: 2,
          title: MITRA_HIERARCHY_COPY.stateHead,
          primary: `No ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} assigned yet`,
          secondary: overview.state_name
            ? `${overview.state_name} · assign on State Heads tab`
            : "Assign on State Heads tab",
          variant: "empty",
          nodeRole: "branch",
        },
      ),
    );
    edges.push(createEdge("super-head-state-head-empty", "super-head", "state-head-empty"));
    parentNodeIds = ["state-head-empty"];
  } else {
    const stateHeadPositions = rowPositions(visibleStateHeads.length, width, stateHeadTierY);
    visibleStateHeads.forEach((stateHead, index) => {
      const nodeId = `state-head-${stateHead.state_code}`;
      const position = stateHeadPositions[index];
      if (!position) return;

      nodes.push(
        createFlowNode(
          nodeId,
          position,
          {
            step: 2,
            title: MITRA_HIERARCHY_COPY.stateHead,
            primary: stateHead.name,
            secondary: `${stateHead.state_name} · ${stateHead.state_code}`,
            variant: "manager",
            nodeRole: "branch",
          },
        ),
      );
      edges.push(createEdge(`super-head-${nodeId}`, "super-head", nodeId));
      parentNodeIds.push(nodeId);
    });
  }

  appendManagerMitraTiers({
    nodes,
    edges,
    managers,
    partners,
    width,
    managerTierY,
    parentNodeIds,
  });

  return { nodes, edges };
}

function buildStateHeadHierarchyGraph({
  overview,
  managers,
  partners,
  stateHeadName,
  stateHeadEmail,
  persona,
  frameWidth,
}: {
  overview: AdminHierarchyOverview;
  managers: AdminHierarchyManager[];
  partners: AdminHierarchyPartner[];
  stateHeadName?: string;
  stateHeadEmail?: string;
  persona?: MitraHierarchyPersona | null;
  frameWidth: number;
}): { nodes: Node<HierarchyFlowNodeData>[]; edges: Edge[] } {
  const width = Math.max(frameWidth, NODE_WIDTH * 2 + NODE_GAP_X + 32);
  const isStateHeadPersona = persona === "state_head";
  const rootTitle = isStateHeadPersona
    ? MITRA_HIERARCHY_COPY.stateHead
    : MITRA_HIERARCHY_COPY.superHead;
  const stateHeadPrimary = isStateHeadPersona
    ? stateHeadName || overview.state_name
    : overview.state_name;
  const stateHeadSecondary = isStateHeadPersona
    ? [stateHeadEmail, `${overview.state_name} · ${overview.state_code}`].filter(Boolean).join(" · ")
    : `${overview.state_name} · ${overview.state_code}`;

  if (managers.length === 0) {
    return buildEmptyStateHeadHierarchyGraph(width, rootTitle, stateHeadPrimary, stateHeadSecondary);
  }

  const nodes: Node<HierarchyFlowNodeData>[] = [];
  const edges: Edge[] = [];

  const stateHeadY = FRAME_PADDING_Y;
  const stateHeadX = (width - NODE_WIDTH) / 2;
  const managerTierY = stateHeadY + ROOT_NODE_HEIGHT + TIER_GAP_Y;

  nodes.push(
    createFlowNode(
      "state-head",
      { x: stateHeadX, y: stateHeadY },
      {
        step: 1,
        title: rootTitle,
        primary: stateHeadPrimary,
        secondary: stateHeadSecondary,
        variant: "root",
        nodeRole: "root",
      },
    ),
  );

  appendManagerMitraTiers({
    nodes,
    edges,
    managers,
    partners,
    width,
    managerTierY,
    parentNodeIds: ["state-head"],
  });

  return { nodes, edges };
}

function buildHierarchyGraph({
  overview,
  managers,
  partners,
  stateHeads = [],
  superHeadName,
  superHeadEmail,
  stateHeadName,
  stateHeadEmail,
  persona,
  frameWidth,
}: {
  overview: AdminHierarchyOverview;
  managers: AdminHierarchyManager[];
  partners: AdminHierarchyPartner[];
  stateHeads?: AdminHierarchyStateHead[];
  superHeadName?: string;
  superHeadEmail?: string;
  stateHeadName?: string;
  stateHeadEmail?: string;
  persona?: MitraHierarchyPersona | null;
  frameWidth: number;
}): { nodes: Node<HierarchyFlowNodeData>[]; edges: Edge[] } {
  if (persona === "super_head") {
    return buildSuperHeadHierarchyGraph({
      overview,
      managers,
      partners,
      stateHeads,
      superHeadName,
      superHeadEmail,
      frameWidth,
    });
  }

  return buildStateHeadHierarchyGraph({
    overview,
    managers,
    partners,
    stateHeadName,
    stateHeadEmail,
    persona,
    frameWidth,
  });
}

function computeTranslateExtent(nodes: Node<HierarchyFlowNodeData>[]): CoordinateExtent {
  if (nodes.length === 0) {
    return [
      [0, 0],
      [0, 0],
    ];
  }

  const bounds = getNodesBounds(nodes);
  return [
    [bounds.x - VIEWPORT_PADDING, bounds.y - VIEWPORT_PADDING],
    [bounds.x + bounds.width + VIEWPORT_PADDING, bounds.y + bounds.height + VIEWPORT_PADDING],
  ];
}

function computeContentHeight(nodes: Node<HierarchyFlowNodeData>[]) {
  if (nodes.length === 0) return 320;
  const bounds = getNodesBounds(nodes);
  return bounds.height + VIEWPORT_PADDING * 2;
}

function HierarchyFlowViewport({
  nodes,
  frameWidth,
}: {
  nodes: Node<HierarchyFlowNodeData>[];
  frameWidth: number;
}) {
  const { fitView, getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    if (nodes.length === 0) return;

    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.12, duration: 0, includeHiddenNodes: false }).then(() => {
        const viewport = getViewport();
        setViewport(viewport, { duration: 0 });
      });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [fitView, getViewport, setViewport, nodes, frameWidth]);

  return null;
}

function HierarchyFlowCanvas({
  nodes,
  edges,
  theme,
  frameWidth,
}: {
  nodes: Node<HierarchyFlowNodeData>[];
  edges: Edge[];
  theme: Theme;
  frameWidth: number;
}) {
  const translateExtent = useMemo(() => computeTranslateExtent(nodes), [nodes]);

  return (
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
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={1}
      maxZoom={1}
      translateExtent={translateExtent}
      defaultEdgeOptions={{
        type: "smoothstep",
        style: { strokeWidth: 2 },
        className: "distributor-head-hierarchy-flow__edge",
      }}
      proOptions={{ hideAttribution: true }}
    >
      <HierarchyFlowViewport nodes={nodes} frameWidth={frameWidth} />
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
    </ReactFlow>
  );
}

export function DistributorHeadHierarchyChart({
  className,
  overview,
  managers,
  partners,
  stateHeads = [],
  loading = false,
  error = "",
  superHeadName,
  superHeadEmail,
  stateHeadName,
  stateHeadEmail,
  persona,
}: DistributorHeadHierarchyChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const { width } = element.getBoundingClientRect();
      if (width > 0) {
        setFrameWidth((current) => (current === width ? current : width));
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const graph = useMemo(() => {
    if (!overview) {
      return { nodes: [] as Node<HierarchyFlowNodeData>[], edges: [] as Edge[] };
    }

    return buildHierarchyGraph({
      overview,
      managers,
      partners,
      stateHeads,
      superHeadName,
      superHeadEmail,
      stateHeadName,
      stateHeadEmail,
      persona,
      frameWidth: frameWidth || 560,
    });
  }, [
    overview,
    managers,
    partners,
    stateHeads,
    superHeadName,
    superHeadEmail,
    stateHeadName,
    stateHeadEmail,
    persona,
    frameWidth,
  ]);

  const contentHeight = useMemo(() => computeContentHeight(graph.nodes), [graph.nodes]);

  if (loading) {
    return (
      <div className={cn("flex min-h-40 items-center justify-center", className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading hierarchy</span>
      </div>
    );
  }

  if (error) {
    return <AdminFeedbackMessage variant="warning" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage>;
  }

  if (!overview) {
    return (
      <AdminFeedbackMessage variant="warning" dismissible={false}>
        Hierarchy data is unavailable for your account scope.
      </AdminFeedbackMessage>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("distributor-head-hierarchy-flow", className)}
      style={{ height: contentHeight, minHeight: contentHeight }}
    >
      <ReactFlowProvider>
        <HierarchyFlowCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          theme={theme}
          frameWidth={frameWidth || 560}
        />
      </ReactFlowProvider>
    </div>
  );
}
