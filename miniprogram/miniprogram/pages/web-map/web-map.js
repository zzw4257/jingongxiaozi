const app = getApp();

Page({
  data: {
    src: "",
    loaded: false,
    lastMessage: null
  },

  onLoad(options) {
    const src = options.src ? decodeURIComponent(options.src) : "";
    this.setData({ src });
  },

  handleLoad() {
    this.setData({ loaded: true });
  },

  handleError(event) {
    console.warn("map web-view error", event.detail);
  },

  handleMessage(event) {
    const messages = event.detail?.data || [];
    const lastMessage = messages[messages.length - 1] || null;
    app.globalData.lastMapMessage = lastMessage;
    this.setData({ lastMessage });
  }
});
