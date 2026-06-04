# 小程序 Three 地图一致性迁移记录

## 当前结论

当前小程序地图不能称为和安卓/H5 移动端一致。它只复用了地图数据和路线运行时：

- 数据源：`src/features/map/data/mapData.ts` -> `miniprogram/miniprogram/data/map-data.js`
- 路线/标签/图层语义：`src/features/map/runtime.ts` -> `miniprogram/miniprogram/data/map-runtime.js`
- 小程序渲染：`miniprogram/miniprogram/pages/map/map.js` 自绘 WebGL 多边形，并用 WXML overlay 渲染房间、走廊、门、楼梯、路线和标签

安卓/H5 的真实视觉基准是 `src/features/map3d/Map3DApp.tsx`：Three.js、GLB 模型、真实相机、OrbitControls、语义 3D 几何、路线 mesh、标签投影和 Material 风格移动端 UI。小程序当前没有加载这套场景，因此视觉差异不是样式问题，而是渲染架构不同。

## 不允许再走的路线

- 不允许使用 `miniprogram-map-*.png`、全图截图、全图纹理或 `texImage2D` 贴图冒充地图。
- 不允许依赖 WebView、`5173`、localhost、公网 H5 托管作为小程序发布方案。
- 不允许把 `nativeRooms/nativeSpaces/nativeDoors/nativeRouteSegments` 自绘 overlay 继续描述为“视觉一致”。
- 不允许为了兼容当前自绘小程序而修改 H5/Tauri 的 Three 地图基准。

## 发布级目标

小程序发布版必须满足：

- 使用微信 `canvas type="webgl"` 承载真实 Three 场景。
- 使用 `three-platformize` 或等价小程序 Three 适配层。
- 加载包内模型资产或压缩后的 mini GLB，不能只画 mapData 多边形。
- 共享同一套地图拓扑、路线分段、楼层语义、动态标签密度和相机预设。
- 当前房间选择、路线步骤、图层切换和视角回正都必须作用在 Three 场景，而不是只改 WXML overlay。

## 迁移顺序

1. 抽出平台无关 scene builder。
   - 从 `Map3DApp.tsx` 中拆出 scene 创建、模型加载、语义几何、路线 mesh、标签投影和相机 preset。
   - React 只保留宿主 UI、状态绑定和 DOM label 容器。

2. 增加小程序 Three 适配层。
   - 首选 `three-platformize`，因为它明确支持微信小程序、GLTFLoader、OrbitControls 和带纹理 GLB。
   - 小程序 npm/分包产物必须进入 `miniprogram/miniprogram`，不能依赖仓库根的 Vite dev server。

3. 替换小程序地图页渲染。
   - `pages/map/map.wxml` 保留 `canvas type="webgl"`、右侧控制栏、路线/图层/视角面板。
   - 移除产品可见的 `nativeRooms/nativeSpaces/nativeDoors/nativeRouteSegments` overlay。
   - 点击命中、路线当前点、动态标签从 Three scene builder 导出。

4. 提升门禁。
   - `npm run check:miniprogram` 继续保证当前开发壳可打开、自包含、路线拓扑不坏。
   - `npm run check:miniprogram:parity` 和 `npm run check:miniprogram:release` 必须在真实 Three 迁移完成后才允许通过。

## 当前可用检查

```bash
npm run check:miniprogram
npm run check:miniprogram:parity
npm run check:miniprogram:release
```

当前阶段预期：

- `check:miniprogram` 可以通过，说明自包含语义预览没坏。
- `check:miniprogram:parity` 必须失败，直到真实 Three 场景接入。
- `check:miniprogram:release` 在缺 AppID 或缺 Three parity 时必须失败。
