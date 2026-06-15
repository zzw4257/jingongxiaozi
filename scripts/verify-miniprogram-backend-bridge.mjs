import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const bridgePath = path.join(root, "miniprogram/miniprogram/packages/map/lib/backend-bridge.js");
const source = fs.readFileSync(bridgePath, "utf8");

function loadBridge(wxMock) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, wx: wxMock, console }, { filename: bridgePath });
  return module.exports;
}

async function verifyProbeTools() {
  const requested = [];
  const wxMock = {
    getStorageSync(key) {
      if (key === "duplexkit.backend.host") return "127.0.0.1";
      if (key === "duplexkit.backend.port") return "5188";
      return "";
    },
    request(options) {
      requested.push(options.url);
      options.success({
        data: {
          tools: [
            { name: "map.open" },
            { name: "navigation.start" },
            { name: "navigation.next" },
            { name: "navigation.previous" },
            { name: "navigation.status" },
          ],
          realtimeProtocol: {
            clientMessages: [{ type: "tool_result" }, { type: "navigation_progress" }],
          },
        },
      });
    },
  };
  const { createMiniProgramBackendBridge } = loadBridge(wxMock);
  const bridge = createMiniProgramBackendBridge();
  const result = await bridge.probeTools();
  if (!result.hasNavigationProgress) throw new Error("probeTools did not verify navigation_progress support");
  if (!requested[0]?.includes("http://127.0.0.1:5188/api/tools")) throw new Error(`probeTools used wrong URL: ${requested[0]}`);
}

function verifyToolRequestFlow() {
  const sent = [];
  let onMessage;
  let onOpen;
  const wxMock = {
    getStorageSync(key) {
      if (key === "duplexkit.backend.host") return "10.0.0.2";
      if (key === "duplexkit.backend.port") return "5177";
      return "";
    },
    connectSocket(options) {
      if (options.url !== "ws://10.0.0.2:5177/api/realtime") throw new Error(`wrong websocket URL: ${options.url}`);
      return {
        send({ data }) { sent.push(JSON.parse(data)); },
        close() {},
        onOpen(handler) { onOpen = handler; },
        onMessage(handler) { onMessage = handler; },
        onError() {},
        onClose() {},
      };
    },
  };
  const { createMiniProgramBackendBridge } = loadBridge(wxMock);
  let activeIndex = 0;
  const bridge = createMiniProgramBackendBridge({
    getMapState: () => ({ route: { targetRoomId: "202-5" }, targetRoomId: "202-5" }),
    onToolRequest(request) {
      if (request.tool === "navigation.next") activeIndex += 1;
      return {
        type: "navigation_progress",
        routeId: "101->202-5",
        activeLegIndex: activeIndex,
        totalLegs: 9,
        routeSummary: "101 → 202-5",
        fromLabel: "101 门口",
        checkpointLabel: "走廊入口",
        checkpointKind: "door",
        instruction: "出门进入走廊",
        distanceMeters: 1,
        current: { nodeId: "door-101", label: "101 门口", floor: "1F" },
        next: { nodeId: "c1-101", label: "走廊入口", floor: "1F", kind: "door", distanceMeters: 1, instruction: "出门进入走廊" },
        destination: { roomId: "202-5", label: "202-5", floor: "2F" },
        guidance: {
          phase: "walk",
          userAction: "confirm_next",
          currentSegmentLabel: "101 门口 → 走廊入口",
          nextActionLabel: "到达该节点后点下一步，或说下一步",
          canManualAdvance: true,
          canVoiceAdvance: true,
        },
        heading: { calibrated: false, available: false, status: "小程序宿主暂未提供方向传感器数据；地图按真实北向显示。" },
        remainingMeters: 74,
        remainingSeconds: 109,
        completed: false,
        announce: true,
        reason: "manual_next",
      };
    },
  });
  if (!bridge.connect()) throw new Error("bridge did not start connecting");
  onOpen?.();
  bridge.sendNavigationProgress({
    type: "navigation_progress",
    routeId: "101->202-5",
    activeLegIndex: 0,
    totalLegs: 9,
    routeSummary: "101 → 202-5",
    fromLabel: "101 房间内",
    checkpointLabel: "101 门口",
    checkpointKind: "door",
    instruction: "从房间中心走到门口",
    distanceMeters: 5,
    current: { nodeId: "center-101", label: "101 房间内", floor: "1F" },
    next: { nodeId: "door-101", label: "101 门口", floor: "1F", kind: "door", distanceMeters: 5, instruction: "从房间中心走到门口" },
    destination: { roomId: "202-5", label: "202-5", floor: "2F" },
    guidance: {
      phase: "depart",
      userAction: "confirm_next",
      currentSegmentLabel: "101 房间内 → 101 门口",
      nextActionLabel: "到达该节点后点下一步，或说下一步",
      canManualAdvance: true,
      canVoiceAdvance: true,
    },
    heading: { calibrated: false, available: false, status: "小程序宿主暂未提供方向传感器数据；地图按真实北向显示。" },
    remainingMeters: 79,
    remainingSeconds: 117,
    completed: false,
    announce: true,
    reason: "route_started",
  });
  onMessage?.({ data: JSON.stringify({ type: "tool_request", request: { toolCallId: "tc-1", tool: "navigation.next", args: {} } }) });
  onMessage?.({ data: JSON.stringify({ type: "tool_request", request: { toolCallId: "tc-2", tool: "map.open", args: {} } }) });
  onMessage?.({ data: JSON.stringify({ type: "tool_request", request: { toolCallId: "tc-3", tool: "navigation.start", args: { place: "202-5" } } }) });
  const startedProgress = sent.find((item) => item.type === "navigation_progress" && item.reason === "route_started");
  if (!startedProgress) {
    throw new Error("bridge did not send navigation_progress");
  }
  if (!startedProgress.guidance?.canVoiceAdvance || !startedProgress.heading?.status) {
    throw new Error("bridge navigation_progress must preserve guidance and heading facts");
  }
  if (!sent.some((item) => item.type === "tool_result" && item.toolCallId === "tc-1" && item.tool === "navigation.next")) {
    throw new Error("bridge did not answer navigation.next with tool_result");
  }
  if (!sent.some((item) => item.type === "tool_result" && item.toolCallId === "tc-2" && item.tool === "map.open")) {
    throw new Error("bridge did not answer map.open with tool_result");
  }
  if (!sent.some((item) => item.type === "tool_result" && item.toolCallId === "tc-3" && item.tool === "navigation.start")) {
    throw new Error("bridge did not answer navigation.start with tool_result");
  }
}

await verifyProbeTools();
verifyToolRequestFlow();
console.log("Mini program backend bridge verified.");
