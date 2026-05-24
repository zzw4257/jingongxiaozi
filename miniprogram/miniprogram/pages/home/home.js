const app = getApp();

function buildMapUrl(options = {}) {
  const params = {
    mode: "map",
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
    webBaseUrl: app.globalData.webBaseUrl
  },

  openMap() {
    wx.navigateTo({
      url: `/pages/web-map/web-map?src=${encodeURIComponent(buildMapUrl())}`
    });
  },

  openMapDirect(event) {
    const { start, target } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/web-map/web-map?src=${encodeURIComponent(buildMapUrl({
        startRoomId: start,
        targetRoomId: target,
        announce: "summary,distance,direction,floorChange"
      }))}`
    });
  }
});
