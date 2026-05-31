const app = getApp();

Page({
  data: {
    src: "",
    canRenderWebView: true,
    loaded: false,
    loadFailed: false,
    lastMessage: null
  },

  onLoad(options) {
    const src = options.src ? decodeURIComponent(options.src) : "";
    const canRenderWebView = src ? !/^https?:\/\/(127\.0\.0\.1|localhost)(?::|\/|$)/i.test(src) : false;
    this.setData({ src, canRenderWebView, loaded: false, loadFailed: false });
  },

  handleLoad() {
    this.setData({ loaded: true, loadFailed: false });
  },

  handleError(event) {
    console.warn("map web-view error", event.detail);
    this.setData({ loadFailed: true });
  },

  handleMessage(event) {
    const messages = event.detail?.data || [];
    const lastMessage = messages[messages.length - 1] || null;
    app.globalData.lastMapMessage = lastMessage;
    this.setData({ lastMessage });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
