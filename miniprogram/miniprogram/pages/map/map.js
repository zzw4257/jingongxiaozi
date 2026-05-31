const defaultStartRoomId = "101";

const rooms = [
  { id: "101", no: "101", name: "默认起点", floor: "1F", x: 8, y: 58, w: 14, h: 20, area: "public" },
  { id: "102", no: "102", name: "实训室", floor: "1F", x: 23, y: 58, w: 12, h: 20, area: "room" },
  { id: "104-1F01", no: "104", name: "104 一层", floor: "1F", x: 39, y: 57, w: 14, h: 22, area: "workshop" },
  { id: "106", no: "106", name: "106 一层", floor: "1F", x: 56, y: 57, w: 14, h: 22, area: "workshop" },
  { id: "108-lobby", no: "108", name: "108 门厅", floor: "1F", x: 73, y: 50, w: 18, h: 28, area: "workshop" },
  { id: "107-core", no: "107", name: "公共楼梯", floor: "1F", x: 58, y: 22, w: 10, h: 16, area: "stair" },
  { id: "109", no: "109", name: "卫生间", floor: "1F", x: 70, y: 22, w: 10, h: 16, area: "service" },
  { id: "112", no: "112", name: "预留间", floor: "1F", x: 12, y: 23, w: 14, h: 15, area: "utility" },
  { id: "114", no: "114", name: "仓储", floor: "1F", x: 29, y: 23, w: 15, h: 15, area: "utility" },
  { id: "104-2F01", no: "104-2F", name: "104 二层", floor: "2F", x: 39, y: 57, w: 14, h: 20, area: "workshop" },
  { id: "106-2F", no: "106-2F", name: "106 二层", floor: "2F", x: 56, y: 57, w: 14, h: 20, area: "workshop" },
  { id: "108-2F04", no: "108-2F", name: "108 钳工", floor: "2F", x: 74, y: 51, w: 17, h: 26, area: "workshop" },
  { id: "202", no: "202", name: "二层公共区", floor: "2F", x: 54, y: 22, w: 16, h: 16, area: "public" },
  { id: "204", no: "204", name: "教室", floor: "2F", x: 14, y: 22, w: 14, h: 16, area: "room" },
  { id: "208", no: "208", name: "二层房间", floor: "2F", x: 72, y: 22, w: 10, h: 16, area: "room" },
  { id: "210", no: "210", name: "服务空间", floor: "2F", x: 84, y: 22, w: 8, h: 16, area: "service" },
  { id: "202-5", no: "202-5", name: "二层半平台", floor: "25F", x: 54, y: 18, w: 18, h: 18, area: "mezzanine" }
];

const corridors = [
  { id: "c1-main", floor: "1F", x: 8, y: 42, w: 84, h: 10, label: "一层主走廊" },
  { id: "c1-branch", floor: "1F", x: 45, y: 28, w: 28, h: 10, label: "一层支走廊" },
  { id: "c2-main", floor: "2F", x: 12, y: 42, w: 80, h: 10, label: "二层走廊" },
  { id: "c2-202", floor: "2F", x: 50, y: 30, w: 26, h: 10, label: "202 下方实体空间" },
  { id: "c25-platform", floor: "25F", x: 50, y: 40, w: 28, h: 10, label: "二层半连通平台" }
];

const stairs = [
  { id: "stair-public-1", floor: "1F", x: 60, y: 31, label: "公共楼梯下口" },
  { id: "stair-public-2", floor: "2F", x: 60, y: 31, label: "公共楼梯上口" },
  { id: "stair-104", floor: "1F", x: 45, y: 53, label: "104 内梯" },
  { id: "stair-106", floor: "1F", x: 62, y: 53, label: "106 内梯" },
  { id: "stair-108", floor: "1F", x: 82, y: 47, label: "108 内梯" },
  { id: "stair-202", floor: "2F", x: 62, y: 27, label: "202 平台梯" }
];

const routeTemplates = {
  "104-2F01": ["101", "c1-main", "104-door", "stair-104", "104-2F01"],
  "106-2F": ["101", "c1-main", "106-door", "stair-106", "106-2F"],
  "108-2F04": ["101", "c1-main", "108-door", "stair-108", "108-2F04"],
  "202-5": ["108-lobby", "c1-main", "stair-public-1", "stair-public-2", "c2-202", "stair-202", "202-5"],
  "208": ["101", "c1-main", "stair-public-1", "stair-public-2", "c2-main", "208"],
  "210": ["101", "c1-main", "stair-public-1", "stair-public-2", "c2-main", "210"]
};

