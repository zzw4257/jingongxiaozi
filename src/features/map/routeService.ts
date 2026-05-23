import type { MapData, MapRoom, NavEdge, RouteResult, RouteStep } from "./types";

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
  const notableSteps = compactRouteSteps(steps);

  return {
    id: `${startRoomId}->${targetRoomId}`,
    startRoomId,
    targetRoomId,
    totalMeters,
    estimatedSeconds,
    steps,
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
