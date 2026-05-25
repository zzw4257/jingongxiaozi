import type { GuidanceLeg, MapData, MapRoom, NavEdge, NavNode, RouteResult, RouteStep } from "./types";

const nodeDistance = (a: [number, number], b: [number, number], scale: number): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy) * scale;
};

export function getRoomById(data: MapData, roomId?: string): MapRoom | undefined {
  return data.rooms.find((room) => room.id === roomId);
}

function buildGraph(data: MapData) {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Array<{ to: string; edge: NavEdge; weight: number }>>();

  for (const edge of data.edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (!fromNode || !toNode) continue;
    const weight = edge.distance ?? nodeDistance(fromNode.point, toNode.point, data.scaleMetersPerUnit);
    const add = (from: string, to: string) => {
      const next = adjacency.get(from) ?? [];
      next.push({ to, edge, weight });
      adjacency.set(from, next);
    };
    add(edge.from, edge.to);
    add(edge.to, edge.from);
  }

  return { nodes, adjacency };
}

export function calculateRoute(data: MapData, startRoomId: string, targetRoomId: string): RouteResult | undefined {
  if (startRoomId === targetRoomId) return undefined;

  const startRoom = getRoomById(data, startRoomId);
  const targetRoom = getRoomById(data, targetRoomId);
  if (!startRoom || !targetRoom) return undefined;

  const { nodes, adjacency } = buildGraph(data);
  const startNodeId = `center-${startRoom.id}`;
  const targetNodeId = `center-${targetRoom.id}`;
  if (!nodes.has(startNodeId) || !nodes.has(targetNodeId)) return undefined;
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: NavEdge; weight: number }>();
  const unvisited = new Set(nodes.keys());

  for (const nodeId of nodes.keys()) {
    distances.set(nodeId, Number.POSITIVE_INFINITY);
  }
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let current: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < best) {
        best = distance;
        current = nodeId;
      }
    }

    if (!current || current === targetNodeId) break;
    unvisited.delete(current);

    for (const next of adjacency.get(current) ?? []) {
      if (!unvisited.has(next.to)) continue;
      const alt = best + next.weight;
      if (alt < (distances.get(next.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next.to, alt);
        previous.set(next.to, { nodeId: current, edge: next.edge, weight: next.weight });
      }
    }
  }

  if (!previous.has(targetNodeId)) return undefined;

  const pathNodeIds = [targetNodeId];
  let cursor = targetNodeId;
  const pathEdges: Array<{ from: string; to: string; edge: NavEdge; weight: number }> = [];

  while (cursor !== startNodeId) {
    const prior = previous.get(cursor);
    if (!prior) return undefined;
    pathEdges.unshift({ from: prior.nodeId, to: cursor, edge: prior.edge, weight: prior.weight });
    cursor = prior.nodeId;
    pathNodeIds.unshift(cursor);
  }

  const steps: RouteStep[] = pathEdges.map((pathEdge) => {
    const fromNode = nodes.get(pathEdge.from)!;
    const toNode = nodes.get(pathEdge.to)!;
    return {
      fromNodeId: pathEdge.from,
      toNodeId: pathEdge.to,
      floor: fromNode.floor,
      distanceMeters: Math.round(pathEdge.weight),
      kind: pathEdge.edge.kind,
      note: pathEdge.edge.note ?? (fromNode.floor !== toNode.floor ? `${fromNode.floor} 到 ${toNode.floor}` : undefined),
    };
  });

  const totalMeters = Math.round(distances.get(targetNodeId) ?? 0);
  const estimatedSeconds = Math.max(20, Math.round((totalMeters / 0.8) + steps.filter((step) => step.kind.includes("stair")).length * 18));
  const points = pathNodeIds
    .map((nodeId, index) => {
      const navNode = nodes.get(nodeId);
      if (!navNode) return undefined;
      const leadingStep = steps.find((step) => step.toNodeId === nodeId);
      return {
        nodeId,
        floor: navNode.floor,
        point: navNode.point,
        kind: index === 0 ? navNode.kind : leadingStep?.kind ?? navNode.kind,
      };
    })
    .filter(Boolean) as RouteResult["points"];

  const floorChanges = steps.filter((step) => step.kind === "stair" || step.kind === "internal-stair");
  const guidanceLegs = buildGuidanceLegs(data, steps, nodes);
  const notableSteps = compactRouteSteps(steps);

  return {
    id: `${startRoomId}->${targetRoomId}`,
    startRoomId,
    targetRoomId,
    totalMeters,
    estimatedSeconds,
    steps,
    guidanceLegs,
    points,
    announceLines: [
      `从 ${startRoom.roomNo} ${startRoom.name} 前往 ${targetRoom.roomNo} ${targetRoom.name}`,
      `全程约 ${totalMeters} 米，预计 ${formatSeconds(estimatedSeconds)}。`,
      ...notableSteps,
      ...floorChanges
        .filter((step) => step.kind === "internal-stair")
        .map((step) => step.note ?? "需要经过内部楼梯跨楼层。"),
    ],
  };
}

