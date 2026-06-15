Page({
  data: {
    answer: "我在这里。你可以询问金工中心位置、房间路线或操作提示。",
    keywords: ["常态对话", "路线咨询", "语音播报"]
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.reLaunch({ url: "/pages/home/home" })
    });
  },

  openMap() {
    wx.reLaunch({ url: "/packages/map/pages/map/map?source=miniprogram&ui=mobile" });
  },

  openExpert() {
    wx.reLaunch({ url: "/pages/expert/expert" });
  }
});