const routeNodeMeta = {
  "101": { floor: "1F", x: 15, y: 68, title: "101 门口", desc: "从房间中心到门点" },
  "108-lobby": { floor: "1F", x: 82, y: 64, title: "108 门厅", desc: "从 108 门厅出发" },
  "c1-main": { floor: "1F", x: 52, y: 47, title: "一层主走廊", desc: "沿走廊通行，不穿越房间" },
  "104-door": { floor: "1F", x: 46, y: 56, title: "104 门点", desc: "进入 104 后走内部楼梯" },
  "106-door": { floor: "1F", x: 63, y: 56, title: "106 门点", desc: "进入 106 后走内部楼梯" },
  "108-door": { floor: "1F", x: 82, y: 50, title: "108 门点", desc: "进入 108 后走内部楼梯" },
  "stair-104": { floor: "1F", x: 45, y: 53, title: "104 内梯", desc: "只连接 104 自身二层" },
  "stair-106": { floor: "1F", x: 62, y: 53, title: "106 内梯", desc: "只连接 106 自身二层" },
  "stair-108": { floor: "1F", x: 82, y: 47, title: "108 内梯", desc: "只连接 108 自身二层" },
  "stair-public-1": { floor: "1F", x: 62, y: 34, title: "公共楼梯下口", desc: "从一层走廊上楼" },
  "stair-public-2": { floor: "2F", x: 62, y: 34, title: "公共楼梯上口", desc: "到达二层公共走廊" },
  "c2-main": { floor: "2F", x: 70, y: 47, title: "二层走廊", desc: "沿二层走廊前进" },
  "c2-202": { floor: "2F", x: 62, y: 35, title: "202 下方空间", desc: "二层半投影下仍有实体结构" },
  "stair-202": { floor: "2F", x: 62, y: 27, title: "202 平台梯", desc: "进入二层半平台" },
  "104-2F01": { floor: "2F", x: 46, y: 66, title: "104 二层", desc: "到达目标门点" },
  "106-2F": { floor: "2F", x: 63, y: 66, title: "106 二层", desc: "到达目标门点" },
  "108-2F04": { floor: "2F", x: 82, y: 64, title: "108 钳工二层", desc: "到达目标门点" },
  "202-5": { floor: "25F", x: 63, y: 47, title: "202-5 平台", desc: "到达二层半平台" },
  "208": { floor: "2F", x: 77, y: 31, title: "208", desc: "到达目标门点" },
  "210": { floor: "2F", x: 88, y: 31, title: "210", desc: "到达目标门点" }
};

const floorTitles = {
  "1F": "一层",
  "2F": "二层",
  "25F": "二层半"
};

const floorOrder = ["1F", "2F", "25F"];

function rectStyle(item) {
  return `left:${item.x}%;top:${item.y}%;width:${item.w}%;height:${item.h}%;`;
}

function pointStyle(item) {
  return `left:${item.x}%;top:${item.y}%;`;
}

function buildRoute(targetRoomId, startRoomId) {
  const template = routeTemplates[targetRoomId] || routeTemplates["202-5"];
  const nodes = template.map((id, index) => {
    const meta = routeNodeMeta[id];
    return {
      id,
      index,
      floor: meta.floor,
      title: meta.title,
      desc: index === 0 && startRoomId ? `起点 ${startRoomId}：${meta.desc}` : meta.desc,
      style: pointStyle(meta),
      active: index === 0,
      target: index === template.length - 1,
      stair: id.includes("stair"),
      className: [
        "route-node",
        index === 0 ? "current" : "",
        index === template.length - 1 ? "target" : "",
        id.includes("stair") ? "stair-node" : ""
      ].filter(Boolean).join(" ")
    };
  });
  return {
    targetRoomId,
    nodes,
    steps: nodes.map((node, index) => ({
      id: `${node.id}-${index}`,
      no: index + 1,
      title: node.title,
      desc: node.desc,
      stair: node.stair,
      target: node.target,
      className: [
        "step-card",
        node.stair ? "stair" : "",
        node.target ? "target" : ""
      ].filter(Boolean).join(" ")
    })),
    summary: `${nodes[0].title} → ${nodes[nodes.length - 1].title}`,
    distance: `${Math.max(18, nodes.length * 9)}m`
  };
}

