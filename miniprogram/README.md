# 金工小子微信小程序版

这是金工小子的自包含小程序版本，不依赖本地 Vite 服务，也不加载外部 H5 页面。小程序包内包含：

- 移动端待机态首页。
- 地图入口和快速路线入口。
- 包内 Three/WebGL 地图页，加载打包的 `jingong.glb` 模型资产，支持楼层切换、房间点击、常用路线、触控视角和逐段引导。

当前小程序地图使用 `three-platformize` + 微信 `canvas type="webgl"`，并加载包内 `map-models/jingong.glb`。它不允许回退到 WebView、外部 H5、localhost、本地 `5173`、全图 PNG 截图贴图或产品可见 WXML/native 多边形 overlay。小程序端通过生成脚本复用 `src/features/map/data/mapData.ts` 和 `src/features/map/runtime.ts` 的房间、走廊、门洞、楼梯、导航节点、路线和逐段导引数据。

## 导入方式

1. 打开微信开发者工具。
2. 选择“导入”。
3. 项目目录选择本目录：`miniprogram/`。
4. AppID 可先留空做开发检查；正式发布必须填写真实微信小程序 AppID。

## 页面

- `pages/home/home`：待机首页，默认只展示金工小子表情、右下地图入口、左侧应用抽屉。
- `pages/map/map`：包内 Three/WebGL 地图页，不依赖 WebView、外部 H5 服务或全图 PNG 贴图 fallback；地图、标签、路线、导引和面板由 Three/WebGL 绘制，WXML 只保留全屏 WebGL canvas 以及微信原生 canvas 上方无法稳定覆盖时必须存在的右侧触控栏/真北兜底控件。
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
- 小程序地图必须通过 `three-platformize` 和包内 GLB 模型渲染真实 Three 场景。
- 小程序地图不允许出现 `web-view`、localhost、`5173`、`mapImageSrc`、全图 PNG 截图贴图、旧 native 右栏或产品可见自绘 polygon overlay。
- 发布前必须用微信开发者工具重新截图检查待机、地图总览、路线、图层、视角和逐段导引。
