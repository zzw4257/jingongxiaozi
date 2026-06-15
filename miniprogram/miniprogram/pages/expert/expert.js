Page({
  data: {
    answer: "我可以结合工程训练空间、设备安全和路线信息给出更详细的说明。",
    keywords: ["专家问答", "工程训练", "安全提示"],
    citations: [
      { title: "金工中心空间信息", source: "内置地图资料", excerpt: "房间、走廊、楼梯和二层平台用于路线说明。" },
      { title: "工程训练安全提示", source: "应用知识库", excerpt: "进入实验空间前注意设备边界和现场指引。" }
    ]
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

  openChat() {
    wx.reLaunch({ url: "/pages/chat/chat" });
  }
});
