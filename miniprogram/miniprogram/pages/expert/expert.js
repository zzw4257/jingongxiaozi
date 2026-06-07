Page({
  data: {
    answer: "这里是专家问答展示模式。正式接入后由文档检索服务返回工程训练相关答案，并同步引用来源。",
    keywords: ["专家问答", "文档检索", "引用"],
    citations: [
      { title: "工程训练引用占位", source: "本地 mock", excerpt: "等待后端接入真实资料库。" },
      { title: "安全规范占位", source: "本地 mock", excerpt: "用于验证小程序端引用卡片布局。" }
    ]
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  openMap() {
    wx.navigateTo({ url: "/pages/map/map?source=miniprogram&ui=mobile" });
  },

  openChat() {
    wx.navigateTo({ url: "/pages/chat/chat" });
  }
});
