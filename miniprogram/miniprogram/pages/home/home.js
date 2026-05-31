const app = getApp();

const announce = "summary,distance,direction,floorChange";

const mapDirects = [
  {
    id: "104-2F01",
    title: "104 二层",
    desc: "从房间内楼梯上楼",
    targetRoomId: "104-2F01",
    badge: "内梯"
  },
  {
    id: "202-5",
    title: "202-5",
    desc: "到二层半平台",
    startRoomId: "108-lobby",
    targetRoomId: "202-5",
    badge: "2.5F"
  },
  {
    id: "108-2F04",
    title: "108 钳工",
    desc: "走 108 内部楼梯",
    targetRoomId: "108-2F04",
    badge: "内梯"
  },
  {
    id: "106-2F",
    title: "106 二层",
    desc: "从门点进入房间",
    targetRoomId: "106-2F",
    badge: "门点"
  },
  {
    id: "208",
    title: "208",
    desc: "二层公共走廊",
    targetRoomId: "208",
    badge: "2F"
  },
  {
    id: "210",
    title: "210",
    desc: "二层服务空间",
    targetRoomId: "210",
    badge: "2F"
  }
];

const primaryMapDirects = mapDirects.slice(0, 3).map((item, index) => ({ ...item, originalIndex: index }));
const secondaryMapDirects = mapDirects.slice(3).map((item, index) => ({
  ...item,
  originalIndex: index + primaryMapDirects.length
}));

function buildMapQuery(options = {}) {
  const params = {
    source: "miniprogram",
    ui: "mobile",
    ...options
  };
  const query = Object.keys(params)
    .filter((key) => params[key])
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
  return query ? `?${query}` : "";
}

Page({
  data: {
    mapDirects,
    primaryMapDirects,
    secondaryMapDirects,
    showAppDrawer: false,
    showMoreRoutes: false
  },

  openMap() {
    app.globalData.lastMapDirective = { source: "manual" };
    wx.navigateTo({
      url: `/pages/map/map${buildMapQuery()}`,
      fail: () => wx.showToast({ title: "地图未打开", icon: "none" })
    });
  },

  openMapDirect(event) {
    const { index } = event.currentTarget.dataset;
    const item = mapDirects[index];
    if (!item) return;
    this.setData({ showMoreRoutes: false });
    const request = {
      startRoomId: item.startRoomId,
      targetRoomId: item.targetRoomId,
      announce
    };
    app.globalData.lastMapDirective = { source: "miniprogram", request };
    wx.navigateTo({
      url: `/pages/map/map${buildMapQuery(request)}`,
      fail: () => wx.showToast({ title: "地图未打开", icon: "none" })
    });
  },

  openAppDrawer() {
    this.setData({ showAppDrawer: true, showMoreRoutes: false });
  },

  closeAppDrawer() {
    this.setData({ showAppDrawer: false });
  },

  showMoreRoutes() {
    this.setData({ showMoreRoutes: true, showAppDrawer: false });
  },

  closeMoreRoutes() {
    this.setData({ showMoreRoutes: false });
  },

  noop() {
  }
});