function buildFloor(floorId, layerMode, route) {
  const floorRooms = rooms
    .filter((room) => room.floor === floorId)
    .map((room) => ({
      ...room,
      style: rectStyle(room),
      active: Boolean(route && (route.targetRoomId === room.id || route.nodes.some((node) => node.id === room.id))),
      className: [
        "room",
        `area-${room.area}`,
        route && (route.targetRoomId === room.id || route.nodes.some((node) => node.id === room.id)) ? "active" : ""
      ].filter(Boolean).join(" ")
    }));
  const floorCorridors = corridors
    .filter((corridor) => corridor.floor === floorId)
    .map((corridor) => ({ ...corridor, style: rectStyle(corridor) }));
  const floorStairs = stairs
    .filter((stair) => stair.floor === floorId)
    .map((stair) => {
      const active = Boolean(route && route.nodes.some((node) => node.id === stair.id));
      return {
        ...stair,
        style: pointStyle(stair),
        active,
        className: ["stair", active ? "active" : ""].filter(Boolean).join(" ")
      };
    });
  const routeNodes = route ? route.nodes.filter((node) => node.floor === floorId) : [];
  const index = floorOrder.indexOf(floorId);
  const allModeStyle = `margin-left:${index * 18}rpx;margin-top:${index * -42}rpx;z-index:${10 + index};`;
  const singleStyle = "margin-left:0;margin-top:0;z-index:20;";
  return {
    floorId,
    title: floorTitles[floorId],
    rooms: floorRooms,
    corridors: floorCorridors,
    stairs: floorStairs,
    routeNodes,
    style: layerMode === "all" ? allModeStyle : singleStyle
  };
}

function panelButtonClass(panel, value) {
  return panel === value ? "active" : "";
}

function layerButtonClass(layerMode, value) {
  return layerMode === value ? "active" : "";
}

Page({
  data: {
    layerMode: "all",
    targetRoomId: "",
    startRoomId: defaultStartRoomId,
    route: null,
    hasRoute: false,
    routeSteps: [],
    routeDistanceLabel: "未选择终点",
    visibleFloors: [],
    selectedRoom: null,
    selectedFloorLabel: "点击地图房间",
    panel: "route",
    routeButtonClass: "active",
    layersButtonClass: "",
    roomButtonClass: "",
    allLayerClass: "active",
    layer1FClass: "",
    layer2FClass: "",
    layer25FClass: "",
    quickTargets: [
      { id: "104-2F01", label: "104 二层" },
      { id: "202-5", label: "202-5" },
      { id: "108-2F04", label: "108 二层" },
      { id: "208", label: "208" }
    ]
  },

  onLoad(options) {
    const targetRoomId = options.targetRoomId || "";
    const startRoomId = options.startRoomId || defaultStartRoomId;
    const route = targetRoomId ? buildRoute(targetRoomId, startRoomId) : null;
    this.setRouteState({ targetRoomId, startRoomId, route });
  },

  setRouteState(next) {
    const route = next.route || null;
    this.setData({
      ...next,
      route,
      hasRoute: Boolean(route),
      routeSteps: route ? route.steps : [],
      routeDistanceLabel: route ? route.distance : "未选择终点"
    }, () => this.refreshFloors());
  },

  refreshFloors() {
    const { layerMode, route } = this.data;
    const ids = layerMode === "all" ? floorOrder : [layerMode];
    this.setData({ visibleFloors: ids.map((floorId) => buildFloor(floorId, layerMode, route)) });
  },

  setLayer(event) {
    const layerMode = event.currentTarget.dataset.layer;
    this.setData({
      layerMode,
      allLayerClass: layerButtonClass(layerMode, "all"),
      layer1FClass: layerButtonClass(layerMode, "1F"),
      layer2FClass: layerButtonClass(layerMode, "2F"),
      layer25FClass: layerButtonClass(layerMode, "25F")
    }, () => this.refreshFloors());
  },

  openPanel(event) {
    const panel = event.currentTarget.dataset.panel;
    this.setData({
      panel,
      routeButtonClass: panelButtonClass(panel, "route"),
      layersButtonClass: panelButtonClass(panel, "layers"),
      roomButtonClass: panelButtonClass(panel, "room")
    });
  },

  selectRoom(event) {
    const id = event.currentTarget.dataset.id;
    const selectedRoom = rooms.find((room) => room.id === id);
    this.setData({
      selectedRoom,
      selectedFloorLabel: selectedRoom ? selectedRoom.floor : "点击地图房间",
      panel: "room",
      routeButtonClass: "",
      layersButtonClass: "",
      roomButtonClass: "active"
    });
  },

  selectQuickTarget(event) {
    const targetRoomId = event.currentTarget.dataset.id;
    const route = buildRoute(targetRoomId, this.data.startRoomId);
    this.setRouteState({ targetRoomId, route, panel: "route" });
  },

  clearRoute() {
    this.setRouteState({ targetRoomId: "", route: null, panel: "route" });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
