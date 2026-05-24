# 金工小子微信小程序演示壳

这是金工小子的小程序 WebView 复用版本。小程序只提供入口和宿主页面，地图、路线、3D 模型、标签和拓扑仍由现有 H5/React 主线提供。

## 导入方式

1. 打开微信开发者工具。
2. 选择“导入”。
3. 项目目录选择本目录：`miniprogram/`。
4. AppID 可先使用测试号或 `touristappid`。

## H5 地址

小程序默认读取 `miniprogram/app.js` 中的：

```js
webBaseUrl: "https://example.com/jingong-xiaozi/"
```

演示时把它替换为已经部署的 H5 地址。开发者工具中可关闭 URL 校验；真机和正式版需要在微信公众平台配置业务域名。

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
