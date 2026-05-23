import { createServer } from "vite";

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const { calculateRoute } = await server.ssrLoadModule("/src/features/map/routeService.ts");

  const assertOrderedNodes = (route, requiredNodes, label) => {
    const nodePath = route.points.map((point) => point.nodeId);
    let cursor = -1;
    for (const nodeId of requiredNodes) {
      const index = nodePath.indexOf(nodeId, cursor + 1);
      if (index === -1) throw new Error(`${label}: required node ${nodeId} is missing or out of order; path=${nodePath.join(" -> ")}`);
      cursor = index;
    }
  };

  const assertStepKindBetween = (route, fromNodeId, toNodeId, kind, label) => {
    const found = route.steps.some(
      (step) =>
        step.kind === kind &&
        ((step.fromNodeId === fromNodeId && step.toNodeId === toNodeId) ||
          (step.fromNodeId === toNodeId && step.toNodeId === fromNodeId)),
    );
    if (!found) throw new Error(`${label}: missing ${kind} segment between ${fromNodeId} and ${toNodeId}`);
  };

  const routeCases = [
    {
      name: "101 -> 104-2F01",
      start: "101",
      target: "104-2F01",
      requiredNodes: ["center-101", "door-101", "stair-104-1f", "stair-104-2f", "door-104-2F01", "center-104-2F01"],
      requiredKinds: ["room-entry", "door", "internal-stair"],
      forbiddenInternalNodes: ["stair-public-1f", "stair-public-2f"],
    },
    {
      name: "101 -> 108-2F04",
      start: "101",
      target: "108-2F04",
      requiredNodes: ["center-101", "door-101", "stair-108-1f", "stair-108-2f", "door-108-2F04", "center-108-2F04"],
      requiredKinds: ["room-entry", "door", "internal-stair"],
      forbiddenInternalNodes: ["stair-public-1f", "stair-public-2f"],
    },
    {
      name: "101 -> 106-2F",
      start: "101",
      target: "106-2F",
      requiredNodes: ["center-101", "door-101", "stair-106-1f", "stair-106-2f", "door-106-2F", "center-106-2F"],
      requiredKinds: ["room-entry", "door", "internal-stair"],
      forbiddenInternalNodes: ["stair-public-1f", "stair-public-2f"],
    },
  ];

  for (const test of routeCases) {
    const route = calculateRoute(jingongMapData, test.start, test.target);
    if (!route) throw new Error(`${test.name}: route was not generated`);

    const nodeIds = new Set(route.steps.flatMap((step) => [step.fromNodeId, step.toNodeId]));
    const hasInternalStair = route.steps.some((step) => step.kind === "internal-stair");
    if (!hasInternalStair) throw new Error(`${test.name}: route must include an internal-stair step`);

    for (const nodeId of test.requiredNodes) {
      if (!nodeIds.has(nodeId)) throw new Error(`${test.name}: missing required node ${nodeId}`);
    }

    for (const kind of test.requiredKinds) {
      if (!route.steps.some((step) => step.kind === kind)) throw new Error(`${test.name}: missing required route segment kind ${kind}`);
    }

    for (const nodeId of test.forbiddenInternalNodes) {
      if (nodeIds.has(nodeId)) throw new Error(`${test.name}: independent upper floor must not use public stair node ${nodeId}`);
    }
    assertOrderedNodes(route, test.requiredNodes, test.name);
    assertStepKindBetween(route, `center-${test.start}`, `door-${test.start}`, "room-entry", test.name);
    assertStepKindBetween(route, `door-${test.target}`, `center-${test.target}`, "room-entry", test.name);
  }

  assertStepKindBetween(calculateRoute(jingongMapData, "101", "104-2F01"), "stair-104-1f", "stair-104-2f", "internal-stair", "101 -> 104-2F01");
  assertStepKindBetween(calculateRoute(jingongMapData, "101", "108-2F04"), "stair-108-1f", "stair-108-2f", "internal-stair", "101 -> 108-2F04");
  assertStepKindBetween(calculateRoute(jingongMapData, "101", "106-2F"), "stair-106-1f", "stair-106-2f", "internal-stair", "101 -> 106-2F");

  const publicRoute = calculateRoute(jingongMapData, "108-lobby", "202-5");
  if (!publicRoute) throw new Error("108-lobby -> 202-5: route was not generated");
  if (!publicRoute.steps.some((step) => step.kind === "stair")) {
    throw new Error("108-lobby -> 202-5: public second-floor room should use the public stair route");
  }
  const publicNodeIds = new Set(publicRoute.steps.flatMap((step) => [step.fromNodeId, step.toNodeId]));
  for (const nodeId of ["center-108-lobby", "door-108-lobby", "stair-public-1f", "stair-public-2f", "c2-202", "door-202-5", "center-202-5"]) {
    if (!publicNodeIds.has(nodeId)) throw new Error(`108-lobby -> 202-5: missing required public-route node ${nodeId}`);
  }
  assertOrderedNodes(publicRoute, ["center-108-lobby", "door-108-lobby", "stair-public-1f", "stair-public-2f", "c2-202", "door-202-5", "center-202-5"], "108-lobby -> 202-5");
  assertStepKindBetween(publicRoute, "stair-public-1f", "stair-public-2f", "stair", "108-lobby -> 202-5");

  console.log("Route constraints verified by live route calculation.");
} finally {
  await server.close();
}
