# 金工小子微信小程序演示壳

这是金工小子的小程序 WebView 复用版本。小程序只提供入口和宿主页面，地图、路线、3D 模型、标签和拓扑仍由现有 H5/React 主线提供。

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

## 开发者工具 CLI

如果命令行打开时报 `IDE service port timeout`，先彻底退出微信开发者工具，再用固定端口启动：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open \
  --project "/Users/zzw4257/Documents/ZJU_archieve/05.课程与学术资料/项目设计实践/数据库-补充后端模块/repo/miniprogram" \
  --port 3800 \
  --lang zh
```

## MapDirect 参数

首页会把参数拼到 H5 URL：

```text
?mode=map&startRoomId=108-lobby&targetRoomId=202-5&announce=summary,distance,direction,floorChange
```

H5 侧读取这些参数后进入地图，并保持用户可继续改起点、终点、图层和视角。

## 校验

在仓库根目录运行：

```bash
npm run check:miniprogram
npm run build
```
