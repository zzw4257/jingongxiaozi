"use strict";

const DEFAULT_HOST_STORAGE_KEY = "duplexkit.backend.host";
const DEFAULT_PORT_STORAGE_KEY = "duplexkit.backend.port";
const DEFAULT_PORT = "5177";

function normalizeBaseUrl(options = {}) {
  const host = String(options.host || "").trim();
  const port = String(options.port || DEFAULT_PORT).trim();
  if (!host) return "";
  if (/^https?:\/\//i.test(host)) return host.replace(/\/+$/, "");
  return `http://${host}${port ? `:${port}` : ""}`;
}

function readBackendEndpoint() {
  const host = wx.getStorageSync(DEFAULT_HOST_STORAGE_KEY) || "";
  const port = wx.getStorageSync(DEFAULT_PORT_STORAGE_KEY) || DEFAULT_PORT;
  return {
    host,
    port,
    baseUrl: normalizeBaseUrl({ host, port }),
  };
}

function toolResultForRequest(request, mapState = {}, progress) {
  const route = mapState.route;
  const targetLabel = route?.targetRoomId || mapState.targetRoomId || "当前终点";
  if (request.tool === "navigation.next") {
    return progress
      ? { summary: `已切到第${progress.activeLegIndex + 1}段，下一处是${progress.checkpointLabel}`, visibleResult: `当前段：${progress.instruction}` }
      : { summary: "已请求切到下一段", visibleResult: "小程序地图将切到下一段导航。" };
  }
  if (request.tool === "navigation.previous") {
    return progress
      ? { summary: `已回到第${progress.activeLegIndex + 1}段，下一处是${progress.checkpointLabel}`, visibleResult: `当前段：${progress.instruction}` }
      : { summary: "已请求回到上一段", visibleResult: "小程序地图将回到上一段导航。" };
  }
  if (request.tool === "navigation.status") {
    return progress
      ? { summary: `当前第${progress.activeLegIndex + 1}段，到${progress.checkpointLabel}还有${Math.round(progress.distanceMeters)}米`, visibleResult: `剩余约${Math.round(progress.remainingMeters)}米：${progress.instruction}` }
      : { summary: "当前没有可播报的导航进度", visibleResult: "请先开始地图导航。" };
  }
  if (request.tool === "navigation.start") {
    return { summary: `导航已启动，目的地是${targetLabel}`, visibleResult: `金工小子小程序地图已显示到 ${targetLabel} 的路线。` };
  }
  if (request.tool === "map.close") {
    return { summary: "地图已关闭", visibleResult: "小程序地图已返回首页。" };
  }
  return { summary: "小程序地图已收到工具请求", visibleResult: "小程序地图已处理后端工具请求。" };
}

function createMiniProgramBackendBridge(handlers = {}) {
  let socket = null;
  let connected = false;
  let endpoint = readBackendEndpoint();
  let latestProgress;

  const notify = (state, extra = {}) => {
    handlers.onStatus?.({ state, connected, endpoint, ...extra });
  };

  const sendJson = (payload) => {
    if (!socket || !connected) return false;
    socket.send({
      data: JSON.stringify(payload),
      fail: (error) => notify("send-failed", { error }),
    });
    return true;
  };

  const sendNavigationProgress = (progress) => {
    latestProgress = progress;
    return sendJson(progress);
  };

  const sendToolResult = (request, mapState, progress = latestProgress) => {
    const result = toolResultForRequest(request, mapState, progress);
    return sendJson({
      type: "tool_result",
      toolCallId: request.toolCallId,
      tool: request.tool,
      status: "success",
      summary: result.summary,
      visibleResult: result.visibleResult,
      debugNote: "jingongxiaozi miniprogram bridge acknowledged tool_request",
    });
  };

  const handleToolRequest = (request) => {
    if (!request?.toolCallId || !request?.tool) return;
    const progress = handlers.onToolRequest?.(request, latestProgress) || latestProgress;
    sendToolResult(request, handlers.getMapState?.() || {}, progress);
  };

  const connect = (override = {}) => {
    endpoint = { ...readBackendEndpoint(), ...override };
    endpoint.baseUrl = normalizeBaseUrl(endpoint);
    if (!endpoint.baseUrl) {
      notify("missing-endpoint");
      return false;
    }
    if (socket) socket.close({ reason: "reconnect" });
    const wsUrl = endpoint.baseUrl.replace(/^http/i, "ws") + "/api/realtime";
    notify("connecting");
    socket = wx.connectSocket({ url: wsUrl });
    socket.onOpen(() => {
      connected = true;
      notify("connected");
      if (latestProgress) sendNavigationProgress(latestProgress);
    });
    socket.onMessage((event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (message?.type === "tool_request") handleToolRequest(message.request);
      else handlers.onMessage?.(message);
    });
    socket.onError((error) => {
      connected = false;
      notify("error", { error });
    });
    socket.onClose(() => {
      connected = false;
      notify("closed");
    });
    return true;
  };

  const disconnect = () => {
    if (socket) socket.close({ reason: "manual-disconnect" });
    socket = null;
    connected = false;
    notify("idle");
  };

  const probeTools = (override = {}) => {
    endpoint = { ...readBackendEndpoint(), ...override };
    endpoint.baseUrl = normalizeBaseUrl(endpoint);
    return new Promise((resolve, reject) => {
      if (!endpoint.baseUrl) {
        reject(new Error("missing backend endpoint"));
        return;
      }
      wx.request({
        url: `${endpoint.baseUrl}/api/tools`,
        method: "GET",
        success(response) {
          const tools = response.data?.tools || [];
          const protocolMessages = response.data?.realtimeProtocol?.clientMessages || [];
          const names = tools.map((tool) => tool.name);
          const hasNavigationProgress = protocolMessages.some((message) => message.type === "navigation_progress");
          const required = ["navigation.next", "navigation.previous", "navigation.status"];
          const missing = required.filter((name) => !names.includes(name));
          if (missing.length || !hasNavigationProgress) {
            reject(new Error(`backend protocol mismatch: missing=${missing.join(",") || "-"} navigation_progress=${hasNavigationProgress}`));
            return;
          }
          resolve({ tools, hasNavigationProgress });
        },
        fail(error) {
          reject(error);
        },
      });
    });
  };

  return {
    connect,
    disconnect,
    probeTools,
    sendNavigationProgress,
    sendToolResult,
    isConnected: () => connected,
    endpoint: () => endpoint,
  };
}

module.exports = {
  createMiniProgramBackendBridge,
  normalizeBaseUrl,
  readBackendEndpoint,
  toolResultForRequest,
};
