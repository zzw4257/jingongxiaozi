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

function canOpenWebMap(src) {
  return src && !/^https?:\/\/(127\.0\.0\.1|localhost)(?::|\/|$)/i.test(src);
}

function buildMapUrl(options = {}) {
  const params = {
    mode: "map",
    source: "miniprogram",
    ui: "mobile",
    ...options
  };
  const query = Object.keys(params)
    .filter((key) => params[key])
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
  return `${app.globalData.webBaseUrl}?${query}`;
}

Page({
  data: {
    webBaseUrl: app.globalData.webBaseUrl,
    mapDirects,
    primaryMapDirects,
    secondaryMapDirects,
    showMoreRoutes: false,
    showMapUnavailable: false
  },

  openMap() {
    const src = buildMapUrl();
    if (!canOpenWebMap(src)) {
      this.setData({ showMapUnavailable: true, showMoreRoutes: false });
      return;
    }
    wx.navigateTo({
      url: `/pages/web-map/web-map?src=${encodeURIComponent(src)}`
    });
  },

  openMapDirect(event) {
    const { index } = event.currentTarget.dataset;
    const item = mapDirects[index];
    if (!item) return;
    this.setData({ showMoreRoutes: false });
    const src = buildMapUrl({
      startRoomId: item.startRoomId,
      targetRoomId: item.targetRoomId,
      announce
    });
    if (!canOpenWebMap(src)) {
      this.setData({ showMapUnavailable: true });
      return;
    }
    wx.navigateTo({
      url: `/pages/web-map/web-map?src=${encodeURIComponent(src)}`
    });
  },

  showMoreRoutes() {
    this.setData({ showMoreRoutes: true });
  },

  closeMoreRoutes() {
    this.setData({ showMoreRoutes: false });
  },

  closeMapUnavailable() {
    this.setData({ showMapUnavailable: false });
  },

  noop() {
  }
});