function nodeLabel(node?: NavNode): string {
  if (!node) return "下一节点";
  if (node.kind === "room-center") return node.label ? `${node.label}内` : "房间内";
  if (node.kind === "door") return node.label ? `${node.label}门口` : "门口";
  if (node.kind === "stair") return node.label ? `${node.label}楼梯口` : "楼梯口";
  if (node.kind === "corridor") return node.label ?? "走廊转折点";
  if (node.kind === "space-center") {
    const label = node.label ?? "";
    if (label.includes("走廊") || label.includes("过道") || label.includes("通行")) return label.includes("二层") ? "二层走廊" : "走廊";
    if (label.includes("楼梯")) return "楼梯口";
    return label ? `${label}附近` : "公共空间";
  }
  if (node.label) return node.label;
  return "走廊节点";
}

function roomForNodeId(data: MapData, nodeId: string): MapRoom | undefined {
  const centerMatch = nodeId.match(/^center-(.+)$/);
  if (centerMatch) return getRoomById(data, centerMatch[1]);
  return data.rooms.find((room) => room.doorNodeId === nodeId);
}

function roomDoorLabel(data: MapData, nodeId: string): string | undefined {
  const room = roomForNodeId(data, nodeId);
  return room ? `${room.roomNo} 门口` : undefined;
}

function routeNodeLabel(data: MapData, nodeId: string, node?: NavNode): string {
  const room = roomForNodeId(data, nodeId);
  if (room && node?.kind === "room-center") return `${room.roomNo} 房间内`;
  if (room && node?.kind === "door") return `${room.roomNo} 门口`;
  if (node?.kind === "corridor") return node.label ?? "走廊转折点";
  return nodeLabel(node);
}

function stepInstruction(data: MapData, step: RouteStep, fromNode?: NavNode, toNode?: NavNode): string {
  const toLabel = routeNodeLabel(data, step.toNodeId, toNode);
  if (step.kind === "room-entry") {
    return fromNode?.kind === "room-center" ? `从房间内走到 ${toLabel}` : `进入 ${toLabel}`;
  }
  const note = step.note ? sanitizeStepNote(step.note) : undefined;
  if (step.kind === "door") {
    if (fromNode?.kind === "door" && toNode?.kind === "space-center") return `从 ${routeNodeLabel(data, step.fromNodeId, fromNode)} 出门进入走廊`;
    if (note) return note;
    return `通过 ${toLabel}`;
  }
  if (note) return note;
  if (step.kind === "corridor") {
    const destination = toLabel.includes("走廊") ? "下一个转向点" : toLabel;
    return `沿走廊前进约 ${step.distanceMeters} 米到${destination}`;
  }
  if (step.kind === "internal-stair") return "经房间内部楼梯上下楼";
  if (step.kind === "stair") return "经公共楼梯上下楼";
  return `前往${toLabel}`;
}

function checkpointKind(step: RouteStep, toNode?: NavNode): GuidanceLeg["checkpointKind"] {
  if (step.kind === "stair" || step.kind === "internal-stair" || toNode?.kind === "stair") return "stair";
  if (toNode?.kind === "door" || step.kind === "door") return "door";
  if (toNode?.kind === "room-center") return "destination";
  if (toNode?.kind === "space-center") return "turn";
  if (step.kind === "corridor") return "corridor";
  return "room";
}

