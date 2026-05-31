# 金工小子微信小程序版

这是金工小子的自包含小程序版本，不依赖本地 Vite 服务，也不加载外部 H5 页面。小程序包内包含：

- 移动端待机态首页。
- 地图入口和快速路线入口。
- 包内原生地图页，支持楼层切换、房间点击、常用路线和逐段引导。

当前版本用于和安卓移动端主线保持视觉与流程一致。3D 精确模型渲染仍以安卓/H5 主线为最高保真版本；小程序端地图数据由 `src/features/map/data/mapData.ts` 生成到 `miniprogram/miniprogram/data/map-data.js`，房间、走廊、门洞、楼梯、导航节点和路线边都来自同一份主线拓扑，不再维护一套简化手写地图。

## 导入方式

1. 打开微信开发者工具。
2. 选择“导入”。
3. 项目目录选择本目录：`miniprogram/`。
4. AppID 可先留空做开发检查；正式发布必须填写真实微信小程序 AppID。

## 页面

- `pages/home/home`：待机首页，默认只展示金工小子表情、右下地图入口、左侧应用抽屉。
- `pages/map/map`：包内原生小程序地图页，不依赖 WebView 或外部 H5 服务。
- `pages/chat/chat`：包内常态对话展示页，对齐移动端的“表情 + 大字回答 + 核心词 + 音频状态”。
- `pages/expert/expert`：包内专家问答展示页，对齐移动端的专家回答与引用卡片。

首页 MapDirect 预设会通过页面 query 进入地图页：

```text
source=miniprogram&ui=mobile
startRoomId=...&targetRoomId=...&announce=summary,distance,direction,floorChange
```

## 开发者工具 CLI

如果命令行打开时报 `IDE service port timeout`，先彻底退出微信开发者工具，再用固定端口启动：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open \
  --project "/Users/zzw4257/Documents/ZJU_archieve/05.课程与学术资料/项目设计实践/数据库-补充后端模块/repo/miniprogram" \
  --port 3800 \
  --lang zh
```

## 校验

在仓库根目录运行：

```bash
node scripts/generate-miniprogram-map-data.mjs
npm run check:miniprogram
npm run build
```

正式发布前运行：

```bash
npm run check:miniprogram:release
```

发布门禁目前要求 `miniprogram/project.config.json` 写入真实微信小程序 AppID。小程序端已经去掉外部 H5 服务依赖。
