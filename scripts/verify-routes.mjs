import { createServer } from "vite";

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const { calculateRoute } = await server.ssrLoadModule("/src/features/map/routeService.ts");

  const routeCases = [
    {
      name: "101 -> 104-2F01",
      start: "101",
      target: "104-2F01",
      requiredNodes: ["stair-104-1f", "stair-104-2f"],
      forbiddenInternalNodes: ["stair-public-1f", "stair-public-2f"],
    },
    {
      name: "101 -> 108-2F04",
      start: "101",
      target: "108-2F04",
      requiredNodes: ["stair-108-1f", "stair-108-2f"],
      forbiddenInternalNodes: ["stair-public-1f", "stair-public-2f"],
    },
    {
      name: "101 -> 106-2F",
      start: "101",
      target: "106-2F",
      requiredNodes: ["stair-106-1f", "stair-106-2f"],
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

    for (const nodeId of test.forbiddenInternalNodes) {
      if (nodeIds.has(nodeId)) throw new Error(`${test.name}: independent upper floor must not use public stair node ${nodeId}`);
    }
  }

  const publicRoute = calculateRoute(jingongMapData, "108-lobby", "202-5");
  if (!publicRoute) throw new Error("108-lobby -> 202-5: route was not generated");
  if (!publicRoute.steps.some((step) => step.kind === "stair")) {
    throw new Error("108-lobby -> 202-5: public second-floor room should use the public stair route");
  }

  console.log("Route constraints verified by live route calculation.");
} finally {
  await server.close();
}