function checkpointLabel(data: MapData, step: RouteStep, fromNode?: NavNode, toNode?: NavNode): string {
  if (step.kind === "room-entry" && toNode?.kind === "door") return roomDoorLabel(data, step.toNodeId) ?? nodeLabel(toNode);
  if (step.kind === "door" && fromNode?.kind === "door" && toNode?.kind === "space-center") return `${roomDoorLabel(data, step.fromNodeId) ?? "房间门口"}外走廊`;
  if (step.kind === "door" && toNode?.kind !== "door") return "走廊入口";
  const label = nodeLabel(toNode);
  const kind = checkpointKind(step, toNode);
  if (kind === "stair") return label.includes("楼梯") ? label : `${label}楼梯口`;
  if (kind === "door") return label.includes("门") ? label : `${label}门口`;
  if (kind === "destination") return label.replace(/内$/, "") || "终点";
  if (kind === "turn" || kind === "corridor") return label.includes("走廊") ? "走廊转折点" : label;
  return label;
}

function actionLabel(kind: GuidanceLeg["checkpointKind"]): string {
  if (kind === "stair") return "到达楼梯口";
  if (kind === "door") return "到达门口";
  if (kind === "destination") return "到达终点";
  if (kind === "turn" || kind === "corridor") return "到达转折点";
  return "到达此处";
}

function sanitizeStepNote(note: string): string {
  return note
    .replace(/从\s*([A-Za-z0-9-]+)\s*门进入公共通行线/g, "从 $1 门口进入走廊")
    .replace(/从\s*([A-Za-z0-9-]+)\s*中心移动到门口/g, "从房间内走到 $1 门口")
    .replace(/公共通行线/g, "走廊");
}

function portalNodeIdsForStep(step: RouteStep, fromNode?: NavNode, toNode?: NavNode): string[] {
  const ids: string[] = [];
  if (fromNode?.kind === "door" || fromNode?.kind === "stair" || step.kind === "room-entry") ids.push(step.fromNodeId);
  if (toNode?.kind === "door" || toNode?.kind === "stair" || step.kind === "door" || step.kind.includes("stair")) ids.push(step.toNodeId);
  return [...new Set(ids)];
}

function buildGuidanceLegs(data: MapData, steps: RouteStep[], nodes: Map<string, NavNode>): GuidanceLeg[] {
  return steps.map((step, index) => {
    const fromNode = nodes.get(step.fromNodeId);
    const toNode = nodes.get(step.toNodeId);
    const kind = checkpointKind(step, toNode);
    return {
      ...step,
      id: `${step.fromNodeId}->${step.toNodeId}`,
      index,
      fromLabel: routeNodeLabel(data, step.fromNodeId, fromNode),
      toLabel: routeNodeLabel(data, step.toNodeId, toNode),
      checkpointLabel: checkpointLabel(data, step, fromNode, toNode),
      checkpointKind: kind,
      actionLabel: actionLabel(kind),
      instruction: stepInstruction(data, step, fromNode, toNode),
      portalNodeIds: portalNodeIdsForStep(step, fromNode, toNode),
    };
  });
}

export function compactRouteSteps(steps: RouteStep[]): string[] {
  const lines: string[] = [];
  let walkMeters = 0;

  for (const step of steps) {
    if (step.kind === "corridor" || step.kind === "door" || step.kind === "room-entry") {
      if (step.note?.includes("二层半")) {
        if (walkMeters > 0) {
          lines.push(`沿走廊前进约 ${walkMeters} 米。`);
          walkMeters = 0;
        }
        lines.push(step.note);
        continue;
      }
      walkMeters += step.distanceMeters;
      continue;
    }

    if (walkMeters > 0) {
      lines.push(`沿走廊前进约 ${walkMeters} 米。`);
      walkMeters = 0;
    }
    if (step.kind === "internal-stair") {
      lines.push(step.note ?? "经房间内部楼梯上下楼。");
    } else {
      lines.push(step.note ?? "经公共楼梯上下楼。");
    }
  }

  if (walkMeters > 0) {
    lines.push(`继续前进约 ${walkMeters} 米到达目标附近。`);
  }

  return lines;
}

export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes <= 0) return `${remain}秒`;
  if (remain === 0) return `${minutes}分钟`;
  return `${minutes}分${remain}秒`;
}
