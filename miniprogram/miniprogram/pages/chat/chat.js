Page({
  data: {
    answer: "这里是常态对话展示模式。正式接入后由后端返回回答、核心词和播报状态，小程序端只负责清晰展示。",
    keywords: ["常态对话", "核心词", "播报中"]
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  openMap() {
    wx.navigateTo({ url: "/pages/map/map?source=miniprogram&ui=mobile" });
  },

  openExpert() {
    wx.navigateTo({ url: "/pages/expert/expert" });
  }
});
