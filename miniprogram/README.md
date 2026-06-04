# 金工小子微信小程序版

这是金工小子的自包含小程序版本，不依赖本地 Vite 服务，也不加载外部 H5 页面。小程序包内包含：

- 移动端待机态首页。
- 地图入口和快速路线入口。
- 包内原生地图页，支持楼层切换、房间点击、常用路线和逐段引导。

当前版本只能视为“自包含小程序导航壳 + 语义地图预览”，不能视为和安卓/H5 移动端视觉一致的发布版。安卓/H5 的真实基准是 `src/features/map3d/Map3DApp.tsx` 的 Three.js + GLB 场景；当前小程序地图仍在 `pages/map/map.js` 内自绘 WebGL 多边形和 WXML overlay，因此视觉、模型细节、相机和交互都不等价。

小程序端已经共用 `src/features/map/data/mapData.ts` 和 `src/features/map/runtime.ts` 生成出的房间、走廊、门洞、楼梯、导航节点、路线和逐段导引，但这只解决数据/拓扑一致，不解决 3D 视觉一致。正式发布前必须把 `pages/map/map` 迁移到真实 Three 小程序适配层，例如 `three-platformize` + 微信 `canvas type="webgl"`，并加载同一份模型/语义场景；不能再用截图、全图 PNG、WebView、本地 `5173` 或当前自绘多边形冒充移动端地图。

## 导入方式

1. 打开微信开发者工具。
2. 选择“导入”。
3. 项目目录选择本目录：`miniprogram/`。
4. AppID 可先留空做开发检查；正式发布必须填写真实微信小程序 AppID。

## 页面

- `pages/home/home`：待机首页，默认只展示金工小子表情、右下地图入口、左侧应用抽屉。
- `pages/map/map`：包内原生小程序地图页，当前是语义 WebGL 多边形预览，不依赖 WebView、外部 H5 服务或全图 PNG 贴图 fallback；发布级目标必须替换为真实 Three/GLB 场景。
- `pages/chat/chat`：包内常态对话展示页，对齐移动端的“表情 + 大字回答 + 核心词 + 音频状态”。
- `pages/expert/expert`：包内专家问答展示页，对齐移动端的专家回答与引用卡片。

首页 MapDirect 预设会通过页面 query 进入地图页：

```text
source=miniprogram&ui=mobile
startRoomId=...&targetRoomId=...&announce=summary,distance,direction,floorChange
```

`project.config.json` 已内置以下编译场景，导入后可直接在微信开发者工具顶部场景里切换检查：

- 地图页-默认总览
- 地图页-104路线
- 地图页-108路线
- 地图页-202路线
- 地图页-208路线

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
npm run check:miniprogram:parity
npm run check:miniprogram:release
```

发布门禁要求：

- `miniprogram/project.config.json` 写入真实微信小程序 AppID。
- 小程序地图不再使用 `nativeRooms/nativeSpaces/nativeDoors/nativeRouteSegments` 这套产品可见自绘 overlay。
- 小程序地图存在真实 Three.js 小程序运行时适配，并加载模型资产，而不是仅渲染语义多边形。

当前小程序端已经去掉外部 H5 服务依赖，但尚未达到视觉一致发布标准。
