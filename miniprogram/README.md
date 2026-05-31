# 金工小子微信小程序演示壳

这是金工小子的小程序 WebView 复用版本。小程序只提供入口和宿主页面，地图、路线、3D 模型、标签和拓扑仍由现有 H5/React 主线提供。当前小程序入口同步“五月底最精确移动端主线”：默认总览、分页选点、逐段导航、2F / 2.5F 分离，都走同一套 H5 地图，不单独重写一套小程序地图。

## 导入方式

1. 打开微信开发者工具。
2. 选择“导入”。
3. 项目目录选择本目录：`miniprogram/`。
4. AppID 可先留空或使用开发者工具生成的测试号；当前稳定版不要写 `touristappid`，否则可能弹出“更改 AppID 失败 touristappid”。

## H5 地址

小程序默认读取 `miniprogram/app.js` 中的：

```js
webBaseUrl: "http://127.0.0.1:5173/"
```

本地演示前先在仓库根目录运行 `npm run dev -- --host 127.0.0.1 --port 5173`。真机和正式版需要把它替换为已经部署的 HTTPS H5 地址，并在微信公众平台配置业务域名。

首页快捷入口会把这些参数传给 H5：

```text
mode=map&source=miniprogram&ui=mobile
startRoomId=...&targetRoomId=...&announce=summary,distance,direction,floorChange
```

H5 侧会直接进入地图并保留继续修改起点、终点、图层和视角的能力。

## 开发者工具 CLI

如果命令行打开时报 `IDE service port timeout`，先彻底退出微信开发者工具，再用固定端口启动：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open \
  --project "/Users/zzw4257/Documents/ZJU_archieve/05.课程与学术资料/项目设计实践/数据库-补充后端模块/repo/miniprogram" \
  --port 3800 \
  --lang zh
```

## 快捷入口

首页提供几组与主应用一致的 MapDirect 预设：

- `104-2F01`
- `108-2F04`
- `106-2F`
- `202-5`
- `208`
- `210`

这些入口只是预填参数，不会锁死地图状态。

## 校验

在仓库根目录运行：

```bash
npm run check:miniprogram
npm run build
```
